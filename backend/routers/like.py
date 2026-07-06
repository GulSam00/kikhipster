from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.like import Like
from models.user import User
from routers.deps import get_current_user, get_optional_user
from schemas.like import LikeStatusResponse, LikeToggleResponse

router = APIRouter(prefix="/api/likes", tags=["likes"])


def _like_count(db: Session, target_type: str, target_id: str) -> int:
    return db.query(Like).filter_by(target_type=target_type, target_id=target_id).count()


@router.get("/{target_type}/{target_id}", response_model=LikeStatusResponse)
def get_like_status(
    target_type: str,
    target_id: str,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    liked = False
    if current_user:
        liked = db.query(Like).filter_by(
            user_id=current_user.id,
            target_type=target_type,
            target_id=target_id,
        ).first() is not None
    return LikeStatusResponse(liked=liked, like_count=_like_count(db, target_type, target_id))


@router.post("/{target_type}/{target_id}", response_model=LikeToggleResponse)
def toggle_like(
    target_type: str,
    target_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.query(Like).filter_by(
        user_id=current_user.id,
        target_type=target_type,
        target_id=target_id,
    ).first()

    if existing:
        db.delete(existing)
        db.commit()
        return LikeToggleResponse(liked=False, like_count=_like_count(db, target_type, target_id))
    else:
        db.add(Like(user_id=current_user.id, target_type=target_type, target_id=target_id))
        db.commit()
        return LikeToggleResponse(liked=True, like_count=_like_count(db, target_type, target_id))
