# DECISIONS.md — MPFlow 技术决策记录

> 记录本项目做过的重要技术选择、原因、临时方案和未来可能需要重构的地方。

---

## 1. 架构决策

### 1.1 Python FastAPI 做后端 + Next.js 做前端（非同构全栈）

**选择**: 前后端分离。前端 Next.js 15，后端 Python FastAPI，通过 HTTP API 通信。

**原因**:
- Python 生态在 AI/LLM 领域有最强的库支持（LangChain、OpenAI SDK）
- FastAPI 原生支持 streaming response（SSE），与文章生成需求匹配
- Next.js 独立处理前端渲染、认证回调、积分 API 等非 AI 逻辑

**代价**:
- 出现了 **两套 `/api/generate` 实现**（Python 和 Next.js 各一），功能相似但不完全相同
- Nginx 路由需要精细拆分 `/api/` 路径，哪些去 Python、哪些去 Next.js
- 部署需要两个 Docker 容器

### 1.2 SQLite 而非 PostgreSQL/MySQL

**选择**: 使用 SQLite 文件数据库，通过 `@libsql/client` 直连，Prisma 仅做 schema 管理。

**原因**:
- 项目是小团队 SaaS，用户量和并发量在初期不需要独立数据库服务器
- SQLite 零运维成本（无需额外容器或云服务）
- LibSQL (Turso SDK) 兼容 SQLite 协议，未来可以迁移到 Turso 分布式

**代价与风险**:
- 单文件存储 → 必须在 Docker 宿主机持久化（**当前缺失**，见 PROBLEM D）
- 写并发受限于 SQLite 的单一写者模型
- 没有连接池、没有主从复制

### 1.3 "烧录"数据库到 Docker 镜像

**选择**: 在 Docker 构建的 builder 阶段运行 `prisma db push --accept-data-loss`，将空的 schema 写入 SQLite 文件，打包进镜像。

**原因**:
- 之前遇到 `EACCES` 问题：运行时以非 root 用户执行 `prisma db push` 会权限拒绝
- 构建时以 root 执行可以保证 schema 存在

**代价**:
- 镜像包含 SQLite 空库（体积不大但语义不清）
- 如果 volume 挂载一个已有数据的路径，首次启动可能需要处理 schema 迁移
- **这是为解决权限问题的临时方案，不是最佳实践** → 未来可改为启动脚本检查 + 自动迁移

---

## 2. 认证决策

### 2.1 自定义 JWT + Logto OIDC（而非纯 NextAuth）

**选择**: 核心认证链路使用自定义 OIDC callback + `jose` 签发 JWT，同时保留 NextAuth 的 `[...nextauth]` 路由作为备选。

**原因**:
- Logto 是独立部署的身份服务 (`auth.mpflowapp.com`)，不是 NextAuth 内置 provider，需要自定义 OIDC 集成
- 自定义 JWT (HS256, 30 天) 完全控制 session 行为，不依赖第三方
- 前端所有请求用 `Authorization: Bearer <token>` 调用后端，JWT 可以直接被后端验证

**代价**:
- **两套认证系统并存**（自定义 callback + NextAuth），增加维护负担
- NextAuth 的 `Providors.tsx` (SessionProvider) 和自定义 cookie 各有一套状态
- `Session` 和 `Account` 表是 NextAuth 标准模型，但自定义认证链路不使用它们

**未来方向**: 可能统一到一条认证链路（选自定义 JWT 路线并移除 NextAuth 依赖，或反之）。

### 2.2 Admin 认证使用 HTTP Basic Auth

**选择**: `/admin` 路由和 `/api/admin/*` 使用 HTTP Basic Auth，凭据必须来自 `ADMIN_USER`/`ADMIN_PASS` 环境变量；未配置时拒绝访问，不提供默认密码。

**原因**: 管理后台面向运维人员而非终端用户，Basic Auth 足够简单有效。

**代价**: 密码明文写在环境变量里（虽然需要服务器权限才能读）。未来用户量大了可改为基于 JWT 角色的权限控制。

---

## 3. AI 模型决策

### 3.1 默认使用 DeepSeek 而非 OpenAI

**选择**: `OPENAI_BASE_URL=https://api.deepseek.com`，`OPENAI_MODEL=deepseek-chat`。

**原因**:
- DeepSeek 成本远低于 GPT-4（对 SaaS 产品至关重要）
- DeepSeek 中文写作能力出色，适合公众号场景
- DeepSeek 支持 context caching，系统提示词缓存可显著降低延迟和成本

**代价**: DALL-E 3 生图仍需要 OpenAI API key（`api.openai.com`），所以项目依赖两个 API 提供商。

### 3.2 DeepSeek 上下文缓存优化

**选择**: System Prompt 作为模块级常量（永不修改），所有动态参数（topic、字数、搜索内容）放在 `HumanMessage` 中。使用 `RunnableLambda(_build_messages) | ChatOpenAI | StrOutputParser()` 而非 `ChatPromptTemplate`。

**原因**: DeepSeek 的 prefix cache 要求 `messages[0]` 在所有请求中 byte-for-byte 相同。把动态变量放在 `messages[1]` 可以最大化缓存命中率。

**代价**: prompt 模板不如 `ChatPromptTemplate` 灵活（无 f-string 注入），但换来约 1.5k tokens 的缓存节省。

---

## 4. 积分计费决策

### 4.1 从 Token 计费改为积分计费

**选择**: 使用虚拟"积分"作为计价单位（而非按 API Token 直接计费）。

**原因**: 用户不需要理解 Token 概念，积分更直观、价格可控。平台可以在成本和售价之间保持利润空间。

**代价**: `User` 表同时保留了 `tokenUsed`/`tokenBalance` 和 `pointsUsed`/`pointsBalance` 两套字段，`tokenUsed` 字段含义变为 "审计用实际 Token 消耗"。

### 4.2 积分扣费使用原子 SQL

**选择**: `UPDATE User SET pointsBalance = pointsBalance - ? WHERE email = ? AND pointsBalance >= ?`，通过 `rowsAffected === 0` 判定余额不足。

**原因**: SQLite 不支持 `SELECT ... FOR UPDATE` 行锁，原子 UPDATE + WHERE 条件是 SQLite 下最安全的防超扣方案。

**代价**: 代码里 `deductPoints()` 逻辑相对复杂（先查有没有用户 → 没有就创建 → 再扣），但正确性优先于简洁性。

### 4.3 关键规则：不恢复 pointsBalance=0 的用户

**选择**: `ensureUser()` 只恢复 `pointsBalance IS NULL` 的用户（真正的数据缺失），不恢复 `pointsBalance = 0` 的用户（正常花完了积分）。

**原因**: 防止给已经用完积分的用户意外赠送积分。`NULL` 代表创建失败或数据异常；`0` 代表正常消耗完。

---

## 5. 部署决策

### 5.1 Docker 多阶段构建（deps → builder → runner）

**选择**: `deps` 阶段用 `npm ci --ignore-scripts`（防止 prisma postinstall 挂死），`builder` 阶段手动 `prisma generate` + `npm run build` + `prisma db push`，`runner` 阶段仅复制最终产物，运行非 root `nextjs` 用户。

**原因**: 历史问题 — prisma 的 postinstall 脚本在 CI 中下载引擎 binary 会无限挂死。分离阶段后可以精确控制每一步的执行。

### 5.2 CI 强制 no-cache

**选择**: `deploy.yml` 中 `docker/build-push-action` 设置 `no-cache: true`。

**原因**: Buildx 的 `cache-to: mode=max` 曾导致新构建的 manifest 未推送到 ghcr.io，生产部署拿到旧镜像。强制无缓存构建确保每次都是干净镜像。

**代价**: 每次构建都是全量 build，没有 Docker layer 缓存，构建时间更长。

### 5.3 docker-compose.yml 用 build: 而非 image: (临时状态)

**选择**: 当前 docker-compose.yml 使用 `build:` 本地构建而非从 ghcr.io 拉镜像。这是 **临时状态/配置不一致**，而非有意为之的设计决策。目标是修复为 `image:`（见 PROBLEM A）。

**原因**: 早期开发阶段本地构建方便调试，但项目进入生产部署后未同步切换。CI 已能正确推送 ghcr.io 镜像，但 docker-compose 配置滞后。

---

## 6. 前后端接口设计决策

### 5.4 Nginx proxy_cache 与 Next.js chunk 缓存冲突 (2026-05-25 排障记录)

**现象**: 前端容器更新后，直接访问 `https://mpflowapp.com/editor` 报 ChunkLoadError（浏览器请求旧 chunk 返回 404），但 `/editor?t=xxx` 或直连 `127.0.0.1:3000/editor` 正常。

**根因**: 宝塔 Nginx 启用了全局 `proxy_cache cache_one`（缓存目录 `/www/server/nginx/proxy_cache_dir`），缓存了 `/editor` 首次请求的 HTML 响应。容器更新后 chunk 文件名变化，但 Nginx 仍返回缓存中的旧 HTML（引用已不存在的旧 chunk）。

**验证**: `curl 127.0.0.1:3000/editor` 返回新 chunk → `curl https://mpflowapp.com/editor` 返回旧 chunk → 清理 proxy_cache_dir 后域名访问也正常。

**解决**: `find /www/server/nginx/proxy_cache_dir -mindepth 1 -delete && nginx -s reload`

**后续决策**:
- `/editor` 页面已通过 Server Component wrapper + `force-dynamic`/`force-no-store` 设置 `Cache-Control: no-store`，但 Nginx `proxy_cache` 默认忽略源站的 no-store 头，需要显式配置 `proxy_cache_bypass` 或 `proxy_no_cache`。
- 建议对 Next.js 页面路径（`/`、`/editor`、`/admin` 等）禁用 proxy_cache，仅对 `/_next/static/` 这种带 content hash 的静态资源启用缓存。
- 每次前端部署后应主动清理 Nginx proxy_cache_dir（可加入 CI 部署脚本最后一步）。

### 6.1 SSE 流式生成

**选择**: 文章生成使用 Server-Sent Events (`text/event-stream`)，而非 WebSocket 或轮询。

**原因**:
- SSE 比 WebSocket 简单（单向推送足够文章生成场景）
- Nginx 原生支持 SSE（`proxy_buffering off`）
- 前端可以用 `for await...of` 在 `ReadableStream` 上迭代

### 6.2 图片获取三级 fallback

**选择**: DALL-E 3 → Pexels → Picsum 随机图。

**原因**:
- DALL-E 质量最高但需要 OpenAI API 且较贵
- Pexels 免费但结果相关性有限
- Picsum 提供确定性随机图作为最后兜底，确保文章至少有一张图

### 6.3 两套 API 实现共存

**现状**: Python FastAPI 的 `/api/generate` 和 Next.js 的 `/api/generate` 是两套独立实现：
- Python: 搜索(Tavily/Serper) → LLM 润色(DeepSeek via LangChain) → 图片(Pexels/DALL-E)
- Next.js: Unsplash 封面图 → LLM(DeepSeek 直连) → 积分扣费 + 日志

**原因**: 历史迭代产物。Python 后端是后期加入的，Next.js 版最初是唯一实现。

**未来方向**: 需要决定以哪个为主，或合并两者的优点。Python 版有更好的搜索和图片生态；Next.js 版有更完善的积分扣费和 Unsplash 封面图。**当前 Nginx 在生产环境路由到 Python 版**（如果按仓库 nginx.conf 配置），但 Next.js 版仍然可用。

---

## 7. 临时方案标记

| 方案 | 说明 | 何时修 |
|------|------|--------|
| Docker DB 烧录 | 为绕过 EACCES 在 builder 阶段 prisma db push | 数据持久化方案就绪后可改为启动脚本检查 schema |
| docker-compose build: | 应该改成 image: 但还没改 | P0 — 尽快 |
| logout 硬编码 URL | Logto 端点和 client ID 写死在代码里 | P2 — 有需求时改 |
| Editor.tsx 残留组件 | 疑似早期版本，无引用 | 确认后删除 |
| 两套认证并存 | 自定义 JWT + NextAuth 同时存在 | 统一认证链路时清理 |
| 两套 /api/generate | Python 版和 Next.js 版独立实现 | 决定主路径后清理或统一 |

---

## 8. 未来可能需要重构的地方

1. **统一 API 路由策略**: 决定 `/api/generate` 以 Python 还是 Next.js 为主，清理另一套。
2. **认证统一**: 保留自定义 JWT 路线或完全切换到 NextAuth，移除两套并存。

---

## 9. 积分扣费设计决策 (2026-05-26 — 2026-05-27)

### 9.1 点击即扣（非生成后扣）

**选择**: 用户点击"开始生成"后立即扣分，生成成功/失败/中断均不退分。

**原因**:
- 生成后扣分需要 Python FastAPI 支持（当前 Python 后端无积分逻辑），增加跨服务复杂度
- 前端在扣分成功后调用 `/api/generate`，扣分失败则阻断生成
- 避免用户生成完成后网络断开导致漏扣

**代价**:
- 用户中断生成不退分 → 未来需考虑退款系统
- 如果扣分成功但 `/api/generate` 调用失败（非余额问题），用户损失积分

### 9.2 服务端 action → cost 查表

**选择**: POST 接口不接收客户端传来的 `points` 数额，只接收 `action` 字符串，服务端查表映射成本。

**关键约束**:
- 前端只传 `{ action: "article_generate" }`，不传数额
- 服务端 `ACTION_COSTS` 字典是唯一计费入口
- 未知 action → 400；已注册 action → 固定 cost
- `typeof body.action === "string"` + `ACTION_COSTS[action]` 双重校验

### 9.3 主键 id 原子扣减

**选择**: `deductPoints()` 先查用户获取 `id`（UUID），再用 `WHERE id = ?` 做原子扣减。

**原因**:
- email 大小写不一致 → 查找回退 name 但扣减用 email → `rowsAffected = 0` → 误报积分不足
- name 不是唯一键，同名用户有风险
- `id` 是主键 UUID，绝对唯一，彻底消除匹配歧义

**SQL**:
```sql
UPDATE User SET pointsBalance = pointsBalance - ? WHERE id = ? AND pointsBalance >= ?
```

### 9.4 Email 大小写不敏感查询

**选择**: 新增 `normalizeEmail()` → `email.trim().toLowerCase()`，所有 email 查询改为 `WHERE LOWER(email) = ?`。

**影响函数**: `ensureUser`、`getUserPoints`、`deductPoints` 全部统一。

**代价**: `LOWER(email)` 无索引命中，SQLite 全表扫描。用户表规模极小，无性能影响。

### 9.5 文章生成统一 1 积分

**选择**: 文章生成从动态定价（按字数计算）简化为固定 1 积分/次。

**原因**: 计费规则简化——前端按钮、后端扣费、日志显示三者必须一致。动态定价逻辑（`calculatePoints` 依赖 wordCount/pricing）与后端 action→cost 映射冲突时难以定位。

**实现**: `ACTION_COSTS.article_generate = 1`；`calculatePoints()` 返回常量 1。

### 9.6 配图建议与图片描述分离

**选择**: `image_descriptions` 开关控制正文中是否输出 `【配图建议：...】` 文本占位符。与 AI 智能配图面板（DALL-E 生图）独立。

**规则**:
- `image_descriptions=false` → prompt 不含配图要求 → 纯正文输出
- `image_descriptions=true` → prompt 含配图要求 → 正文含 `【配图建议：...】`
- AI 智能配图面板始终可用，不受此开关影响
- `with_images`（Pexels 自动搜图）暂未从 UI 启用，代码保留但不触发

### 9.7 占位符格式从 Markdown 图片改为纯文本

**选择**: 占位符从 `![配图](IMAGE_PLACEHOLDER_N)` 改为 `【配图建议：详细中文描述 | English keywords】`。

**原因**:
- Markdown 图片语法 `![...](...)` 被 ReactMarkdown 渲染为 `<img src="...">`
- `src="IMAGE_PLACEHOLDER_N"` 不是有效 URL → 浏览器发起请求 → 404
- 纯文本不触发任何 HTTP 请求

**防御**: 前端 ReactMarkdown 添加 `img` 拦截器——`src` 含 `IMAGE_PLACEHOLDER` 时渲染卡片而非 `<img>`，兼容旧内容。
3. **数据库迁移文件**: 当前用 `prisma db push` 自动同步（可能有损），如果数据量大了需要迁移文件 (`prisma migrate`)。
4. **Docker Compose 加内部 Nginx**: 替代依赖宝塔面板手动配置 Nginx，让仓库内 `nginx.conf` 成为真正的部署配置。
5. **前端状态管理**: Editor 页面 (887 行) 是一个巨大的 client component，所有状态在组件内部。如果继续加功能需要考虑提取状态管理或拆分子组件。
