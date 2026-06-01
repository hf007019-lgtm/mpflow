# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

---

## Project: MPFlow — 微信公众号 AI 创作助手

A full-stack production SaaS for AI-powered WeChat Official Account article generation.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router, `output: "standalone"`), React 19, Tailwind CSS 3 |
| Backend | Python FastAPI (port 8000), LangChain + LangChain-OpenAI |
| Database | SQLite via libSQL client (`@libsql/client`) + Prisma 7 ORM (schema only, not Prisma Client in production) |
| Auth | Logto OIDC (external at `auth.mpflowapp.com`) + custom JWT sessions (`jose`, HS256, 30d expiry) |
| Reverse Proxy | Nginx or Caddy (streaming-friendly, `proxy_buffering off` for SSE) |
| CI/CD | GitHub Actions → Docker Buildx → ghcr.io → SSH deploy to Baota server |
| Container | Docker Compose (3 services: frontend, backend, optional logto) |

### Key architectural facts

**There are TWO `/api/generate` implementations:**
- **Production path (Python FastAPI):** Nginx/Caddy routes `/api/*` to `backend:8000`. The Python `routers/article.py` handles POST `/api/generate` returning `StreamingResponse(text/event-stream)`. Pipeline: news search (Tavily/Serper) → LLM polish (DeepSeek via LangChain `chain.astream()`) → Pexels image injection.
- **Development/fallback path (Next.js):** `frontend/src/app/api/generate/route.ts` also implements SSE streaming with direct DeepSeek API calls, Unsplash cover images, and points billing. This route is active when the frontend runs standalone (no Nginx proxy).

**Database access uses TWO independent clients connecting to the same SQLite file:**
- `frontend/src/lib/db.ts` — raw `@libsql/client` (used by auth callbacks, points API, generation logs, admin pages)
- `frontend/src/lib/prisma.ts` — Prisma Client with libSQL adapter (used for schema management and some queries)
- Both read `DATABASE_URL` env var, falling back to `file:./dev.db`
- In Docker: `DATABASE_URL=file:/app/prisma/dev.db` — the DB is baked into the image during build via `npx prisma db push --accept-data-loss`

**Auth flow:**
1. User clicks login → NextAuth (`[...nextauth]`) redirects to Logto OIDC
2. Logto callback hits `callback/logto/route.ts` (explicit route takes precedence over catch-all)
3. Callback exchanges code, fetches user info from Logto `/me`, syncs to local User table (creates with 100 initial points if new), issues JWT in `authjs.session-token` cookie
4. All subsequent API calls verify the JWT via `jwtVerify(token, AUTH_SECRET)`

**Points billing (`frontend/src/lib/db.ts`):**
- `getUserPoints(name, email)` — email-first lookup
- `deductPoints(name, points, email)` — atomic `UPDATE ... WHERE pointsBalance >= ?`, throws `INSUFFICIENT_POINTS` if balance too low
- `ensureUser(name, email, id)` — idempotent safety net, creates user with 100 points if not found
- **Critical rule:** Never grant points based on `pointsBalance === 0` — only recover on `NULL` (genuinely missing data)

**DeepSeek context cache optimization (`backend/app/agents/polish_agent.py`):**
- System prompt is a module-level constant, NEVER modified, NEVER has f-string injection
- All dynamic variables (topic, word_count, search_material) go into `HumanMessage` at `messages[1]`
- Uses `RunnableLambda(_build_messages) | llm | StrOutputParser()` instead of `ChatPromptTemplate`

### Docker build notes

- `frontend/Dockerfile` is multi-stage: `deps` → `builder` → `runner`
- `deps` stage uses `npm ci --ignore-scripts` to prevent postinstall hangs
- `builder` stage runs `prisma generate`, `npm run build`, then `prisma db push` to bake the SQLite DB into the image
- `runner` copies standalone output + `prisma/` directory, runs as non-root `nextjs` user
- CI uses `no-cache: true` in `docker/build-push-action` to force clean builds

### Environment variables (production)

```
# Frontend (Next.js)
NEXT_PUBLIC_API_URL        # External API URL (used by client-side fetch)
NEXT_PUBLIC_APP_URL        # Canonical app URL
AUTH_SECRET                # JWT signing secret (HS256)
AUTH_LOGTO_ID              # Logto OIDC client ID
AUTH_LOGTO_SECRET          # Logto OIDC client secret
AUTH_LOGTO_ISSUER          # Logto issuer URL (https://auth.mpflowapp.com/oidc)
AUTH_URL                   # Redirect URI base for OIDC callback
DATABASE_URL               # SQLite path (file:/app/prisma/dev.db in Docker)
INTERNAL_API_TOKEN         # Private Docker-internal billing token, never exposed to browser builds
ADMIN_USER                 # Required admin Basic Auth username
ADMIN_PASS                 # Required admin Basic Auth password

# Backend (Python FastAPI)
OPENAI_API_KEY             # DeepSeek or OpenAI API key
OPENAI_BASE_URL            # Default: https://api.deepseek.com
OPENAI_MODEL               # Default: deepseek-chat
DALLE_API_KEY              # DALL-E API key (falls back to OPENAI_API_KEY)
AUTH_TOKEN                 # Legacy/internal only; do not expose to browser builds
AUTH_SECRET                # Must match frontend AUTH_SECRET for JWT verification
INTERNAL_API_TOKEN         # Must match frontend INTERNAL_API_TOKEN
TAVILY_API_KEY             # News search API
PEXELS_API_KEY             # Stock image search
CORS_ORIGINS               # Comma-separated allowed origins
```

### Commands

```bash
# Local development (frontend only)
cd frontend && npm run dev          # Next.js on :3000

# Local development (backend only)
cd backend && pip install -r requirements.txt && python -m app.main  # FastAPI on :8000

# Production (Docker Compose)
docker compose up -d                # Start all services
docker compose pull                 # Pull latest images from ghcr.io
docker compose up -d                # Recreate with new images
docker image prune -f               # Clean old images

# Database (when Prisma schema changes)
cd frontend && npx prisma db push --accept-data-loss   # Sync schema to SQLite
cd frontend && npx prisma generate                     # Regenerate Prisma Client
```

### Nginx routing (production)

```
/       → frontend:3000  (Next.js pages, WebSocket upgrade headers, 120s timeout)
/api/   → backend:8000   (Python FastAPI, proxy_buffering off, chunked_transfer on, 180s timeout)
```

This means the Python backend handles `/api/generate` and `/api/generate-image`. The Next.js frontend handles `/api/auth/*`, `/api/user/*`, `/api/admin/*`, and `/api/settings/*` — but these paths are NOT routed to Next.js because `location /api/` catches them first and sends them to Python. In practice, this works because:
- The `docker-compose.yml` maps Next.js to port 3000 (external)
- The Baota Nginx on the host has separate location rules for specific paths
- Or the Next.js API routes are reached via port 3000 internal Docker networking

# Compact instructions

当执行 /compact 时，只保留：
- 当前正在解决的问题
- 关键报错
- 修改过的文件
- 已执行命令和结果
- 还没有解决的风险点
- 下一步操作

删除：
- 重复日志
- 已经解决的错误
- 无关解释
- 过时尝试

请把下面规则追加到 AGENTS.md，作为以后本项目的 Git 提交规则。

## Git commit / push rules

When a task only changes documentation files such as:
- PROJECT_STATUS.md
- TODO.md
- DECISIONS.md
- AGENTS.md
- README.md

Codex may automatically:
1. run git status
2. confirm no business code files were changed
3. git add the changed documentation files
4. git commit with a clear docs: message
5. git push origin main

For business code changes, Codex must not auto-push immediately. It must:
1. show git status
2. show git diff --stat
3. run the relevant build/test command
4. explain changed files
5. ask for confirmation before commit/push

For deployment-sensitive files, Codex must ask for confirmation before commit/push, including:
- docker-compose.yml
- Dockerfile
- nginx.conf
- environment variable files
- database/schema/migration files
- GitHub Actions workflow files

If git push fails because of network or authentication, Codex should stop and tell me the exact error.
