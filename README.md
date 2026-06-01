# MP News Agent

公众号文章创作助手：全球新闻搜索 → AI 去味润色 → 自动配图 → 输出 Markdown。

---

## 上架部署（给你的用户用）

### 前置条件

- 一台服务器（Linux 推荐），安装 Docker 和 Docker Compose
- 一个域名，DNS 解析到服务器 IP
- 服务器防火墙开放 **80** 和 **443** 端口

### 第 1 步：上传代码到服务器

```bash
scp -r mp-news-agent/ user@你的服务器IP:~/
ssh user@你的服务器IP
cd mp-news-agent
```

### 第 2 步：配置

**`backend/.env`** — 填入 API Key：

```ini
OPENAI_API_KEY=sk-你的deepseek-key
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat
TAVILY_API_KEY=tvly-你的key
PEXELS_API_KEY=你的pexels-key
AUTH_SECRET=生成一个新的随机 JWT 签名密钥
AUTH_TOKEN=仅内部兼容使用，不要暴露到浏览器
INTERNAL_API_TOKEN=生成一个新的内部扣费令牌
RATE_LIMIT=10/minute
```

**`.env`**（项目根目录）— 填域名和鉴权：

```ini
DOMAIN=你的域名.com
NEXT_PUBLIC_APP_URL=https://mpflowapp.com
AUTH_SECRET=与 backend/.env 里的 AUTH_SECRET 一致
INTERNAL_API_TOKEN=与 backend/.env 里的 INTERNAL_API_TOKEN 一致
```

### 第 3 步：切换生产 Caddyfile

```bash
# 本地开发用的 HTTP 版 → 生产用 HTTPS 自动版
cp Caddyfile.production Caddyfile
```

### 第 4 步：取消 HTTPS 端口注释

编辑 `docker-compose.yml`，删掉 443 那行的 `#` 注释：

```yaml
ports:
  - "80:80"
  - "443:443"        # ← 删掉行首的 #
```

### 第 5 步：启动

```bash
docker compose up -d
```

等 30 秒。Caddy 会自动向 Let's Encrypt 申请免费 HTTPS 证书。

### 第 6 步：验证

浏览器打开 `https://你的域名.com`，输入主题测试生成。

---

## 本地开发

### 后端

```bash
cd backend
cp .env.example .env  # 编辑填入 key
pip install -r requirements.txt
python -m app.main      # → :8000
```

### 前端

```bash
cd frontend
npm install
npm run dev             # → :3000
```

本地开发时，编辑 `frontend/.env.local`：

```ini
NEXT_PUBLIC_API_URL=
AUTH_SECRET=与 backend .env 中 AUTH_SECRET 一致
INTERNAL_API_TOKEN=与 backend .env 中 INTERNAL_API_TOKEN 一致
```

---

## 环境变量参考

| 变量 | 位置 | 必填 | 说明 |
|------|------|------|------|
| `OPENAI_API_KEY` | backend/.env | 是 | DeepSeek/OpenAI Key |
| `OPENAI_BASE_URL` | backend/.env | 是 | `https://api.deepseek.com` |
| `OPENAI_MODEL` | backend/.env | 是 | `deepseek-chat` |
| `TAVILY_API_KEY` | backend/.env | 推荐 | 搜索 API |
| `PEXELS_API_KEY` | backend/.env | 推荐 | 图片匹配 |
| `AUTH_SECRET` | backend/.env + 根 .env | 生产必填 | JWT 签名与后端校验 |
| `INTERNAL_API_TOKEN` | backend/.env + 根 .env | 生产必填 | Docker 内网扣费接口鉴权，不暴露到浏览器 |
| `DOMAIN` | 根 .env | 生产必填 | 你的域名 |
| `NEXT_PUBLIC_APP_URL` | 根 .env | 生产必填 | 生产应用外部访问地址，例如 `https://mpflowapp.com` |
| `RATE_LIMIT` | backend/.env | 可选 | 默认 10/min |

---

## 安全清单

- [x] API 鉴权（Bearer Token）
- [x] 接口限流（10次/分钟/人）
- [x] 输入清洗（控制字符过滤、长度限制）
- [x] 安全响应头（nosniff/XSS/frame/Referrer）
- [x] 全局异常捕获（不暴露堆栈）
- [x] HTTPS（Caddy 自动 Let's Encrypt）
- [ ] 定期轮换 `AUTH_SECRET`、`INTERNAL_API_TOKEN` 和第三方 API Key
- [ ] 服务器开启防火墙（仅开放 80/443）

---

## API

```
POST /api/generate
Cookie: authjs.session-token=<登录后自动携带>
Content-Type: application/json

{
  "topic": "AI芯片2026竞争格局",
  "word_count": 1500,
  "with_images": true,
  "additional_instructions": "重点对比英伟达和华为"
}
```
