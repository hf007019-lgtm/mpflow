import asyncio
import base64
import hashlib
import hmac
import json
import os
import re
import sqlite3
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from openai import AsyncOpenAI
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.agents.article_agent import generate_article_stream
from app.config import settings
from app.models.article import ArticleRequest, ImageGenerateRequest

router = APIRouter(prefix="/api", tags=["article"])
limiter = Limiter(key_func=get_remote_address, config_filename="")
security = HTTPBearer(auto_error=False)


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _verify_session_token(token: str) -> dict:
    if not settings.auth_secret:
        raise HTTPException(status_code=500, detail="AUTH_SECRET is required")

    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
        expected = hmac.new(
            settings.auth_secret.encode("utf-8"),
            signing_input,
            hashlib.sha256,
        ).digest()
        actual = _b64url_decode(signature_b64)
        if not hmac.compare_digest(expected, actual):
            raise ValueError("invalid signature")

        payload = json.loads(_b64url_decode(payload_b64))
        exp = payload.get("exp")
        if exp and int(exp) < int(time.time()):
            raise ValueError("expired token")
        return payload
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid session") from exc


def verify_auth(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    token = request.cookies.get("authjs.session-token")
    if token:
        return {"token": token, "payload": _verify_session_token(token)}

    if settings.auth_token and credentials and credentials.credentials == settings.auth_token:
        raise HTTPException(status_code=401, detail="User session required")

    raise HTTPException(status_code=401, detail="Login required")


def _database_path() -> str:
    url = settings.database_url or os.getenv("DATABASE_URL", "")
    if not url.startswith("file:"):
        raise HTTPException(status_code=500, detail="SQLite DATABASE_URL is required")
    return url.removeprefix("file:")


def _deduct_points_sqlite(user: dict, points: int) -> None:
    email = str(user.get("email") or "").strip().lower()
    name = str(user.get("name") or user.get("email") or "User").strip()
    user_id = str(user.get("sub") or "").strip()
    if not email and not user_id:
        raise HTTPException(status_code=401, detail="Invalid user")

    conn = sqlite3.connect(_database_path(), timeout=10, isolation_level=None)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("BEGIN IMMEDIATE")
        row = None
        if email:
            row = conn.execute(
                "SELECT id, status, pointsBalance FROM User WHERE LOWER(email) = ?",
                (email,),
            ).fetchone()
        if row is None and user_id:
            row = conn.execute(
                "SELECT id, status, pointsBalance FROM User WHERE id = ?",
                (user_id,),
            ).fetchone()

        if row is None:
            user_id = user_id or os.urandom(16).hex()
            conn.execute(
                "INSERT INTO User (id, name, email, status, createdAt, pointsBalance, initialPoints) "
                "VALUES (?, ?, ?, 'active', datetime('now'), 100, 100)",
                (user_id, name, email or f"{user_id}@mpflowapp.com"),
            )
            balance = 100
            status = "active"
        else:
            user_id = row["id"]
            status = row["status"]
            balance = row["pointsBalance"]

        if status != "active":
            conn.execute("ROLLBACK")
            raise HTTPException(status_code=403, detail="User suspended")

        if balance is None:
            conn.execute(
                "UPDATE User SET pointsBalance = 100 WHERE id = ? AND pointsBalance IS NULL",
                (user_id,),
            )

        updated = conn.execute(
            "UPDATE User SET pointsBalance = pointsBalance - ? "
            "WHERE id = ? AND pointsBalance >= ?",
            (points, user_id, points),
        )
        if updated.rowcount == 0:
            conn.execute("ROLLBACK")
            raise HTTPException(status_code=402, detail="Insufficient points")

        conn.execute("COMMIT")
    except HTTPException:
        raise
    except Exception as exc:
        conn.execute("ROLLBACK")
        raise HTTPException(status_code=500, detail="Points billing failed") from exc
    finally:
        conn.close()


async def _deduct_points(auth: dict, points: int) -> None:
    token = auth.get("token")
    if settings.internal_billing_url and settings.internal_api_token and token:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    settings.internal_billing_url,
                    headers={
                        "Content-Type": "application/json",
                        "X-Internal-Token": settings.internal_api_token,
                        "Cookie": f"authjs.session-token={token}",
                    },
                    json={"points": points},
                )
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail="Billing service unavailable") from exc

        if resp.status_code == 402:
            raise HTTPException(status_code=402, detail="Insufficient points")
        if resp.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid billing session")
        if not resp.is_success:
            raise HTTPException(status_code=502, detail="Billing service failed")
        return

    _deduct_points_sqlite(auth.get("payload") or {}, points)


def sanitize(text: str) -> str:
    text = text[:500]
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    return text.strip()


@router.post("/generate")
@limiter.limit("10/minute")
async def generate(req: ArticleRequest, request: Request, user=Depends(verify_auth)):
    safe_topic = sanitize(req.topic)
    await _deduct_points(user, 1)

    async def sse_generator():
        async for sse_chunk in generate_article_stream(
            topic=safe_topic,
            language=req.language,
            word_count=min(req.word_count, 5000),
            with_images=req.with_images,
            image_descriptions=req.image_descriptions,
            additional_instructions=sanitize(req.additional_instructions)[:500],
        ):
            yield sse_chunk

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/generate-image")
async def generate_image(req: ImageGenerateRequest, user=Depends(verify_auth)):
    prompt = req.prompt[:2000].strip()
    count = max(1, min(req.count, 4))
    await _deduct_points(user, count * settings.price_ai_image)
    api_key = settings.dalle_api_key or settings.openai_api_key or ""

    if not api_key:
        raise HTTPException(status_code=400, detail="DALL-E API key is not configured")

    async def _generate_one(variation: str) -> dict:
        client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://api.openai.com/v1",
            timeout=60.0,
        )
        try:
            resp = await client.images.generate(
                model="dall-e-3",
                prompt=variation,
                size="1024x1024",
                quality="standard",
                n=1,
            )
            return {"url": resp.data[0].url}
        except Exception as exc:
            return {"error": str(exc)}

    variations: list[str] = [prompt]
    if count > 1:
        seeds = ["variant A", "variant B", "variant C", "variant D"]
        variations = [f"{prompt} --{seeds[i]}" for i in range(count)]

    results = await asyncio.gather(*(_generate_one(v) for v in variations))

    return {"images": list(results)}


@router.get("/health")
async def health():
    return {"status": "ok"}
