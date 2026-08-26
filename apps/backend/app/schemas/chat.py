from pydantic import BaseModel, Field

class ChatAttachment(BaseModel):
    kind: str
    file_id: str | None = None
    ref_id: str | None = None
    title: str | None = None

class CreateSessionBody(BaseModel):
    type: str = "chat"
    question: str = Field(min_length=1, max_length=2000)
    mode: str = "fast"
    model: str = "deepseek-chat"
    web_search: bool = False
    attachments: list[ChatAttachment] = Field(default_factory=list)

class FollowupBody(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    mode: str | None = None
    model: str | None = None
    web_search: bool | None = None
    attachments: list[ChatAttachment] | None = None

class ExploreBody(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    top_k: int = Field(default=10, ge=1, le=20)
    mode: str = "fast"

