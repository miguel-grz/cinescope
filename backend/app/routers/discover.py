"""Discovery: home sections, search and filtered browsing."""
import asyncio
from datetime import date
from typing import Optional

from fastapi import APIRouter, Query

from .. import tmdb
from ..config import settings

router = APIRouter(tags=["discover"])

LanguageQuery = Query(default=None, description="TMDB language, e.g. es-ES or en-US")


def _lang(language: Optional[str]) -> str:
    return language or settings.default_language


@router.get("/home")
async def home(language: Optional[str] = LanguageQuery, region: Optional[str] = None):
    """Everything the home page needs in one request."""
    lang = _lang(language)
    reg = region or settings.default_region
    (
        trending_movies,
        trending_tv,
        popular_movies,
        popular_tv,
        top_movies,
        top_tv,
        upcoming,
    ) = await asyncio.gather(
        tmdb.get("/trending/movie/week", language=lang),
        tmdb.get("/trending/tv/week", language=lang),
        tmdb.get("/movie/popular", language=lang, region=reg),
        tmdb.get("/tv/popular", language=lang),
        tmdb.get("/movie/top_rated", language=lang, region=reg),
        tmdb.get("/tv/top_rated", language=lang),
        # /movie/upcoming is empty for many regions (e.g. CO), so use discover
        # with a future release date instead — region-independent and reliable.
        tmdb.get(
            "/discover/movie",
            language=lang,
            sort_by="popularity.desc",
            **{"primary_release_date.gte": date.today().isoformat()},
        ),
    )
    return {
        "trending_movies": trending_movies["results"],
        "trending_tv": trending_tv["results"],
        "popular_movies": popular_movies["results"],
        "popular_tv": popular_tv["results"],
        "top_rated_movies": top_movies["results"],
        "top_rated_tv": top_tv["results"],
        "upcoming_movies": upcoming["results"],
    }


@router.get("/search")
async def search(
    query: str = Query(min_length=1),
    type: str = Query(default="multi", pattern="^(multi|movie|tv|person)$"),
    page: int = Query(default=1, ge=1),
    language: Optional[str] = LanguageQuery,
):
    data = await tmdb.get(f"/search/{type}", query=query, page=page, language=_lang(language), include_adult=False)
    if type != "multi":
        for item in data["results"]:
            item.setdefault("media_type", type)
    return data


@router.get("/genres")
async def genres(language: Optional[str] = LanguageQuery):
    lang = _lang(language)
    movie_genres, tv_genres = await asyncio.gather(
        tmdb.get("/genre/movie/list", language=lang),
        tmdb.get("/genre/tv/list", language=lang),
    )
    return {"movie": movie_genres["genres"], "tv": tv_genres["genres"]}


@router.get("/discover/{media_type}")
async def discover(
    media_type: str,
    page: int = Query(default=1, ge=1),
    with_genres: Optional[str] = None,
    year: Optional[int] = None,
    min_rating: Optional[float] = Query(default=None, ge=0, le=10),
    sort_by: str = "popularity.desc",
    language: Optional[str] = LanguageQuery,
):
    """Filtered browsing by genre, year and minimum rating."""
    params = {
        "page": page,
        "language": _lang(language),
        "sort_by": sort_by,
        "with_genres": with_genres,
        "vote_average.gte": min_rating,
        # Avoid obscure titles dominating when sorting by rating
        "vote_count.gte": 100 if min_rating else None,
    }
    if year:
        if media_type == "movie":
            params["primary_release_year"] = year
        else:
            params["first_air_date_year"] = year
    data = await tmdb.get(f"/discover/{media_type}", **params)
    for item in data["results"]:
        item.setdefault("media_type", media_type)
    return data
