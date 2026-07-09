"""Aggregated detail endpoints — one request per page instead of five."""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query

from .. import tmdb
from ..config import settings

router = APIRouter(tags=["media"])

KEY_JOBS = {"Director", "Writer", "Screenplay", "Story", "Creator", "Executive Producer"}


def _lang(language: Optional[str]) -> str:
    return language or settings.default_language


def _providers_for_region(providers: Dict[str, Any], region: str) -> Dict[str, Any]:
    results = providers.get("results", {})
    regional = results.get(region.upper(), {})
    return {
        "region": region.upper(),
        "available_regions": sorted(results.keys()),
        "link": regional.get("link"),
        "flatrate": regional.get("flatrate", []),
        "rent": regional.get("rent", []),
        "buy": regional.get("buy", []),
    }


def _trailers_first(videos: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    youtube = [v for v in videos if v.get("site") == "YouTube"]
    return sorted(youtube, key=lambda v: (v.get("type") != "Trailer", not v.get("official")))


def _shape_full(data: Dict[str, Any], media_type: str, region: str) -> Dict[str, Any]:
    credits = data.pop("credits", {})
    crew = credits.get("crew", [])
    key_crew, seen = [], set()
    for member in crew:
        if member.get("job") in KEY_JOBS and member["id"] not in seen:
            seen.add(member["id"])
            key_crew.append(member)
    data["media_type"] = media_type
    data["cast"] = credits.get("cast", [])
    data["key_crew"] = key_crew
    data["videos"] = _trailers_first(data.pop("videos", {}).get("results", []))
    data["watch_providers"] = _providers_for_region(data.pop("watch/providers", {}), region)
    recommendations = data.pop("recommendations", {}).get("results", [])
    similar = data.pop("similar", {}).get("results", [])
    for item in recommendations + similar:
        item.setdefault("media_type", media_type)
    data["recommendations"] = recommendations
    data["similar"] = similar
    return data


@router.get("/movie/{movie_id}/full")
async def movie_full(
    movie_id: int,
    language: Optional[str] = Query(default=None),
    region: Optional[str] = Query(default=None),
):
    data = await tmdb.get(
        f"/movie/{movie_id}",
        language=_lang(language),
        append_to_response="credits,videos,watch/providers,recommendations,similar,release_dates",
        include_video_language="en,es",
    )
    return _shape_full(data, "movie", region or settings.default_region)


@router.get("/tv/{tv_id}/full")
async def tv_full(
    tv_id: int,
    language: Optional[str] = Query(default=None),
    region: Optional[str] = Query(default=None),
):
    data = await tmdb.get(
        f"/tv/{tv_id}",
        language=_lang(language),
        append_to_response="credits,videos,watch/providers,recommendations,similar",
        include_video_language="en,es",
    )
    # TV credits use "created_by" as the key creative role
    shaped = _shape_full(data, "tv", region or settings.default_region)
    for creator in shaped.get("created_by", []):
        creator["job"] = "Creator"
    return shaped


@router.get("/tv/{tv_id}/season/{season_number}")
async def tv_season(tv_id: int, season_number: int, language: Optional[str] = Query(default=None)):
    return await tmdb.get(f"/tv/{tv_id}/season/{season_number}", language=_lang(language))


@router.get("/person/{person_id}/full")
async def person_full(person_id: int, language: Optional[str] = Query(default=None)):
    data = await tmdb.get(
        f"/person/{person_id}",
        language=_lang(language),
        append_to_response="combined_credits,external_ids",
    )
    credits = data.pop("combined_credits", {})
    cast = credits.get("cast", [])
    crew = credits.get("crew", [])
    # Dedupe crew (a director can have many jobs on one film)
    crew_by_id: Dict[int, Dict[str, Any]] = {}
    for job in crew:
        entry = crew_by_id.setdefault(job["id"], {**job, "jobs": []})
        entry["jobs"].append(job.get("job"))
    data["cast_credits"] = sorted(cast, key=lambda c: c.get("popularity", 0), reverse=True)
    data["crew_credits"] = sorted(crew_by_id.values(), key=lambda c: c.get("popularity", 0), reverse=True)
    return data
