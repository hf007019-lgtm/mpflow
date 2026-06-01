import httpx
from typing import Optional
from app.config import settings


async def search_tavily(query: str, max_results: int = 8) -> list[dict]:
    """Search using Tavily API."""
    url = "https://api.tavily.com/search"
    payload = {
        "api_key": settings.tavily_api_key,
        "query": query,
        "search_depth": "advanced",
        "max_results": max_results,
        "include_answer": True,
    }
    async with httpx.AsyncClient(timeout=30.0, trust_env=False) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results", [])
        answer = data.get("answer", "")
        return [{"title": r["title"], "snippet": r.get("content", r.get("snippet", "")), "url": r["url"]} for r in results], answer


async def search_serper(query: str, max_results: int = 8) -> list[dict]:
    """Search using Serper.dev (Google Search API)."""
    url = "https://google.serper.dev/search"
    headers = {"X-API-KEY": settings.serper_api_key, "Content-Type": "application/json"}
    payload = {"q": query, "num": max_results}
    async with httpx.AsyncClient(timeout=30.0, trust_env=False) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        organic = data.get("organic", [])
        return [{"title": r["title"], "snippet": r.get("snippet", ""), "url": r.get("link", "")} for r in organic], ""


async def search_news(query: str, max_results: int = 8) -> tuple[list[dict], str]:
    """Dispatch to available search engine."""
    if settings.tavily_api_key:
        return await search_tavily(query, max_results)
    if settings.serper_api_key:
        return await search_serper(query, max_results)
    # Fallback: return empty so the LLM can still write based on its own knowledge
    return [], "搜索服务未配置，文章将基于模型已有知识生成。"
