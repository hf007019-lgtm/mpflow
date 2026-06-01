import json
import re
from app.agents.polish_agent import build_polish_chain
from app.agents.image_agent import generate_images
from app.services.search_service import search_news


def _auto_insert_placeholders(markdown: str) -> str:
    """If the LLM forgot to add 【配图建议】 markers, inject them after each ## heading."""
    if re.search(r'【配图建议：', markdown):
        return markdown

    n = 0
    def _replace(m):
        nonlocal n
        n += 1
        return m.group(0) + f"\n\n【配图建议：请根据上下文为本章节生成详细的配图画面描述，包括主体、构图、场景、色调与风格。 | illustration for article section, cinematic, professional】\n"

    markdown = re.sub(r'^(## .+)$', _replace, markdown, flags=re.MULTILINE)
    return markdown


def _strip_placeholders(markdown: str) -> str:
    """Remove any 【配图建议：...】 blocks the LLM may have generated when image_descriptions is off."""
    return re.sub(r'\n*【配图建议：[^】]+】\n*', '\n\n', markdown)


async def generate_article(
    topic: str,
    language: str = "zh-CN",
    word_count: int = 1500,
    with_images: bool = True,
    image_descriptions: bool = False,
    additional_instructions: str = "",
) -> dict:
    """
    Main article generation pipeline (non-streaming, for legacy / batch use):
    1. Search for latest news on the topic
    2. Polish into a readable article with the "去AI味" prompt
    3. Auto-insert images
    """
    # Step 1: Search
    search_results, answer = await search_news(topic, max_results=8)

    # Build search material for the LLM
    lines = ["## 搜索概览\n"]
    if answer:
        lines.append(f"**AI 摘要**: {answer}\n")
    for i, r in enumerate(search_results, 1):
        lines.append(f"{i}. **{r['title']}**")
        lines.append(f"   {r['snippet'][:300]}")
        lines.append(f"   来源: {r['url']}\n")

    search_material = "\n".join(lines)
    search_summary = f"找到 {len(search_results)} 条相关资讯"

    # Step 2: Polish
    polish_chain = build_polish_chain()
    markdown = await polish_chain.ainvoke({
        "topic": topic,
        "word_count": word_count,
        "language": language,
        "additional_instructions": additional_instructions or "无特殊要求",
        "search_material": search_material,
        "image_descriptions": image_descriptions,
    })

    # Post-process: inject or strip placeholders based on toggle
    if image_descriptions:
        markdown = _auto_insert_placeholders(markdown)
    else:
        markdown = _strip_placeholders(markdown)

    # Step 3: Images
    image_count = 0
    if with_images:
        markdown = _auto_insert_placeholders(markdown)
        markdown = await generate_images(markdown, topic)
        image_count = len(re.findall(r'!\[.*?\]\(https?://', markdown))

    return {
        "markdown": markdown,
        "search_summary": search_summary,
        "image_count": image_count,
    }


async def generate_article_stream(
    topic: str,
    language: str = "zh-CN",
    word_count: int = 1500,
    with_images: bool = True,
    image_descriptions: bool = False,
    additional_instructions: str = "",
):
    """
    Streaming article generation — yields SSE-formatted chunks.
    Frontend expects: data: {"content": "..."}\n\n  ...  data: [DONE]\n\n
    """
    # Step 1: Search (non-streaming — yield summary as first event)
    search_results, answer = await search_news(topic, max_results=8)

    lines = ["## 搜索概览\n"]
    if answer:
        lines.append(f"**AI 摘要**: {answer}\n")
    for i, r in enumerate(search_results, 1):
        lines.append(f"{i}. **{r['title']}**")
        lines.append(f"   {r['snippet'][:300]}")
        lines.append(f"   来源: {r['url']}\n")
    search_material = "\n".join(lines)
    search_summary = f"找到 {len(search_results)} 条相关资讯"

    yield f"data: {json.dumps({'content': f'> 🔍 {search_summary}\n\n'}, ensure_ascii=False)}\n\n"

    # Step 2: Stream LLM polish output token-by-token
    polish_chain = build_polish_chain()
    full_text = ""
    async for chunk in polish_chain.astream({
        "topic": topic,
        "word_count": word_count,
        "language": language,
        "additional_instructions": additional_instructions or "无特殊要求",
        "search_material": search_material,
        "image_descriptions": image_descriptions,
    }):
        full_text += chunk
        yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"

    # Post-process: if image_descriptions is on and LLM forgot markers, inject them
    if image_descriptions:
        fixed = _auto_insert_placeholders(full_text)
        if fixed != full_text:
            delta = fixed[len(full_text):]
            full_text = fixed
            yield f"data: {json.dumps({'content': delta}, ensure_ascii=False)}\n\n"

    # Step 3: Images (post-stream — replace PLACEHOLDERs with real URLs)
    if with_images and full_text:
        try:
            text_with_placeholders = _auto_insert_placeholders(full_text)
            text_with_images = await generate_images(text_with_placeholders, topic)
            # Only yield if images were actually added (content changed)
            if text_with_images != text_with_placeholders:
                # Extract the image-heavy portions to append
                image_parts = text_with_images[len(text_with_placeholders):]
                if not image_parts:
                    image_parts = "\n\n" + text_with_images[len(full_text):]
                if image_parts.strip():
                    yield f"data: {json.dumps({'content': image_parts}, ensure_ascii=False)}\n\n"
        except Exception:
            pass  # image failure is non-fatal for streaming

    yield "data: [DONE]\n\n"
