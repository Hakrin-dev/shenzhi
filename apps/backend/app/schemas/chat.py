from typing import Literal
from pydantic import BaseModel, Field, field_validator

ReplyMode = Literal['fast', 'deep', 'idea', 'doubt']


class KnowledgeCapability(BaseModel):
    enabled: bool = False


class ChatCapabilities(BaseModel):
    knowledge: KnowledgeCapability = Field(default_factory=KnowledgeCapability)


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
    capabilities: ChatCapabilities = Field(default_factory=ChatCapabilities)
    # Compatibility-only input adapter. Chat orchestration reads the nested
    # capabilities contract, never this legacy spelling.
    smart_search: bool | None = Field(
        default=None, validation_alias='smartSearch', exclude=True
    )

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
    capabilities: ChatCapabilities | None = None
    smart_search: bool | None = Field(
        default=None, validation_alias='smartSearch', exclude=True
    )


class UpdateSessionBody(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=100)
    favorite: bool | None = None


def capabilities_for_body(
    body: CreateSessionBody | FollowupBody,
) -> dict[str, dict[str, bool]] | None:
    """Normalize the legacy smartSearch input at the Chat API boundary."""
    configured = body.capabilities
    legacy = body.smart_search
    if configured is None:
        return None if legacy is None else {'knowledge': {'enabled': legacy}}
    if legacy is not None and 'capabilities' not in body.model_fields_set:
        return {'knowledge': {'enabled': legacy}}
    return configured.model_dump()


class AnonymousClaimResult(BaseModel):
    moved_count: int = Field(ge=0)
    skipped_streaming_count: int = Field(ge=0)
    durable: bool
