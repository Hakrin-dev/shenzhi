from typing import Literal
from pydantic import BaseModel, Field, field_validator

ReplyMode = Literal['fast', 'deep', 'idea', 'doubt']


class ChatAttachment(BaseModel):
    kind: Literal['file', 'paper', 'patent', 'funding', 'scholar', 'institution', 'session', 'project']
    file_id: str | None = Field(default=None, max_length=100)
    ref_id: str | None = Field(default=None, max_length=200)
    title: str | None = Field(default=None, max_length=500)


class CreateSessionBody(BaseModel):
    type: Literal['chat', 'research'] = 'chat'
    question: str = Field(min_length=1, max_length=2000)
    mode: ReplyMode = 'fast'
    model: str = Field(default='default', max_length=100)
    web_search: bool = False
    attachments: list[ChatAttachment] = Field(default_factory=list, max_length=5)

    @field_validator('question')
    @classmethod
    def nonblank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError('请输入问题')
        return value.strip()


class FollowupBody(CreateSessionBody):
    mode: ReplyMode | None = None
    model: str | None = Field(default=None, max_length=100)
    web_search: bool | None = None


class UpdateSessionBody(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=100)
    favorite: bool | None = None


class ExploreBody(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    top_k: int = Field(default=10, ge=1, le=20)
    mode: ReplyMode = 'fast'
