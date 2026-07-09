"""Personal library: favorites, watched, ratings and custom lists (local DB)."""
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/library", tags=["library"])


def _media_fields(ref: schemas.MediaRef) -> dict:
    return ref.model_dump(include={
        "tmdb_id", "media_type", "title", "poster_path",
        "backdrop_path", "release_date", "vote_average",
    })


# ---------- state ----------

@router.get("/state/{media_type}/{tmdb_id}", response_model=schemas.LibraryState)
def state(media_type: str, tmdb_id: int, db: Session = Depends(get_db)):
    fav = db.scalar(select(models.Favorite).filter_by(tmdb_id=tmdb_id, media_type=media_type))
    watched = db.scalar(select(models.WatchedItem).filter_by(tmdb_id=tmdb_id, media_type=media_type))
    rating = db.scalar(select(models.Rating).filter_by(tmdb_id=tmdb_id, media_type=media_type))
    list_ids = db.scalars(
        select(models.CustomListItem.list_id).filter_by(tmdb_id=tmdb_id, media_type=media_type)
    ).all()
    return schemas.LibraryState(
        favorite=fav is not None,
        watched=watched is not None,
        rating=rating.score if rating else None,
        list_ids=list(list_ids),
    )


# ---------- favorites ----------

@router.get("/favorites", response_model=List[schemas.FavoriteOut])
def list_favorites(db: Session = Depends(get_db)):
    return db.scalars(select(models.Favorite).order_by(models.Favorite.created_at.desc())).all()


@router.put("/favorites", response_model=schemas.FavoriteOut)
def add_favorite(ref: schemas.MediaRef, db: Session = Depends(get_db)):
    existing = db.scalar(select(models.Favorite).filter_by(tmdb_id=ref.tmdb_id, media_type=ref.media_type))
    if existing:
        return existing
    fav = models.Favorite(**_media_fields(ref))
    db.add(fav)
    db.commit()
    db.refresh(fav)
    return fav


@router.delete("/favorites/{media_type}/{tmdb_id}", status_code=204)
def remove_favorite(media_type: str, tmdb_id: int, db: Session = Depends(get_db)):
    db.execute(delete(models.Favorite).filter_by(tmdb_id=tmdb_id, media_type=media_type))
    db.commit()


# ---------- watched ----------

@router.get("/watched", response_model=List[schemas.WatchedOut])
def list_watched(
    sort: str = Query(default="watched_at", pattern="^(watched_at|title|vote_average)$"),
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
):
    column = getattr(models.WatchedItem, sort)
    column = column.desc() if order == "desc" else column.asc()
    return db.scalars(select(models.WatchedItem).order_by(column)).all()


@router.put("/watched", response_model=schemas.WatchedOut)
def mark_watched(ref: schemas.MediaRef, db: Session = Depends(get_db)):
    existing = db.scalar(select(models.WatchedItem).filter_by(tmdb_id=ref.tmdb_id, media_type=ref.media_type))
    if existing:
        return existing
    item = models.WatchedItem(**_media_fields(ref))
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/watched/{media_type}/{tmdb_id}", status_code=204)
def unmark_watched(media_type: str, tmdb_id: int, db: Session = Depends(get_db)):
    db.execute(delete(models.WatchedItem).filter_by(tmdb_id=tmdb_id, media_type=media_type))
    db.commit()


# ---------- watched episodes ----------

@router.get("/watched-episodes", response_model=List[schemas.ShowProgress])
def watched_episodes_summary(db: Session = Depends(get_db)):
    """Episode-level watch progress per show — distinct from a show being
    marked watched as a whole, so partially-watched series are trackable."""
    rows = db.scalars(
        select(models.WatchedEpisode).order_by(models.WatchedEpisode.watched_at.desc())
    ).all()
    by_show: Dict[int, schemas.ShowProgress] = {}
    for row in rows:
        show = by_show.get(row.tmdb_id)
        if show is None:
            show = schemas.ShowProgress(
                tmdb_id=row.tmdb_id, title=row.show_title, poster_path=row.show_poster_path,
                count=0, episodes=[],
            )
            by_show[row.tmdb_id] = show
        show.episodes.append(schemas.EpisodeEntry.model_validate(row))
        show.count += 1
    return list(by_show.values())


@router.get("/watched-episodes/{tv_id}", response_model=List[schemas.WatchedEpisodeOut])
def watched_episodes(tv_id: int, db: Session = Depends(get_db)):
    return db.scalars(select(models.WatchedEpisode).filter_by(tmdb_id=tv_id)).all()


@router.put("/watched-episodes", response_model=schemas.WatchedEpisodeOut)
def mark_episode(body: schemas.WatchedEpisodeIn, db: Session = Depends(get_db)):
    existing = db.scalar(select(models.WatchedEpisode).filter_by(
        tmdb_id=body.tmdb_id, season_number=body.season_number, episode_number=body.episode_number
    ))
    if existing:
        return existing
    episode = models.WatchedEpisode(**body.model_dump())
    db.add(episode)
    db.commit()
    db.refresh(episode)
    return episode


@router.delete("/watched-episodes/{tv_id}/{season_number}/{episode_number}", status_code=204)
def unmark_episode(tv_id: int, season_number: int, episode_number: int, db: Session = Depends(get_db)):
    db.execute(delete(models.WatchedEpisode).filter_by(
        tmdb_id=tv_id, season_number=season_number, episode_number=episode_number
    ))
    db.commit()


# ---------- ratings ----------

@router.get("/ratings", response_model=List[schemas.RatingOut])
def list_ratings(db: Session = Depends(get_db)):
    return db.scalars(select(models.Rating).order_by(models.Rating.updated_at.desc())).all()


@router.put("/ratings", response_model=schemas.RatingOut)
def set_rating(body: schemas.RatingIn, db: Session = Depends(get_db)):
    rating = db.scalar(select(models.Rating).filter_by(tmdb_id=body.tmdb_id, media_type=body.media_type))
    if rating:
        rating.score = body.score
        rating.note = body.note
    else:
        rating = models.Rating(**_media_fields(body), score=body.score, note=body.note)
        db.add(rating)
    db.commit()
    db.refresh(rating)
    return rating


@router.delete("/ratings/{media_type}/{tmdb_id}", status_code=204)
def delete_rating(media_type: str, tmdb_id: int, db: Session = Depends(get_db)):
    db.execute(delete(models.Rating).filter_by(tmdb_id=tmdb_id, media_type=media_type))
    db.commit()


# ---------- custom lists ----------

@router.get("/lists", response_model=List[schemas.ListOut])
def get_lists(db: Session = Depends(get_db)):
    return db.scalars(select(models.CustomList).order_by(models.CustomList.created_at)).all()


@router.post("/lists", response_model=schemas.ListOut, status_code=201)
def create_list(body: schemas.ListCreate, db: Session = Depends(get_db)):
    new_list = models.CustomList(name=body.name, description=body.description)
    db.add(new_list)
    db.commit()
    db.refresh(new_list)
    return new_list


@router.delete("/lists/{list_id}", status_code=204)
def delete_list(list_id: int, db: Session = Depends(get_db)):
    target = db.get(models.CustomList, list_id)
    if not target:
        raise HTTPException(status_code=404, detail="List not found")
    db.delete(target)
    db.commit()


@router.put("/lists/{list_id}/items", response_model=schemas.ListOut)
def add_to_list(list_id: int, ref: schemas.MediaRef, db: Session = Depends(get_db)):
    target = db.get(models.CustomList, list_id)
    if not target:
        raise HTTPException(status_code=404, detail="List not found")
    existing = db.scalar(select(models.CustomListItem).filter_by(
        list_id=list_id, tmdb_id=ref.tmdb_id, media_type=ref.media_type
    ))
    if not existing:
        db.add(models.CustomListItem(list_id=list_id, **_media_fields(ref)))
        db.commit()
    db.refresh(target)
    return target


@router.delete("/lists/{list_id}/items/{media_type}/{tmdb_id}", status_code=204)
def remove_from_list(list_id: int, media_type: str, tmdb_id: int, db: Session = Depends(get_db)):
    db.execute(delete(models.CustomListItem).filter_by(
        list_id=list_id, tmdb_id=tmdb_id, media_type=media_type
    ))
    db.commit()
