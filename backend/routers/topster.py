from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import String, cast, func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from database import get_db
from models.like import Like
from models.topster import Topster, TopsterItem
from models.user import User
from routers.comment import purge_comments
from routers.deps import get_current_user
from schemas.topster import TopsterCreate, TopsterResponse, TopsterUpdate

router = APIRouter(prefix="/api/topsters", tags=["topsters"])

# 격자·표시 옵션. 생성/수정/응답에서 같은 목록을 돌려 쓴다 — 옵션이 늘 때 한 군데만 고치면 된다.
OPTION_FIELDS = (
    "width",
    "height",
    "background_color",
    "text_color",
    "cell_gap",
    "show_title",
    "show_album_info",
    "show_numbering",
)


def _build_response(
    topster: Topster, db: Session, like_count: int | None = None
) -> TopsterResponse:
    """목록처럼 좋아요 수를 이미 집계해 둔 경로는 like_count를 넘겨 N+1 쿼리를 피한다."""
    if like_count is None:
        like_count = (
            db.query(Like).filter_by(target_type="topster", target_id=str(topster.id)).count()
        )
    return TopsterResponse(
        id=str(topster.id),
        title=topster.title,
        description=topster.description,
        created_at=topster.created_at,
        user=topster.user,
        items=topster.items,
        like_count=like_count,
        **{f: getattr(topster, f) for f in OPTION_FIELDS},
    )


@router.get("/", response_model=list[TopsterResponse])
def list_topsters(
    q: str | None = Query(None, description="제목·설명 부분 일치 검색"),
    sort: str = Query("recent", pattern="^(recent|popular)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """공개 탑스터 목록. 검색 + 최신순/인기순 정렬. 비로그인도 조회 가능.

    인기순은 '좋아요 수'(전체 기간)다. 월드컵 대시보드는 기간별 인기(전체·년·월)를 두지만
    탑스터는 기간 구분 없이 인기순 하나만 쓰기로 했다 (2026-08-23).

    Like.target_id 는 String 이고 Topster.id 는 UUID라 조인에 cast가 필요하다.
    Postgres의 uuid::varchar 는 소문자 하이픈 표기라 라우터가 저장하는 문자열과 일치한다.
    """
    # 정렬 기준이자 카드에 표시되는 좋아요 수. 기간 구분이 없어 집계는 하나면 된다.
    totals = (
        db.query(
            Like.target_id.label("tid"),
            func.count(Like.id).label("cnt"),
        )
        .filter(Like.target_type == "topster")
        .group_by(Like.target_id)
        .subquery()
    )

    query = (
        db.query(
            Topster,
            func.coalesce(totals.c.cnt, 0).label("like_count"),
        )
        .outerjoin(totals, totals.c.tid == cast(Topster.id, String))
        # 카드가 그리드 미리보기를 그리므로 items까지 미리 당겨온다. 컬렉션이라
        # joinedload를 쓰면 limit/offset과 얽히므로 selectinload를 쓴다.
        .options(joinedload(Topster.user), selectinload(Topster.items))
    )

    if q:
        pattern = f"%{q}%"
        query = query.filter(
            or_(Topster.title.ilike(pattern), Topster.description.ilike(pattern))
        )

    if sort == "recent":
        query = query.order_by(Topster.created_at.desc())
    else:
        # 좋아요 수가 같으면 최신순으로 갈라 순서가 요청마다 흔들리지 않게 한다.
        query = query.order_by(
            func.coalesce(totals.c.cnt, 0).desc(), Topster.created_at.desc()
        )

    rows = query.offset(offset).limit(limit).all()
    return [_build_response(t, db, like_count=count) for t, count in rows]


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
        **{f: getattr(body, f) for f in OPTION_FIELDS},
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
    db: Session = Depends(get_db),
):
    """탑스터 상세. **모든 탑스터가 공개다** — 2026-08-27에 비공개 개념을 없앨다."""
    topster = db.query(Topster).filter_by(id=topster_id).first()
    if not topster:
        raise HTTPException(status_code=404, detail="탑스터를 찾을 수 없습니다")
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
    for f in OPTION_FIELDS:
        value = getattr(body, f)
        if value is not None:
            setattr(topster, f, value)
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

    # 댓글은 이제 FK가 아니라 (target_type, target_id)로 붙어 있어 DB가 대신 지워주지 않는다.
    purge_comments("topster", topster.id, db)
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
        .filter_by(user_id=user_id)
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
