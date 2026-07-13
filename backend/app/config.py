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
    # Session cookie: signs a JWT stored as an httpOnly cookie. No default —
    # startup fails if it's missing, so a real deployment can't run with a
    # blank/guessable secret.
    jwt_secret: str
    jwt_expire_days: int = 7
    # False/"lax" work over plain HTTP when frontend and backend share a
    # host (e.g. localhost:5173 <-> localhost:8000 — same-site by the
    # "site" definition, which ignores port). Cross-origin production
    # deploys (different domains) need True/"none", set via env.
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
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
