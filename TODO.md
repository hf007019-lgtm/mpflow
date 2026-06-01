# TODO.md — MPFlow 待办清单

> 优先级定义: P0 = 影响部署/数据安全, 需立即修复 | P1 = 影响功能正确性 | P2 = 代码质量/安全/清理

---

## P0 — 部署与数据安全 (需先修)

### A: docker-compose.yml 从 build: 改为 image: 以使用 ghcr.io 镜像

- **现状**: CI 构建并推送镜像到 ghcr.io，但 docker-compose.yml 用的是 `build:` 本地构建，`docker compose pull` 不生效。每次部署都在服务器上重新 `npm install` + `npm run build`，浪费 CI 构建 + 部署时间长。
- **目标**: docker-compose.yml 改为 `image: ghcr.io/hf007019-lgtm/mpflow/mp-frontend:latest` (frontend) 和 `image: ghcr.io/hf007019-lgtm/mpflow/mp-backend:latest` (backend)，让 `docker compose pull` 拉取 CI 已构建好的镜像。
- **注意**: 需要同步修改环境变量传递方式（build args → runtime env），因为 image 模式下不能再用 `args:`，运行时变量要用 `environment:`。

### D: SQLite 数据持久化

- **现状**: docker-compose.yml 没有 `volumes:` 挂载。SQLite 数据库文件 (`/app/prisma/dev.db`) 在容器内，`docker compose down && up -d` 重建容器会导致所有用户、积分、生成日志数据丢失。
- **目标**: 为 frontend 容器添加 volume 挂载，将 `/app/prisma/` 目录映射到宿主机持久化路径（如 `/www/wwwroot/mpflow/data/`）。需要确保 nextjs 用户 (uid 1001) 对该目录有读写权限。
- **风险**: 如果数据库是在镜像构建时 "烧录" 的（`prisma db push`），volume 挂载后首次启动可能读取空目录导致无表。需要设计启动脚本来处理：如果 volume 为空 → 初始化 schema → 继续；如果已有数据 → 跳过。

### F: 宝塔 Nginx 配置文档化 + 修复漏转路由

- **已确认 (2026-05-25)**: 生产环境宝塔 Nginx 已有精细分流规则：
  - `/api/auth/` → Next.js 3000（登录/注册/回调）
  - `/api/user/` → Next.js 3000（积分查询）
  - `/api/settings/` → Next.js 3000（定价配置）
  - 其余 `/api/` → Python 8100（文章生成/图片生成/健康检查，`proxy_buffering off` 适配 SSE）
  - `/callback/logto` 无单独 location，走 `location /` 到 Next.js 3000
  - **结论**: 核心认证链路路由正确，生产可正常工作。

- **待修复 F1 — 缺少 `/api/admin/` 转发**:
  - 当前宝塔配置没有 `/api/admin/` 的 location，请求会被 `location /api/` 捕获转发到 Python 8100。Python 后端没有管理 API，导致后台仪表盘/用户管理/系统设置等 API 全部不可用。

- **待修复 F2 — `/api/user` 和 `/api/settings` 无尾斜杠匹配**:
  - 宝塔配置仅匹配 `/api/user/` 和 `/api/settings/`（带尾斜杠）。如果前端请求 `/api/user` 或 `/api/settings`（无尾斜杠），会被 `location /api/` 捕获转发到 Python 8100。

- **目标**: 在宝塔 Nginx 中新增 `/api/admin/` 的 location 转发到 Next.js 3000，并为 `/api/user` 和 `/api/settings` 添加不带尾斜杠的精确匹配规则。同步更新仓库内 `nginx.conf`。

---

## P1 — 功能正确性

### B: image_descriptions 参数前后端对齐 ✅ 已修复 (2026-05-27)

- **修复内容**:
  1. `ArticleRequest` 模型新增 `image_descriptions: bool = False`
  2. Router 将 `req.image_descriptions` 传入 `generate_article_stream()`
  3. `article_agent.py` 新增参数并传入 polish chain
  4. `polish_agent.py` System Prompt 移除无条件配图要求 → 改为 `_build_user_message()` 中条件性追加
  5. `_auto_insert_placeholders()` 仅在 `image_descriptions=true` 时调用
  6. 前端 ReactMarkdown 添加 img 拦截器兼容旧 `IMAGE_PLACEHOLDER` 内容
  7. 前端 `generate/route.ts` System Prompt 同步移除无条件配图要求
- **验证**: 开关关闭 → 文章无【配图建议】；开关打开 → 文章含【配图建议】

---

## P2 — 代码质量与安全

### C: with_images 功能状态清理

- **现状**: Editor 页面 `withImages` 状态初始化为 `false`，旧的 "自动配图" toggle 已从 UI 中移除（被 AI 生图面板替代）。后端 `article_agent.py` 中完整的 Pexels → DALL-E → Picsum fallback 链路不会被触发。代码保留但不生效。
- **目标**: 暂不删除代码。在 `article_agent.py` 的 `generate_article_stream()` 上方加注释说明 "with_images Pexels auto-search is currently routed but not enabled from the frontend UI"。

### E: docker-compose.yml 密钥明文

- **现状**: `AUTH_SECRET`、`AUTH_LOGTO_SECRET` 硬编码在 `docker-compose.yml` 的 `environment:` 段。这些值已暴露在 Git 仓库中。
- **目标**: 将敏感环境变量移到 `.env` 文件（不提交到 Git），在 docker-compose.yml 中使用 `env_file:` 或 `${VAR}` 引用。需要轮换已在仓库历史中暴露的密钥（尤其是 `AUTH_SECRET`，它用于 JWT 签名，泄露后攻击者可伪造任意用户 session）。

### G: 清理疑似遗留组件

- **现状**: `frontend/src/components/Editor.tsx` 是独立编辑器组件，与当前 `/editor` 页面是不同实现。grep 确认无任何地方 import 它。
- **目标**: 确认无引用后删除。在删除前先确保没有动态 import 或 lazy load 的引用。

### H: logout 路由硬编码 → 环境变量

- **现状**: `frontend/src/app/api/auth/logout/route.ts` 硬编码了 Logto endpoint (`https://auth.mpflowapp.com/oidc/session/end`) 和 client ID (`7kwqlhcieixzn90fxuz6i`)。
- **目标**: 改为读取 `AUTH_LOGTO_ISSUER` 和 `AUTH_LOGTO_ID` 环境变量，与其他 auth 路由保持一致。

---

## 上线前检查清单

- [ ] 数据库持久化已验证：重启容器后用户数据不丢失
- [ ] 部署流程端到端测试：push → CI 构建成功 → 镜像推送 ghcr.io → 服务器 pull 成功 → 容器启动
- [ ] Nginx 路由确认：登录/注册/积分/后台功能在通过域名访问时正常
- [ ] HTTPS 证书配置正确（宝塔面板 Let's Encrypt 自动续期）
- [ ] 密钥已从 docker-compose.yml 和 Git 历史中移除/轮换
- [x] Auth 全链路测试：注册 → 登录 → 积分入账 → 生成文章 → 扣费 ✅ 2026-05-27
- [x] 积分扣减逻辑：GET 显示余额与 POST 扣分一致 ✅ 2026-05-27
- [ ] 文章生成超时处理（120s 前后端对齐）
- [ ] 移动端编辑页基本可用（非桌面端也能编辑复制）
- [x] IMAGE_PLACEHOLDER 404 已修复：不再输出 Markdown 图片语法 ✅ 2026-05-27
- [x] 前端部署后检查 Nginx proxy_cache 是否导致旧 HTML 缓存 ✅ 2026-05-25

---

## 后续可做的优化 (非紧急)

- [ ] 测试覆盖（项目目前无测试文件，零测试）
- [ ] 错误监控接入 (Sentry / 自建日志聚合)
- [ ] 积分充值支付对接 (微信支付 / 支付宝)
- [ ] 微信草稿箱 API 对接 (直接发布到公众号后台)
- [ ] 文章历史云端存储 (替换 localStorage 方案)
- [ ] 多模型 A/B 对比支持
- [ ] API 文档生成 (FastAPI 自带 /docs 已有 Swagger UI)
- [ ] Docker Compose 添加内部 Nginx 容器 (替代依赖宝塔面板 nginx)
- [ ] 健康检查 + 自动重启策略完善
- [ ] 后端 `.env.example` 补全 `DALLE_API_KEY` 字段
- [ ] 前端 `image_descriptions` 开关的 UI 提示说明当前功能不完整

---

## CLAUDE.md 可能需要更新的地方 (待确认后修改)

1. **Nginx routing 段 (行 105-115)**: 当前用三个 "可能" 解释 `/api/` 路由问题，含糊不清。需在确认 F 后用确定的配置替换。
2. **Commands 段 (行 88-103)**: `docker compose pull` 在当前 docker-compose.yml 下无效（无 `image:` 字段）。需在修复 A 后更新。
3. **缺少已知问题记录**: CLAUDE.md 是给 AI 看的参考文档，建议在末尾增加 "Known Issues" 小节引用 PROJECT_STATUS.md。
4. **缺少 `image_descriptions` 不一致的说明**: 应在 Key architectural facts 段补充此参数缺口。
5. **缺少 `Editor.tsx` 残留组件说明**: 如果在清理 G 之前，加一句说明。
6. **`with_images` 自动配图功能状态**: 说明此功能在后端完整但前端 UI 已移除，当前不会被触发。
