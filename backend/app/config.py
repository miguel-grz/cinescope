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
    # Comma-separated list of allowed CORS origins, e.g. the deployed
    # frontend's URL in production. Defaults cover local Vite dev servers.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5175,http://127.0.0.1:5175"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def sqlalchemy_database_url(self) -> str:
        # Render/Heroku-style providers hand out "postgres://", but
        # SQLAlchemy 2.x + psycopg2 expect the "postgresql://" scheme.
        if self.database_url.startswith("postgres://"):
            return self.database_url.replace("postgres://", "postgresql://", 1)
        return self.database_url


settings = Settings()
