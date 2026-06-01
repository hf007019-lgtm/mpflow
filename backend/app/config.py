from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # LLM
    openai_api_key: str = ""
    openai_base_url: str = "https://api.deepseek.com"
    openai_model: str = "deepseek-chat"

    # DALL-E 生图 (独立 key，不填则 fallback 到 openai_api_key)
    dalle_api_key: str = ""

    # Search
    tavily_api_key: str = ""
    serper_api_key: str = ""

    # Images — Pexels (free: 200 req/h), unsplash.com source API is deprecated
    pexels_api_key: str = ""

    # Auth
    auth_token: str = ""
    auth_secret: str = ""
    database_url: str = "file:/app/data/dev.db"
    price_ai_image: int = 20
    internal_billing_url: str = "http://frontend:3000/api/internal/billing/deduct"
    internal_api_token: str = ""

    # CORS — comma-separated origins
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Rate limit
    rate_limit: str = "20/minute"
    enable_docs: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
