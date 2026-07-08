from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models.like import Like
from models.topster import Topster, TopsterItem
from models.user import User
from routers.deps import get_current_user, get_optional_user
from schemas.topster import TopsterCreate, TopsterResponse, TopsterUpdate

router = APIRouter(prefix="/api/topsters", tags=["topsters"])


def _build_response(topster: Topster, db: Session) -> TopsterResponse:
    like_count = db.query(Like).filter_by(target_type="topster", target_id=str(topster.id)).count()
    return TopsterResponse(
        id=str(topster.id),
        title=topster.title,
        description=topster.description,
        grid_size=topster.grid_size,
        is_public=topster.is_public,
        created_at=topster.created_at,
        user=topster.user,
        items=topster.items,
        like_count=like_count,
    )


@router.get("/", response_model=list[TopsterResponse])
def list_topsters(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    topsters = (
        db.query(Topster)
        .filter_by(is_public=True)
        .order_by(Topster.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_build_response(t, db) for t in topsters]


@router.post("/", response_model=TopsterResponse, status_code=201)
def create_topster(
    body: TopsterCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    topster = Topster(
        user_id=current_user.id,
        title=body.title,
        description=body.description,
        grid_size=body.grid_size,
        is_public=body.is_public,
    )
    db.add(topster)
    db.flush()

    for item in body.items:
        db.add(TopsterItem(
            topster_id=topster.id,
            album_spotify_id=item.album_spotify_id,
            position=item.position,
        ))

    db.commit()
    db.refresh(topster)
    return _build_response(topster, db)


@router.get("/{topster_id}", response_model=TopsterResponse)
def get_topster(
    topster_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    topster = db.query(Topster).filter_by(id=topster_id).first()
    if not topster:
        raise HTTPException(status_code=404, detail="탑스터를 찾을 수 없습니다")
    if not topster.is_public and (not current_user or current_user.id != topster.user_id):
        raise HTTPException(status_code=403, detail="비공개 탑스터입니다")
    return _build_response(topster, db)


@router.put("/{topster_id}", response_model=TopsterResponse)
def update_topster(
    topster_id: str,
    body: TopsterUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    topster = db.query(Topster).filter_by(id=topster_id).first()
    if not topster:
        raise HTTPException(status_code=404, detail="탑스터를 찾을 수 없습니다")
    if topster.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="권한이 없습니다")

    if body.title is not None:
        topster.title = body.title
    if body.description is not None:
        topster.description = body.description
    if body.grid_size is not None:
        topster.grid_size = body.grid_size
    if body.is_public is not None:
        topster.is_public = body.is_public

    if body.items is not None:
        db.query(TopsterItem).filter_by(topster_id=topster.id).delete()
        for item in body.items:
            db.add(TopsterItem(
                topster_id=topster.id,
                album_spotify_id=item.album_spotify_id,
                position=item.position,
            ))

    db.commit()
    db.refresh(topster)
    return _build_response(topster, db)


@router.delete("/{topster_id}", status_code=204)
def delete_topster(
    topster_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    topster = db.query(Topster).filter_by(id=topster_id).first()
    if not topster:
        raise HTTPException(status_code=404, detail="탑스터를 찾을 수 없습니다")
    if topster.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="권한이 없습니다")
    db.delete(topster)
    db.commit()


@router.get("/user/{user_id}", response_model=list[TopsterResponse])
def list_user_topsters(
    user_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    topsters = (
        db.query(Topster)
        .filter_by(user_id=user_id, is_public=True)
        .order_by(Topster.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_build_response(t, db) for t in topsters]


@router.get("/me/list", response_model=list[TopsterResponse])
def list_my_topsters(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    topsters = (
        db.query(Topster)
        .filter_by(user_id=current_user.id)
        .order_by(Topster.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_build_response(t, db) for t in topsters]
