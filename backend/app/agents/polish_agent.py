from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableLambda
from app.config import settings


# ============================================================
# Static System Prompt — NEVER modified, NEVER has f-string /
# template injection. This is the DeepSeek cache prefix.
# The exact bytes of this string must be identical across
# every API request for cache hits on the first N tokens.
# ============================================================
SYSTEM_PROMPT = """你是一位百万粉丝的公众号博主，以犀利、接地气、有态度的文风著称。

## 你的写作铁律
1. **去AI味**：严禁使用以下词汇和句式：
   - 禁止：「总而言之」「总的来说」「在这个时代」「随着……的发展」「众所周知」「不可否认」
   - 禁止：「不仅……而且……」「一方面……另一方面……」等模板句式
   - 禁止：空洞的排比句、喊口号、灌鸡汤
2. **短句为王**：每句话不超过 25 个字。一段不超过 4 句话。多用句号，少用逗号。
3. **博主口吻**：像在跟朋友聊天，有观点有态度。敢下判断，不模棱两可。用「你」拉近距离，用「我」表达立场。
4. **开门见山**：第一段直接抛出核心观点或最炸裂的事实。不要铺垫。
5. **信息密度**：每一句都带信息量。不写正确的废话。

## 格式规范
- 严格输出 Markdown，适配微信公众号
- 标题用 `##` 开头（公众号最佳阅读体验）
- 每个小标题下配一段实质内容
- 文末加一句个人观点总结，用 `> ` 引用块包裹"""


# ============================================================
# User message builder — ALL dynamic variables are confined
# to the user message (index [1]) and NEVER leak into the
# system message (index [0]).
# ============================================================
def _build_user_message(params: dict) -> str:
    msg = (
        "根据以下搜索素材，写一篇公众号文章。\n\n"
        f"【主题】{params['topic']}\n"
        f"【目标字数】约 {params['word_count']} 字\n"
        f"【语言】{params['language']}\n"
        f"【额外指令】{params['additional_instructions']}\n\n"
        "【搜索素材】\n"
        f"{params['search_material']}\n\n"
    )
    if params.get("image_descriptions"):
        msg += (
            "【配图要求】在每个 ## 二级标题下方插入配图建议，"
            "格式为：【配图建议：详细中文画面描述（主体、构图、场景、色调、风格，不少于60字）"
            " | English keywords for image generation】（N 从 1 开始递增）。"
            "这是强制要求，不可省略。不要使用 Markdown 图片语法，不要生成任何图片 URL。\n\n"
        )
    msg += "请开始写作。记住：短句、有态度、去AI味。"
    return msg


def _build_messages(params: dict) -> list:
    """Construct messages with static system prompt at [0] for DeepSeek prefix cache."""
    return [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=_build_user_message(params)),
    ]


def build_polish_chain():
    """Return a chain that builds cache-friendly messages, then invokes the LLM.

    DeepSeek context caching uses strict prefix matching on the messages
    array.  Keeping SYSTEM_PROMPT (index [0]) byte-identical across all
    requests means the first ~1.5k tokens are always served from cache.
    """
    llm = ChatOpenAI(
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
        model=settings.openai_model,
        temperature=0.8,
    )
    return RunnableLambda(_build_messages) | llm | StrOutputParser()
