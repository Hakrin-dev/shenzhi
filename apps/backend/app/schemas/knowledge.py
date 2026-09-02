"""知识底座 API 输入 Schema。

字段命名与前端 Contract 对齐（camelCase）：
    topK / yearFrom / yearTo / venue / author / keyword / subject
"""
from __future__ import annotations

from pydantic import BaseModel, Field

__all__ = ["KnowledgeSearchBody"]


class KnowledgeSearchBody(BaseModel):
    query: str = Field(min_length=1, max_length=200)
    topK: int = Field(default=10, ge=1, le=50)

    yearFrom: int | None = Field(default=None, ge=1800, le=2100)
    yearTo: int | None = Field(default=None, ge=1800, le=2100)

    venue: list[str] = Field(default_factory=list)
    author: list[str] = Field(default_factory=list)
    keyword: list[str] = Field(default_factory=list)
    subject: list[str] = Field(default_factory=list)
