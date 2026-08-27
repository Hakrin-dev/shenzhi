from typing import Literal

from pydantic import BaseModel, Field

SearchMode = Literal['fast', 'deep', 'idea', 'doubt']


class ExploreBody(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    top_k: int = Field(default=10, ge=1, le=20)
    mode: SearchMode = 'fast'
