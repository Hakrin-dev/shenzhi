"""Server-only provider settings. Keys never appear in the public config."""
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class ModelConfig:
    key: str
    base_url: str
    model: str
    models: tuple[str, ...]
    provider: str


def model_config() -> ModelConfig:
    dashscope = bool(os.getenv('DASHSCOPE_API_KEY', '').strip())
    prefix = 'DASHSCOPE' if dashscope else 'DEEPSEEK'
    default_url = ('https://dashscope.aliyuncs.com/compatible-mode/v1'
                   if dashscope else 'https://api.deepseek.com/v1')
    model = os.getenv(f'{prefix}_MODEL', 'qwen-plus' if dashscope else 'deepseek-chat').strip()
    models = tuple(dict.fromkeys([model, *filter(None, (
        item.strip() for item in os.getenv('AI_ALLOWED_MODELS', '').split(',')
    ))]))
    return ModelConfig(os.getenv(f'{prefix}_API_KEY', '').strip(),
                       os.getenv(f'{prefix}_BASE_URL', default_url).rstrip('/'),
                       model, models, 'platform' if dashscope else 'deepseek')


MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_FILE_CHARS = 30_000
MAX_ATTACHMENT_CHARS = 60_000
MAX_HISTORY_CHARS = 60_000
MAX_FILES = 5
UPLOAD_ACCEPT = ['.pdf', '.txt', '.md', '.markdown']
