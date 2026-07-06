from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models.comment import Comment
from models.topster import Topster
from models.user import User
from routers.deps import get_current_user
from schemas.comment import CommentCreate, CommentResponse, CommentUpdate

router = APIRouter(prefix="/api/topsters/{topster_id}/comments", tags=["comments"])


def _get_topster_or_404(topster_id: str, db: Session) -> Topster:
    topster = db.query(Topster).filter_by(id=topster_id).first()
    if not topster:
        raise HTTPException(status_code=404, detail="탑스터를 찾을 수 없습니다")
    return topster


@router.get("/", response_model=list[CommentResponse])
def list_comments(
    topster_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    _get_topster_or_404(topster_id, db)
    comments = (
        db.query(Comment)
        .filter_by(topster_id=topster_id)
        .order_by(Comment.created_at.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return comments


@router.post("/", response_model=CommentResponse, status_code=201)
def create_comment(
    topster_id: str,
    body: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    topster = _get_topster_or_404(topster_id, db)
    if not topster.is_public and topster.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="비공개 탑스터입니다")

    comment = Comment(
        user_id=current_user.id,
        topster_id=topster_id,
        content=body.content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.put("/{comment_id}", response_model=CommentResponse)
def update_comment(
    topster_id: str,
    comment_id: str,
    body: CommentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comment = db.query(Comment).filter_by(id=comment_id, topster_id=topster_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="권한이 없습니다")

    comment.content = body.content
    db.commit()
    db.refresh(comment)
    return comment


@router.delete("/{comment_id}", status_code=204)
def delete_comment(
    topster_id: str,
    comment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comment = db.query(Comment).filter_by(id=comment_id, topster_id=topster_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="권한이 없습니다")

    db.delete(comment)
    db.commit()
