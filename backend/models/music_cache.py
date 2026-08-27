from datetime import datetime

from sqlalchemy import Column, DateTime, Index, String
from sqlalchemy.dialects.postgresql import JSONB

from database import Base


class MusicCache(Base):
    """iTunes 조회 결과 캐시.

    이미지 **바이트**가 아니라 **메타데이터**를 담는다. 커버는 mzstatic이 호스팅하는
    URL(`.../600x600bb.jpg`)이라 우리가 다시 서빙할 이유가 없고, 우리가 매번 부담하는 건
    "이 앨범 ID의 커버 URL이 뭐냐"를 알아내는 iTunes 왕복이다. 그 답만 저장한다.

    payload는 services/music_api.py 의 _map_album / _map_track 이 만든 dict 그대로다.
    즉 API 응답 스키마(AlbumSummary / TrackSearchItem)와 같은 모양이라 꺼내서 바로 돌려줄 수 있다.
    스키마가 바뀌어 검증에 실패하면 캐시 미스로 취급하고 다시 받아온다.
    """

    __tablename__ = "music_cache"

    # iTunes id는 전역 고유하지만 트랙과 앨범이 같은 번호를 쓸 수 있으므로 타입까지 묶어 PK로 둔다.
    #
    # 배치 조회용 두 종류로 시작했다가 단건 조회 경로(2026-08-27)까지 같은 테이블을 쓰게 됐다.
    # 종류마다 item_id의 의미와 payload 모양이 다르다:
    #
    #   item_type           | item_id                                  | payload
    #   --------------------|------------------------------------------|---------------------------
    #   album               | collectionId                             | AlbumSummary
    #   track               | trackId                                  | TrackSearchItem
    #   artist_detail       | artistId                                 | ArtistDetail
    #   album_tracks        | "{albumId}:{market}"                     | AlbumWithTracks
    #   artist_albums       | "{artistId}:{market}:{limit}:{singles}"   | {"items": [AlbumSummary]}
    #   artist_top_tracks   | "{artistId}:{market}"                    | {"items": [TrackSearchItem]}
    #
    # 목록류의 item_id에 파라미터를 다 붙이는 이유는 그것들이 응답을 가르기 때문이다 —
    # 하나라도 빠지면 필터를 끈 요청이 켠 결과를 받는다.
    # TTL은 services/music_cache.py 의 ITEM_TYPE_TTL_DAYS 가 정본이다.
    item_type = Column(String, primary_key=True)
    item_id = Column(String, primary_key=True)
    # NULL = tombstone. iTunes lookup이 이 ID를 못 찾는다는 사실 자체를 기록한 것이다.
    # 검색은 돌려주는데 lookup으로는 안 풀리는 앨범 ID가 실제로 존재해서 필요하다.
    #
    # none_as_null=True 가 꼭 필요하다. 기본값이면 Python None이 SQL NULL이 아니라
    # **JSON null** 로 저장돼서 `payload IS NULL` 이 거짓이 된다. Python 쪽은 둘 다 None으로
    # 읽어 동작은 같지만, DB에서 직접 tombstone을 세거나 지울 수 없게 된다.
    payload = Column(JSONB(none_as_null=True), nullable=True)
    fetched_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        # TTL 만료분 정리·조회에 쓴다.
        Index("ix_music_cache_fetched_at", "fetched_at"),
    )
