"""아티스트 한국어 이름 해석·저장.

근거와 실측은 `_workspace/spike_ko_names_README.md` — 요약:
  1. Wikidata 의 P2850("Apple Music artist ID")이 iTunes artistId 와 같은 ID 공간이다.
     그 항목의 한국어 라벨(`rdfs:label` lang=ko)이 한국어 이름이다.
  2. Wikidata 에 항목이 없는 아티스트(에픽하이·혁오 등)는 KR `/lookup?entity=album` 이 주는
     앨범의 `artistName` 중 **순수 한글 단독 표기**를 쓴다.
  3. 둘 다 없으면 한국어 이름 없음 — 영어 그대로 둔다.
"""
from __future__ import annotations

import logging
import re
from collections import Counter
from datetime import datetime, timedelta
from typing import Awaitable, Callable

import httpx
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.artist_name import ArtistName

logger = logging.getLogger(__name__)

WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
# Wikidata 는 식별 가능한 User-Agent 를 요구한다(없으면 403).
WIKIDATA_HEADERS = {
    "User-Agent": "kikhipster/0.1 (https://github.com/GulSam00/kikhipster)",
    "Accept": "application/sparql-results+json",
}
NOT_FOUND_RETRY_DAYS = 30

_HANGUL = re.compile(r"[가-힣]")
# 순수 한글 단독 표기: 한글(+숫자·공백·마침표·가운뎃점·하이픈)만. '&'·',' 가 들어간 협업 표기는 걸러진다.
_PURE_HANGUL = re.compile(r"^[가-힣0-9\s·.\-]+$")
_TRAILING_PAREN = re.compile(r"\s*\([^)]*\)\s*$")


def clean_label(label: str | None) -> str | None:
    """Wikidata 한국어 라벨 → 표시용 이름. 한글이 없으면 None.

    - 끝의 괄호 동음이의 표기를 뗀다: `딘 (가수)` → `딘`.
    - 한글이 하나도 없는 라벨(NewJeans·EXO 처럼 영문 표기를 한국어 라벨로 둔 것)은 병기할 한국어 이름이
      아니므로 None.
    """
    if not label:
        return None
    name = _TRAILING_PAREN.sub("", label).strip()
    return name if name and _HANGUL.search(name) else None


def pick_hangul_artist_name(names: list[str]) -> str | None:
    """앨범들의 artistName 중 순수 한글 단독 표기를 고른다(가장 많이 나온 것)."""
    pure = [n.strip() for n in names if n and _PURE_HANGUL.match(n.strip()) and _HANGUL.search(n)]
    if not pure:
        return None
    return Counter(pure).most_common(1)[0][0]


async def fetch_wikidata_label(client: httpx.AsyncClient, artist_id: str) -> str | None:
    """P2850 으로 항목을 찾아 한국어 라벨을 돌려준다. 항목·라벨이 없으면 None. 네트워크 실패는 예외."""
    # artist_id 는 쿼리 문자열에 들어가므로 숫자만 허용한다(SPARQL 주입 방지).
    if not artist_id.isdigit():
        return None
    query = (
        f'SELECT ?ko WHERE {{ ?item wdt:P2850 "{artist_id}" . '
        f"OPTIONAL {{ ?item rdfs:label ?ko FILTER(LANG(?ko)='ko') }} }}"
    )
    resp = await client.get(
        WIKIDATA_SPARQL,
        params={"query": query, "format": "json"},
        headers=WIKIDATA_HEADERS,
        timeout=15.0,
    )
    resp.raise_for_status()
    for row in resp.json().get("results", {}).get("bindings", []):
        label = clean_label(row.get("ko", {}).get("value"))
        if label:
            return label
    return None


async def resolve_ko_name(
    client: httpx.AsyncClient,
    artist_id: str,
    fetch_album_artist_names: Callable[[str], Awaitable[list[str]]],
) -> tuple[str | None, str]:
    """(한국어 이름 또는 None, source). 외부 호출이 실패하면 예외를 그대로 올린다 — 저장하지 말라는 뜻."""
    label = await fetch_wikidata_label(client, artist_id)
    if label:
        return label, "wikidata"
    album_name = pick_hangul_artist_name(await fetch_album_artist_names(artist_id))
    if album_name:
        return album_name, "itunes_album"
    return None, "none"


def get_stored(db: Session, artist_ids: list[str]) -> dict[str, str | None]:
    """저장된 이름을 {id: name_ko|None} 로. '없음'이 오래돼 재시도할 때가 된 행은 뺀다."""
    if not artist_ids:
        return {}
    cutoff = datetime.utcnow() - timedelta(days=NOT_FOUND_RETRY_DAYS)
    rows = db.query(ArtistName).filter(ArtistName.artist_id.in_(artist_ids)).all()
    return {r.artist_id: r.name_ko for r in rows if r.name_ko or r.fetched_at >= cutoff}


def save(db: Session, artist_id: str, name_ko: str | None, source: str) -> None:
    row = db.get(ArtistName, artist_id)
    if row is None:
        db.add(ArtistName(artist_id=artist_id, name_ko=name_ko, source=source, fetched_at=datetime.utcnow()))
    else:
        row.name_ko, row.source, row.fetched_at = name_ko, source, datetime.utcnow()
    try:
        db.commit()
    except IntegrityError:
        # 같은 아티스트 상세를 동시에 연 다른 요청이 먼저 적었다 — 같은 값이라 버려도 된다.
        db.rollback()
