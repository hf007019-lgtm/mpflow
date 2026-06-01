# PROJECT_STATUS.md — MPFlow 项目当前状态

> 最后更新: 2026-05-27 | 基于代码审计 + 最近 4 个提交的修复记录

---

## 一句话介绍

MPFlow 是一个面向微信公众号创作者的 AI 文章生成 SaaS 平台，支持流式生成、DALL-E 配图、积分计费和 Logto 单点登录。

---

## 项目目标

帮助公众号创作者用 AI 快速生产高质量、去 AI 味的文章，提供从选题搜索 → 写作润色 → 配图 → 一键复制到微信的完整工作流。

---

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Next.js 15 (App Router, `output: "standalone"`), React 19, TypeScript, Tailwind CSS 3 |
| 后端 | Python FastAPI (port 8000), LangChain + LangChain-OpenAI, DeepSeek 模型 |
| 数据库 | SQLite (文件型), `@libsql/client` 直连 + Prisma 7 仅用于 schema 管理 |
| 认证 | Logto OIDC (auth.mpflowapp.com) + 自定义 JWT (jose, HS256, 30 天过期) |
| 反向代理 | 宝塔面板 Nginx (仓库内 nginx.conf 为参考模板，实际配置待确认) |
| CI/CD | GitHub Actions → Docker Buildx → ghcr.io → SSH 部署到宝塔 |
| 容器 | Docker Compose (frontend + backend, 无内部 nginx 容器) |
| 搜索 | Tavily / Serper (二选一 fallback) |
| 图片 | Pexels (免费图库) + DALL-E 3 (AI 生图) |

---

## 已完成模块

### 前端页面

| 页面 | 路由 | 说明 |
|------|------|------|
| 首页落地页 | `/` | Hero + 功能卡片 + 图片走马灯，内容可后台编辑 |
| 文章创作编辑器 | `/editor` | 主题输入 → 字数控制 → SSE 流式生成 → Markdown 编辑/预览 → 样式预设 → 微信复制 |
| AI 生图抽屉 | `/editor` (内嵌) | DALL-E 3 生成 1/2/4 张图，插入文章正文 |
| 后台仪表盘 | `/admin` | 用户数/生成数/积分消耗统计 + 30 天趋势图 |
| 后台用户管理 | `/admin/users` | 用户列表、积分调整、状态切换、删除 |
| 后台内容管理 | `/admin/content` | 编辑首页 Hero + 功能卡片内容 |
| 后台系统设置 | `/admin/settings` | API 地址、模型选择、定价配置 |
| 后台日志查看 | `/admin/logs` | 最近 50 条生成记录 |

### 前端组件

| 组件 | 说明 |
|------|------|
| Navbar | 全局导航，Logo + 链接 + 登录状态 + 积分余额 |
| ImageGenDrawer | AI 生图侧滑面板 |
| ComponentBuilder | 微信排版组件插入（关注引导、推荐卡片） |
| AIToolbar | AI 工具下拉（标题生成、扩写/缩写、SEO 提取、内容扫描） |
| VersionHistory | localStorage 版本历史（每 60 秒自动保存，最多 20 条） |
| ImagePromptCard | 选中文字 + 风格 → Midjourney/Stable Diffusion prompt |
| HeroCarousel | 首页走马灯 |
| PointsBalance / TokenBalance | 积分/Token 余额显示 |
| UserMenu | 用户头像下拉菜单 |
| ErrorBoundary | React 错误边界 |

### 后端 API (Python FastAPI)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/generate` | POST | SSE 流式文章生成：搜索 → LLM 润色 → 图片替换 |
| `/api/generate-image` | POST | DALL-E 3 生图 (1-4 张并发) |
| `/api/health` | GET | 健康检查 |

### 前端 API 路由 (Next.js)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/login/logto` | GET | 发起 Logto OIDC 登录/注册 |
| `/api/auth/callback/logto` | GET | OIDC 回调：换码 → 查用户 → 同步 DB → 签发 JWT |
| `/api/auth/logout` | GET/POST | 清除 cookie + 重定向到 Logto 登出 |
| `/api/auth/me` | GET | 返回当前 JWT session 用户 |
| `/api/auth/[...nextauth]` | GET/POST | NextAuth 标准路由（与自定义认证并存） |
| `/api/user/points` | GET | 返回用户积分余额和使用量 |
| `/api/user/tokens` | GET | 返回用户 Token 消耗量 |
| `/api/settings/pricing` | GET | 公开读取定价配置 |
| `/api/admin/settings` | GET/POST | 后台设置读写（Basic Auth 保护） |
| `/api/admin/logs-viewer` | GET | 后台日志查看（Basic Auth 保护） |
| `/api/generate` | POST | Next.js 版文章生成（独立实现，含积分扣费 + Unsplash 搜图） |
| `/api/generate/tool` | POST | 通用 LLM 工具调用（供 AI 工具栏使用） |

### 其他

- 积分计费系统：原子 SQL 扣费（`WHERE pointsBalance >= ?`）、邮箱优先查找
- 用户注册送 100 积分、NULL 恢复逻辑（不恢复已被扣到 0 的用户）
- 生成日志记录（topic、字数、模型、耗时、积分消耗、状态）
- DeepSeek 上下文缓存优化（System Prompt 静态常量，动态变量在 HumanMessage）
- 文章 "去 AI 味" 联合编辑委员会 System Prompt

---

## 未完成模块 / 功能缺口

- [ ] 微信草稿箱 API 对接（目前只能复制 HTML 手动粘贴）
- [ ] 用户自助积分充值（积分只能注册获得，无法购买）
- [ ] 文章历史云端同步（目前只存 localStorage，最多 5 条）
- [ ] 错误监控 / 告警（无 Sentry 或等价方案）
- [ ] 自动测试（项目无 test 目录、无测试文件）
- [ ] Docker 数据持久化（见已知问题 D）
- [ ] `image_descriptions` 参数前后端对齐（见已知问题 B）
- [ ] 宝塔 Nginx 配置文档化（见已知问题 F）

---

## 当前部署状态

- **运行环境**: 宝塔面板 (64.90.3.144)，Docker Compose
- **域名**: mpflowapp.com
- **认证服务**: auth.mpflowapp.com (独立 Logto 实例)
- **镜像仓库**: ghcr.io/hf007019-lgtm/mpflow
- **部署流程**: GitHub Actions 监听 main 分支 → 构建 Docker 镜像 → 推送到 ghcr.io → SSH 宝塔 → `docker compose pull && docker compose up -d`（**注意：pull 步骤实际不生效，参见已知问题 A**）
- **容器**: mp-backend (port 8100→8000), mp-frontend (port 3000→3000)

---

## 当前已知问题

### P0 — 影响部署稳定性和数据安全

| # | 问题 | 状态 |
|---|------|------|
| A | `docker-compose.yml` 使用 `build:` 而非 `image:`，CI 推送的 ghcr.io 镜像没有被使用，`docker compose pull` 不生效 | **已确认** |
| D | docker-compose.yml 无 `volumes:` 挂载，容器重建会导致 SQLite 数据（用户、积分、日志）全部丢失 | **已确认** |
| F | 仓库内 `nginx.conf` `/api/` 全量转发到 Python 与实际生产配置不一致。生产宝塔 Nginx 已做精细分流（`/api/auth/`、`/api/user/`、`/api/settings/` → Next.js 3000；其余 `/api/` → Python 8100），但缺少 `/api/admin/` 转发规则，且部分规则可能因缺少尾斜杠导致匹配失败 | **生产配置已部分确认**，待修复 F1 (缺少 /api/admin/) 和 F2 (无尾斜杠路径匹配) |
| N | 宝塔 Nginx 启用了全局 `proxy_cache cache_one`，缓存 HTML 响应。前端容器更新后 Nginx 仍返回旧 HTML（引用旧 chunk），导致 `/editor` 出现 ChunkLoadError。直连 `127.0.0.1:3000` 正常，域名访问异常。 | **已解决** — 清理缓存目录 `/www/server/nginx/proxy_cache_dir` 后恢复正常。后续部署后如出现旧 chunk 404，优先检查 Nginx proxy_cache。`/editor` 页面已改为 Server Component wrapper + `force-dynamic`/`force-no-store`，但 Nginx 层缓存优先级更高，建议对 Next.js 页面路径禁用 proxy_cache。 |

### P1 — 影响功能正确性

| # | 问题 | 状态 |
|---|------|------|
| B | `image_descriptions` 前端传给后端但 `generate_article_stream()` 参数列表未接收 | **已修复** — 2026-05-27: ArticleRequest 新增字段 → router 传递 → article_agent 接收 → polish_agent 条件性拼入 prompt；开关关闭时 prompt 不含配图要求；`_auto_insert_placeholders()` 仅开关开启时调用 |

### P2 — 代码质量和安全

| # | 问题 | 状态 |
|---|------|------|
| C | `with_images` 在 editor 永远为 `false`，后端 Pexels 自动搜图不会被触发。暂不删除，标记为"当前未启用/可能是遗留或待恢复功能" | **已确认** |
| E | `docker-compose.yml` 明文硬编码 AUTH_SECRET、LOGTO_SECRET 等密钥 | **已修复，待线上密钥轮换与部署验证** |
| G | `frontend/src/components/Editor.tsx` — 独立编辑器组件，疑似早期遗留代码，当前未被任何页面引用 | **已确认** |
| H | `logout/route.ts` 中 Logto endpoint 和 client ID 硬编码 (`https://auth.mpflowapp.com/oidc/session/end`, `7kwqlhcieixzn90fxuz6i`)，非环境变量 | **已确认** |

---

## 最近已修复 (2026-05-26 — 2026-05-27)

### IMAGE_PLACEHOLDER 404 + 图片描述开关

- **现象**: 浏览器 Console 大量 `IMAGE_PLACEHOLDER_1/2/3 404`；不管图片描述开关是否打开，文章都会出现【配图建议】
- **根因**: 
  1. `polish_agent.py` System Prompt 要求 LLM 输出 `![配图](IMAGE_PLACEHOLDER_N)` Markdown 图片语法 → ReactMarkdown 渲染 `<img src="IMAGE_PLACEHOLDER_N">` → 浏览器请求 404
  2. Python `ArticleRequest` 模型缺少 `image_descriptions` 字段 → router 未传递 → agent 未接收 → prompt 无条件输出
- **修复** (commit `47ad992`, `abc5dd3`):
  1. 后端 prompt 改为文本格式 `【配图建议：中文描述 | English keywords】`，禁止 Markdown 图片语法
  2. `image_descriptions` 补全整条链路：ArticleRequest → router → article_agent → polish_agent 条件性拼入 user message
  3. 前端 ReactMarkdown 添加 `img` 组件拦截器：`src` 含 `IMAGE_PLACEHOLDER` 时渲染配图建议卡片，不创建 `<img>` DOM
  4. `_auto_insert_placeholders()` 仅在 `image_descriptions=true` 时调用

### 积分扣减修复

- **现象**: 页面显示 -1 积分消耗，但用户积分余额未变化（生成后不扣分）
- **根因**: 生产环境 `/api/generate` 走 Python FastAPI 后端，Python 没有任何积分扣减代码。积分扣减逻辑仅在 Next.js fallback route 中
- **修复** (commit `47ad992`, `abc5dd3`):
  1. 前端点击生成时立即 `POST /api/user/points` 扣分（不再等生成完成）
  2. 新增 `POST /api/user/points` 处理器：JWT 验证 → action→cost 服务端查表 → `deductPoints()`
  3. 扣分时机改为点击即扣（余额不足阻断生成；中断/超时不退分）

### 积分扣分 402 "积分不足"

- **现象**: `POST /api/user/points` 返回 402 `{ "error": "积分不足" }`，但 `GET /api/user/points` 显示余额 100
- **根因**: `deductPoints()` 查找用户时按 email 查 → 大小写不匹配 → 回退 name 查到 → 但扣减 `WHERE` 用了不匹配的 email（`email || userName`）→ `rowsAffected = 0` → 抛 `INSUFFICIENT_POINTS`
- **修复** (commit `3ad4343`):
  1. `deductPoints()` 查找时同时取 `id` 和 `pointsBalance` → 扣减 `WHERE id = ?`（主键，绝对唯一）
  2. 新增 `normalizeEmail()` → 所有 email 查询改为 `WHERE LOWER(email) = ?`（大小写不敏感）
  3. `ensureUser`、`getUserPoints`、`deductPoints` 三个函数统一使用 normalize + LOWER(email)

### 积分扣费金额不一致

- **现象**: 前端按钮 "-1 积分"，后端 `ACTION_COSTS.article_generate = 2`，实际扣 2 分
- **修复** (commit `8cc1d41`):
  1. `ACTION_COSTS.article_generate` 改为 1
  2. POST 响应新增 `cost` 和 `action` 字段
  3. 前端 `calculatePoints()` 改为常量 1；日志使用后端返回的 `d.cost` 而非前端估算值

---

## 关键文件索引

### 根目录配置

| 文件 | 用途 |
|------|------|
| `CLAUDE.md` | 项目上下文文档 (AI 助手用) |
| `docker-compose.yml` | 容器编排 (frontend + backend) |
| `nginx.conf` | Nginx 参考模板（实际部署配置待确认） |
| `.github/workflows/deploy.yml` | CI/CD: 构建 → 推送 → SSH 部署 |

### 前端核心

| 文件 | 用途 |
|------|------|
| `frontend/src/app/editor/page.tsx` | Server Component wrapper（route segment config: dynamic/force-no-store），实际逻辑在 EditorClient.tsx |
| `frontend/src/app/page.tsx` | 首页落地页 |
| `frontend/src/app/layout.tsx` | 根布局 + Navbar |
| `frontend/src/app/admin/` | 后台管理页面组 |
| `frontend/src/app/api/generate/route.ts` | Next.js 版文章生成 API (SSE) |
| `frontend/src/app/api/auth/callback/logto/route.ts` | OIDC 回调 + JWT 签发 |
| `frontend/src/app/api/auth/[...nextauth]/route.ts` | NextAuth 标准路由 |
| `frontend/src/lib/db.ts` | 数据库访问层 (核心) |
| `frontend/src/lib/api.ts` | 前端 API 客户端 |
| `frontend/src/lib/wechat-exporter.ts` | 微信公众号 HTML 导出 |
| `frontend/src/middleware.ts` | Admin 路由 Basic Auth 保护 |
| `frontend/prisma/schema.prisma` | 数据模型定义 |
| `frontend/Dockerfile` | 多阶段构建 (deps → builder → runner) |
| `frontend/next.config.js` | Next.js 配置 (standalone + `/api/health` rewrite) |

### 后端核心

| 文件 | 用途 |
|------|------|
| `backend/app/main.py` | FastAPI 入口 + 中间件 |
| `backend/app/config.py` | 环境变量配置 |
| `backend/app/routers/article.py` | API 路由 (`/api/generate`, `/api/generate-image`, `/api/health`) |
| `backend/app/agents/article_agent.py` | 文章生成流水线 (流式 + 非流式) |
| `backend/app/agents/polish_agent.py` | LLM 润色 chain (DeepSeek 缓存优化) |
| `backend/app/agents/image_agent.py` | 图片替换 (Pexels/DALL-E/Picsum fallback) |
| `backend/app/services/search_service.py` | 搜索分发 (Tavily → Serper) |
| `backend/app/models/article.py` | Pydantic 数据模型 |
| `backend/requirements.txt` | Python 依赖 |

---

## 下一步开发顺序建议

1. **P0 修复**：D (数据持久化) → A (docker-compose 镜像拉取) → F1/F2 (Nginx 补漏路由)
2. **P1 修复**：B (image_descriptions 参数对齐)
3. **功能开发：**草稿箱 API → 积分充值 → 云端历史
4. **P2 清理：**C/E/G/H + CLAUDE.md 更新
5. **工程质量：**测试 → 错误监控 → 密钥管理
