from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models.like import Like
from models.user import User
from routers.deps import get_current_user, get_optional_user
from schemas.like import LikeStatusResponse, LikeToggleResponse

router = APIRouter(prefix="/api/likes", tags=["likes"])


def _like_count(db: Session, target_type: str, target_id: str) -> int:
    return db.query(Like).filter_by(target_type=target_type, target_id=target_id).count()


# ---------------------------------------------------------------------------
# 배치 조회
#
# **이 라우트는 반드시 /{target_type}/{target_id} 보다 먼저 선언돼야 한다.**
# FastAPI는 선언 순서대로 매칭하므로 순서가 바뀌면 /api/likes/batch/track 이
# target_type="batch", target_id="track" 으로 잡힌다.
# ---------------------------------------------------------------------------

# 앨범 상세의 트랙 목록이 한 번에 최대 수십 행이다. 여유를 두되 무제한은 막는다.
MAX_BATCH_IDS = 200


@router.get("/batch/{target_type}", response_model=dict[str, LikeStatusResponse])
def get_like_statuses(
    target_type: str,
    ids: str = Query(..., description="쉼표로 구분한 target_id 목록"),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """여러 대상의 좋아요 상태를 한 번에 준다.

    트랙 행마다 GET을 부르면 앨범 하나에 수십 번이 나간다. 화면이 필요한 ID를 모아
    한 번에 묻게 하려고 둔 경로다. 응답은 요청한 ID 전부를 담는다 —
    좋아요가 하나도 없는 대상도 {liked: false, like_count: 0} 으로 채워 보낸다.
    """
    wanted = [i for i in (x.strip() for x in ids.split(",")) if i][:MAX_BATCH_IDS]
    if not wanted:
        return {}

    counts = dict(
        db.query(Like.target_id, func.count(Like.id))
        .filter(Like.target_type == target_type, Like.target_id.in_(wanted))
        .group_by(Like.target_id)
        .all()
    )

    liked: set[str] = set()
    if current_user:
        liked = {
            row[0]
            for row in db.query(Like.target_id)
            .filter(
                Like.user_id == current_user.id,
                Like.target_type == target_type,
                Like.target_id.in_(wanted),
            )
            .all()
        }

    return {
        tid: LikeStatusResponse(liked=tid in liked, like_count=counts.get(tid, 0))
        for tid in wanted
    }


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
