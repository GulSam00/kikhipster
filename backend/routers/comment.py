from __future__ import annotations

import hashlib
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Path, Query
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from models.comment import Comment, CommentReport
from models.topster import Topster
from models.tournament import Tournament
from models.user import User
from routers.deps import get_optional_user
from schemas.comment import (
    DEFAULT_GUEST_NICKNAME,
    CommentCreate,
    CommentReportCreate,
    CommentResponse,
    CommentUpdate,
)

VALID_TARGET_TYPES = ("topster", "tournament")

# 기존 프론트가 쓰던 경로를 그대로 유지하기 위한 라우터.
# 내부적으로는 범용 라우터와 같은 함수를 호출한다.
topster_router = APIRouter(prefix="/api/topsters/{topster_id}/comments", tags=["comments"])

# 토너먼트 등 탑스터 밖의 대상에 쓰는 범용 라우터.
router = APIRouter(prefix="/api/comments/{target_type}/{target_id}", tags=["comments"])


# --------------------------------------------------------------------------
# 비로그인 작성자 식별
# --------------------------------------------------------------------------

# 헤더로 받는 비로그인 작성자 토큰. POST/PUT/DELETE 에서만 쓴다.
#
# **GET(목록)은 헤더가 아니라 쿼리 파라미터로 받는다.** lib/api/client.ts 가 GET 에
# Content-Type 조차 일부러 안 붙이는 이유와 같다 — 커스텀 헤더가 하나라도 붙으면 단순
# 요청 조건이 깨져 URL 마다 CORS 프리플라이트(OPTIONS)가 한 번씩 더 나간다(2026-08-27).
# POST/PUT/DELETE 는 어차피 프리플라이트가 나가므로 헤더로 둬도 손해가 없다.
GuestTokenHeader = Header(default=None, alias="X-Guest-Token")


def hash_guest_token(token: str | None) -> str | None:
    """작성자 토큰의 SHA-256 hex. **평문은 어디에도 저장하지 않는다.**"""
    if not token:
        return None
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _clean_nickname(nickname: str | None) -> str:
    """비우거나 공백만 보내면 "익명". 요청 사양이 그렇다."""
    cleaned = (nickname or "").strip()
    return cleaned[:20] if cleaned else DEFAULT_GUEST_NICKNAME


# --------------------------------------------------------------------------
# 응답 조립
# --------------------------------------------------------------------------


def _report_state(
    comments: list[Comment],
    viewer: User | None,
    guest_hash: str | None,
    db: Session,
) -> tuple[dict, set]:
    """댓글별 신고 수와, 보는 사람이 이미 신고한 댓글 집합을 한 번에 구한다.

    댓글마다 따로 세면 목록 한 번에 쿼리가 N배가 된다 — comment_counts() 와 같은 규약으로
    묶어서 센다.
    """
    ids = [c.id for c in comments]
    if not ids:
        return {}, set()

    counts = dict(
        db.query(CommentReport.comment_id, func.count(CommentReport.id))
        .filter(CommentReport.comment_id.in_(ids))
        .group_by(CommentReport.comment_id)
        .all()
    )

    mine: set = set()
    if viewer is not None:
        rows = (
            db.query(CommentReport.comment_id)
            .filter(
                CommentReport.comment_id.in_(ids),
                CommentReport.reporter_user_id == viewer.id,
            )
            .all()
        )
        mine = {r[0] for r in rows}
    elif guest_hash:
        rows = (
            db.query(CommentReport.comment_id)
            .filter(
                CommentReport.comment_id.in_(ids),
                CommentReport.reporter_token_hash == guest_hash,
            )
            .all()
        )
        mine = {r[0] for r in rows}

    return counts, mine


def _is_mine(comment: Comment, viewer: User | None, guest_hash: str | None) -> bool:
    """이 댓글의 주인인지.

    로그인 댓글은 사용자 id 로, 비로그인 댓글은 작성자 토큰 해시로 가린다. 둘을 섞지
    않는다 — 로그인했다고 해서 남의 익명 댓글을 토큰 없이 지울 수는 없어야 한다.
    """
    if comment.user_id is not None:
        return viewer is not None and comment.user_id == viewer.id
    return bool(guest_hash) and comment.guest_token_hash == guest_hash


def _to_response(
    comment: Comment,
    viewer: User | None,
    guest_hash: str | None,
    report_counts: dict | None = None,
    reported_ids: set | None = None,
) -> CommentResponse:
    return CommentResponse(
        id=comment.id,
        target_type=comment.target_type,
        target_id=comment.target_id,
        content=comment.content,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        edited_at=comment.edited_at,
        user=comment.user,
        author_nickname=comment.author_nickname,
        is_mine=_is_mine(comment, viewer, guest_hash),
        reported_by_me=comment.id in (reported_ids or set()),
        report_count=(report_counts or {}).get(comment.id, 0),
    )


# --------------------------------------------------------------------------
# 공통 로직
# --------------------------------------------------------------------------


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


def _list(target_type, target_id, limit, offset, viewer, guest_token, db):
    _assert_target_exists(target_type, target_id, db)
    comments = (
        db.query(Comment)
        .filter_by(target_type=target_type, target_id=target_id)
        .order_by(Comment.created_at.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    guest_hash = hash_guest_token(guest_token)
    counts, mine = _report_state(comments, viewer, guest_hash, db)
    return [_to_response(c, viewer, guest_hash, counts, mine) for c in comments]


def _create(target_type, target_id, body: CommentCreate, viewer, guest_token, db):
    _assert_target_exists(target_type, target_id, db)

    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="내용을 입력해 주세요")

    guest_hash = hash_guest_token(guest_token)
    if viewer is None and not guest_hash:
        # 토큰이 없으면 나중에 본인 확인을 할 수 없다 — 아무도 못 지우는 댓글이 남는다.
        raise HTTPException(status_code=400, detail="작성자 토큰이 필요합니다")

    comment = Comment(
        user_id=viewer.id if viewer else None,
        guest_nickname=None if viewer else _clean_nickname(body.nickname),
        guest_token_hash=None if viewer else guest_hash,
        target_type=target_type,
        target_id=target_id,
        content=content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _to_response(comment, viewer, guest_hash)


def _owned_comment_or_error(
    target_type: str, target_id: str, comment_id: str, viewer, guest_hash, db: Session
) -> Comment:
    comment = (
        db.query(Comment)
        .filter_by(id=comment_id, target_type=target_type, target_id=target_id)
        .first()
    )
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다")
    if not _is_mine(comment, viewer, guest_hash):
        raise HTTPException(status_code=403, detail="권한이 없습니다")
    return comment


def _update(target_type, target_id, comment_id, content, viewer, guest_token, db):
    guest_hash = hash_guest_token(guest_token)
    comment = _owned_comment_or_error(target_type, target_id, comment_id, viewer, guest_hash, db)
    # 같은 내용을 다시 저장한 건 수정이 아니다 — 그때까지 "(수정됨)"을 붙이면 거짓말이 된다.
    if comment.content != content:
        comment.content = content
        comment.edited_at = datetime.utcnow()
    db.commit()
    db.refresh(comment)
    return _to_response(comment, viewer, guest_hash)


def _delete(target_type, target_id, comment_id, viewer, guest_token, db):
    guest_hash = hash_guest_token(guest_token)
    comment = _owned_comment_or_error(target_type, target_id, comment_id, viewer, guest_hash, db)
    db.delete(comment)
    db.commit()


def _report(target_type, target_id, comment_id, reason, viewer, guest_token, db):
    guest_hash = hash_guest_token(guest_token)
    comment = (
        db.query(Comment)
        .filter_by(id=comment_id, target_type=target_type, target_id=target_id)
        .first()
    )
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다")
    if _is_mine(comment, viewer, guest_hash):
        raise HTTPException(status_code=400, detail="자신의 댓글은 신고할 수 없습니다")
    if viewer is None and not guest_hash:
        raise HTTPException(status_code=400, detail="작성자 토큰이 필요합니다")

    report = CommentReport(
        comment_id=comment.id,
        reporter_user_id=viewer.id if viewer else None,
        reporter_token_hash=None if viewer else guest_hash,
        reason=(reason or None),
    )
    db.add(report)
    try:
        db.commit()
    except IntegrityError:
        # 부분 유니크 인덱스에 걸렸다 = 같은 사람이 같은 댓글을 두 번 신고한 것이다.
        db.rollback()
        raise HTTPException(status_code=409, detail="이미 신고한 댓글입니다")


def purge_comments(target_type: str, target_id: str, db: Session) -> None:
    """대상 삭제 시 호출한다. FK가 없어 DB가 대신 지워주지 않는다."""
    db.query(Comment).filter_by(target_type=target_type, target_id=str(target_id)).delete()


def comment_counts(db: Session, target_type: str, target_ids: list[str]) -> dict[str, int]:
    """여러 대상의 댓글 수를 한 번에 센다. like_counts 와 같은 규약이다 —
    댓글이 없는 대상은 키에 없으므로 호출부가 0으로 채운다."""
    if not target_ids:
        return {}
    rows = (
        db.query(Comment.target_id, func.count(Comment.id))
        .filter(Comment.target_type == target_type, Comment.target_id.in_(target_ids))
        .group_by(Comment.target_id)
        .all()
    )
    return {tid: count for tid, count in rows}


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
    guest_token: str | None = Query(default=None),
    viewer: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    return _list(target_type, target_id, limit, offset, viewer, guest_token, db)


@router.post("/", response_model=CommentResponse, status_code=201)
def create_comment(
    body: CommentCreate,
    target_type: str = TargetType,
    target_id: str = Path(...),
    viewer: User | None = Depends(get_optional_user),
    x_guest_token: str | None = GuestTokenHeader,
    db: Session = Depends(get_db),
):
    return _create(target_type, target_id, body, viewer, x_guest_token, db)


@router.put("/{comment_id}", response_model=CommentResponse)
def update_comment(
    body: CommentUpdate,
    comment_id: str = Path(...),
    target_type: str = TargetType,
    target_id: str = Path(...),
    viewer: User | None = Depends(get_optional_user),
    x_guest_token: str | None = GuestTokenHeader,
    db: Session = Depends(get_db),
):
    return _update(target_type, target_id, comment_id, body.content, viewer, x_guest_token, db)


@router.delete("/{comment_id}", status_code=204)
def delete_comment(
    comment_id: str = Path(...),
    target_type: str = TargetType,
    target_id: str = Path(...),
    viewer: User | None = Depends(get_optional_user),
    x_guest_token: str | None = GuestTokenHeader,
    db: Session = Depends(get_db),
):
    _delete(target_type, target_id, comment_id, viewer, x_guest_token, db)


@router.post("/{comment_id}/report", status_code=204)
def report_comment(
    body: CommentReportCreate,
    comment_id: str = Path(...),
    target_type: str = TargetType,
    target_id: str = Path(...),
    viewer: User | None = Depends(get_optional_user),
    x_guest_token: str | None = GuestTokenHeader,
    db: Session = Depends(get_db),
):
    _report(target_type, target_id, comment_id, body.reason, viewer, x_guest_token, db)


# --------------------------------------------------------------------------
# 탑스터 전용 경로 (기존 프론트 호환)
# --------------------------------------------------------------------------


@topster_router.get("/", response_model=list[CommentResponse])
def list_topster_comments(
    topster_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    guest_token: str | None = Query(default=None),
    viewer: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    return _list("topster", topster_id, limit, offset, viewer, guest_token, db)


@topster_router.post("/", response_model=CommentResponse, status_code=201)
def create_topster_comment(
    topster_id: str,
    body: CommentCreate,
    viewer: User | None = Depends(get_optional_user),
    x_guest_token: str | None = GuestTokenHeader,
    db: Session = Depends(get_db),
):
    return _create("topster", topster_id, body, viewer, x_guest_token, db)


@topster_router.put("/{comment_id}", response_model=CommentResponse)
def update_topster_comment(
    topster_id: str,
    comment_id: str,
    body: CommentUpdate,
    viewer: User | None = Depends(get_optional_user),
    x_guest_token: str | None = GuestTokenHeader,
    db: Session = Depends(get_db),
):
    return _update("topster", topster_id, comment_id, body.content, viewer, x_guest_token, db)


@topster_router.delete("/{comment_id}", status_code=204)
def delete_topster_comment(
    topster_id: str,
    comment_id: str,
    viewer: User | None = Depends(get_optional_user),
    x_guest_token: str | None = GuestTokenHeader,
    db: Session = Depends(get_db),
):
    _delete("topster", topster_id, comment_id, viewer, x_guest_token, db)


@topster_router.post("/{comment_id}/report", status_code=204)
def report_topster_comment(
    topster_id: str,
    comment_id: str,
    body: CommentReportCreate,
    viewer: User | None = Depends(get_optional_user),
    x_guest_token: str | None = GuestTokenHeader,
    db: Session = Depends(get_db),
):
    _report("topster", topster_id, comment_id, body.reason, viewer, x_guest_token, db)
