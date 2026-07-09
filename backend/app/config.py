from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    tmdb_api_key: str
    tmdb_base_url: str = "https://api.themoviedb.org/3"
    database_url: str = "sqlite:///./cinescope.db"
    default_region: str = "CO"
    default_language: str = "es-ES"
    cache_ttl_seconds: int = 600
    cache_max_size: int = 2048


settings = Settings()
