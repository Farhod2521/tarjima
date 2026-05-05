from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str = ""
    openai_model: str = "gpt-5.4-mini"
    openai_translation_model: str = ""
    openai_reasoning_effort: str = "low"
    openai_timeout_seconds: float = 60.0
    max_file_size_mb: int = 200
    chunk_size_chars: int = 3000
    max_parallel_chunks: int = 4
    max_parallel_translations: int = 4
    allowed_origins: str = "*"

    @property
    def translation_model(self) -> str:
        return self.openai_translation_model or self.openai_model

    @property
    def cors_origins(self) -> list[str]:
        if self.allowed_origins.strip() == "*":
            return ["*"]
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
