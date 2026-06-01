from pydantic import BaseModel, Field


class ArticleRequest(BaseModel):
    topic: str = Field(
        ...,
        min_length=2,
        max_length=500,
        description="文章主题",
        pattern=r"^[^\x00-\x1f\x7f]+$",
    )
    language: str = Field(default="zh-CN", min_length=2, max_length=10)
    word_count: int = Field(default=1500, ge=500, le=5000)
    with_images: bool = Field(default=True)
    image_descriptions: bool = Field(default=False)
    additional_instructions: str = Field(default="", max_length=500)


class ArticleResponse(BaseModel):
    markdown: str
    search_summary: str = ""
    image_count: int = 0


class ImageGenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000, description="DALL-E 生图提示词")
    count: int = Field(default=1, ge=1, le=4, description="生成数量 (1-4)")


class ImageGenerateResponse(BaseModel):
    images: list[dict]  # [{"url": "https://..."} | {"error": "..."}]

