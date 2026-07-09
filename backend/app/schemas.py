from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class MediaRef(BaseModel):
    """Reference to a TMDB title plus the display fields we denormalize."""
    tmdb_id: int
    media_type: str = Field(pattern="^(movie|tv)$")
    title: str
    poster_path: Optional[str] = None
    backdrop_path: Optional[str] = None
    release_date: Optional[str] = None
    vote_average: Optional[float] = None


class FavoriteOut(MediaRef):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


class WatchedOut(MediaRef):
    model_config = ConfigDict(from_attributes=True)
    id: int
    watched_at: datetime


class RatingIn(MediaRef):
    score: float = Field(ge=0.5, le=10)
    note: Optional[str] = None


class RatingOut(RatingIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    updated_at: datetime


class ListCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: Optional[str] = None


class ListItemOut(MediaRef):
    model_config = ConfigDict(from_attributes=True)
    id: int
    added_at: datetime


class ListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime
    items: List[ListItemOut] = []


class WatchedEpisodeIn(BaseModel):
    tmdb_id: int
    season_number: int
    episode_number: int


class WatchedEpisodeOut(WatchedEpisodeIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    watched_at: datetime


class LibraryState(BaseModel):
    """Per-title flags so the frontend can paint toggles in one request."""
    favorite: bool = False
    watched: bool = False
    rating: Optional[float] = None
    list_ids: List[int] = []
