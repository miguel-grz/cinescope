from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models, tmdb  # noqa: F401 — models must import before create_all
from .config import settings
from .database import Base, engine
from .routers import auth, discover, library, media


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    await tmdb.open_client()
    yield
    await tmdb.close_client()


app = FastAPI(
    title="CineScope API",
    description="Middle layer over TMDB plus CineScope's own library features.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(discover.router, prefix="/api")
app.include_router(media.router, prefix="/api")
app.include_router(library.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
