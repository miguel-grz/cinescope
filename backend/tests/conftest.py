# Must run before any `app.*` import: app/config.py builds its Settings()
# singleton at import time, so these need to already be in the environment.
import os

os.environ.setdefault("TMDB_API_KEY", "test-tmdb-key")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-that-is-at-least-32-bytes-long")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models  # noqa: F401 — registers models on Base.metadata
from app.database import Base, get_db
from app.main import app


@pytest.fixture()
def client():
    # StaticPool: keeps one shared in-memory DB across the multiple
    # connections FastAPI opens per request — without it, each connection
    # would see its own empty :memory: database.
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
