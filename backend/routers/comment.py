from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session

from database import get_db
from models.comment import Comment
from models.topster import Topster
from models.tournament import Tournament
from models.user import User
from routers.deps import get_current_user
from schemas.comment import CommentCreate, CommentResponse, CommentUpdate

VALID_TARGET_TYPES = ("topster", "tournament")

# 기존 프론트가 쓰던 경로를 그대로 유지하기 위한 라우터.
# 내부적으로는 범용 라우터와 같은 함수를 호출한다.
topster_router = APIRouter(prefix="/api/topsters/{topster_id}/comments", tags=["comments"])

# 토너먼트 등 탑스터 밖의 대상에 쓰는 범용 라우터.
router = APIRouter(prefix="/api/comments/{target_type}/{target_id}", tags=["comments"])


def _assert_target_exists(target_type: str, target_id: str, db: Session) -> object:
    """대상이 실제로 있는지 확인한다. 댓글 테이블엔 더 이상 FK가 없어 여기서 막아야 한다."""
    if target_type == "topster":
        target = db.query(Topster).filter_by(id=target_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="탑스터를 찾을 수 없습니다")
        return target

    if target_type == "tournament":
        target = db.query(Tournament).filter_by(id=target_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="토너먼트를 찾을 수 없습니다")
        return target

    raise HTTPException(status_code=400, detail="지원하지 않는 댓글 대상입니다")


def _assert_writable(target_type: str, target, current_user: User) -> None:
    if target_type == "topster" and not target.is_public and target.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="비공개 탑스터입니다")


def _list(target_type: str, target_id: str, limit: int, offset: int, db: Session):
    _assert_target_exists(target_type, target_id, db)
    return (
        db.query(Comment)
        .filter_by(target_type=target_type, target_id=target_id)
        .order_by(Comment.created_at.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def _create(target_type: str, target_id: str, content: str, current_user: User, db: Session):
    target = _assert_target_exists(target_type, target_id, db)
    _assert_writable(target_type, target, current_user)

    comment = Comment(
        user_id=current_user.id,
        target_type=target_type,
        target_id=target_id,
        content=content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


def _owned_comment_or_error(
    target_type: str, target_id: str, comment_id: str, current_user: User, db: Session
) -> Comment:
    comment = (
        db.query(Comment)
        .filter_by(id=comment_id, target_type=target_type, target_id=target_id)
        .first()
    )
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="권한이 없습니다")
    return comment


def _update(target_type, target_id, comment_id, content, current_user, db):
    comment = _owned_comment_or_error(target_type, target_id, comment_id, current_user, db)
    # 같은 내용을 다시 저장한 건 수정이 아니다 — 그때까지 "(수정됨)"을 붙이면 거짓말이 된다.
    if comment.content != content:
        comment.content = content
        comment.edited_at = datetime.utcnow()
    db.commit()
    db.refresh(comment)
    return comment


def _delete(target_type, target_id, comment_id, current_user, db):
    comment = _owned_comment_or_error(target_type, target_id, comment_id, current_user, db)
    db.delete(comment)
    db.commit()


def purge_comments(target_type: str, target_id: str, db: Session) -> None:
    """대상 삭제 시 호출한다. FK가 없어 DB가 대신 지워주지 않는다."""
    db.query(Comment).filter_by(target_type=target_type, target_id=str(target_id)).delete()


# --------------------------------------------------------------------------
# 범용 경로
# --------------------------------------------------------------------------

TargetType = Path(..., pattern="^(topster|tournament)$")


@router.get("/", response_model=list[CommentResponse])
def list_comments(
    target_type: str = TargetType,
    target_id: str = Path(...),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    return _list(target_type, target_id, limit, offset, db)


@router.post("/", response_model=CommentResponse, status_code=201)
def create_comment(
    body: CommentCreate,
    target_type: str = TargetType,
    target_id: str = Path(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _create(target_type, target_id, body.content, current_user, db)


@router.put("/{comment_id}", response_model=CommentResponse)
def update_comment(
    body: CommentUpdate,
    comment_id: str = Path(...),
    target_type: str = TargetType,
    target_id: str = Path(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _update(target_type, target_id, comment_id, body.content, current_user, db)


@router.delete("/{comment_id}", status_code=204)
def delete_comment(
    comment_id: str = Path(...),
    target_type: str = TargetType,
    target_id: str = Path(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _delete(target_type, target_id, comment_id, current_user, db)


# --------------------------------------------------------------------------
# 탑스터 전용 경로 (기존 프론트 호환)
# --------------------------------------------------------------------------


@topster_router.get("/", response_model=list[CommentResponse])
def list_topster_comments(
    topster_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    return _list("topster", topster_id, limit, offset, db)


@topster_router.post("/", response_model=CommentResponse, status_code=201)
def create_topster_comment(
    topster_id: str,
    body: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _create("topster", topster_id, body.content, current_user, db)


@topster_router.put("/{comment_id}", response_model=CommentResponse)
def update_topster_comment(
    topster_id: str,
    comment_id: str,
    body: CommentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _update("topster", topster_id, comment_id, body.content, current_user, db)


@topster_router.delete("/{comment_id}", status_code=204)
def delete_topster_comment(
    topster_id: str,
    comment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _delete("topster", topster_id, comment_id, current_user, db)
