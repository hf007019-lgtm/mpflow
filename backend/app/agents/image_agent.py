import json
import re
import httpx
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from app.config import settings


PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search"

# Static system prompt for keyword translation — always at messages[0]
_TRANSLATE_SYSTEM = "Translate to 3-5 English keywords. Output only comma-separated keywords, no sentences."


def _extract_english(text: str) -> str:
    eng = re.findall(r'[A-Za-z0-9+#]+', text)
    return ",".join(eng[:5]) if eng else ""


async def _search_pexels(query: str) -> str:
    """Search Pexels and return a medium-sized image URL, or empty string."""
    if not settings.pexels_api_key:
        return ""
    try:
        async with httpx.AsyncClient(timeout=10, trust_env=False) as client:
            resp = await client.get(
                PEXELS_SEARCH_URL,
                params={"query": query, "per_page": 1, "orientation": "landscape"},
                headers={"Authorization": settings.pexels_api_key},
            )
            resp.raise_for_status()
            data = resp.json()
            photos = data.get("photos", [])
            if photos:
                return photos[0]["src"]["large"]
    except Exception:
        pass
    return ""


async def _translate_to_keywords(text: str) -> str:
    """Use LLM to translate Chinese text to English keywords."""
    if not text.strip():
        return ""
    # Fast path: text is already English keywords
    eng = _extract_english(text)
    if eng and len(eng.split(",")) >= 3:
        return eng

    try:
        llm = ChatOpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            model=settings.openai_model,
            temperature=0,
        )
        messages = [
            SystemMessage(content=_TRANSLATE_SYSTEM),
            HumanMessage(content=text),
        ]
        raw = await llm.ainvoke(messages)
        raw = (raw.content if hasattr(raw, "content") else str(raw)).strip().strip('"').strip("'")
        if not re.search(r'[一-鿿]', raw):
            return raw
    except Exception:
        pass
    return ""



async def generate_images(markdown: str, topic: str = "") -> str:
    # Match both new 【配图建议：...】 format and legacy IMAGE_PLACEHOLDER markers
    suggestions = re.findall(r'【配图建议：(.+?)】', markdown)
    legacy_placeholders = re.findall(r'IMAGE_PLACEHOLDER_(\d+)', markdown)

    if not suggestions and not legacy_placeholders:
        return markdown

    # Collect context: title + headings
    headings: list[str] = []
    title_match = re.search(r'^#\s+(.+)$', markdown, re.MULTILINE)
    if title_match:
        headings.append(title_match.group(1))
    headings += re.findall(r'^##\s+(.+)$', markdown, re.MULTILINE)

    # Translate article-level topic to English keywords (used as fallback)
    global_kw = await _translate_to_keywords(topic)

    is_openai = "api.openai.com" in settings.openai_base_url

    # Process new 【配图建议：...】 format
    for suggestion in suggestions:
        # Extract English keywords part if available
        parts = suggestion.split("|", 1)
        desc_text = parts[0].strip()
        eng_keywords = parts[1].strip() if len(parts) > 1 else ""

        query = eng_keywords or await _translate_to_keywords(desc_text) or global_kw or "technology"

        image_url = await _fetch_image(query, is_openai)
        if image_url:
            old = f"【配图建议：{suggestion}】"
            markdown = markdown.replace(old, f"![配图]({image_url})", 1)

    # Process legacy IMAGE_PLACEHOLDER markers (backward compat)
    for n in legacy_placeholders:
        marker = f"IMAGE_PLACEHOLDER_{n}"
        placeholder_text = f"![配图]({marker})"

        idx = markdown.find(marker)
        before = markdown[:idx] if idx > 0 else ""
        nearby = re.findall(r'^##\s+(.+)$', before, re.MULTILINE)
        heading_text = nearby[-1] if nearby else (headings[0] if headings else topic)

        heading_kw = await _translate_to_keywords(heading_text)
        query = heading_kw or global_kw or _extract_english(topic) or "technology"

        image_url = await _fetch_image(query, is_openai)
        if image_url:
            markdown = markdown.replace(placeholder_text, f"![配图]({image_url})", 1)

    return markdown


async def _fetch_image(query: str, is_openai: bool) -> str:
    """Try DALL-E → Pexels → Picsum to get an image URL for a keyword query."""
    image_url = ""

    if is_openai and settings.openai_api_key:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)
            dalle_resp = await client.images.generate(
                model="dall-e-3",
                prompt=f"A clean, professional blog illustration: {query}",
                size="1024x1024",
                quality="standard",
                n=1,
            )
            image_url = dalle_resp.data[0].url
        except Exception:
            pass

    if not image_url:
        image_url = await _search_pexels(query)

    if not image_url:
        seed = (hash(query) % 900) + 1
        image_url = f"https://picsum.photos/800/400?random={seed}"

    return image_url
