from datetime import datetime

from sqlalchemy import Column, DateTime, String

from database import Base


class ArtistName(Base):
    """아티스트의 한국어 이름. iTunes 아티스트 ID 하나에 한 행.

    iTunes 는 아티스트 이름을 KR 에서도 영어로 준다(`IU`). 한국어 표기는 외부에서 찾아야 하고,
    찾는 데 외부 호출이 2~3번 든다. 그래서 **아티스트 상세를 처음 열 때 한 번 찾아 영구 저장**한다.
    `music_cache` 에 넣지 않는 이유는 TTL 이 있는 캐시가 아니라 한 번 확정되면 안 변하는 데이터이고,
    검색 결과 카드가 이 표만 읽어 이름을 붙이기 때문이다(검색 한 번에 외부 호출을 N번 하지 않는다).

    - `name_ko` 가 값이면: 확정된 한국어 이름. 다시 찾지 않는다.
    - `name_ko` 가 NULL 이면: 찾아봤지만 없었다(= 영어 이름 그대로). `NOT_FOUND_RETRY_DAYS` 뒤에 한 번 더 찾는다 —
      Wikidata 는 사람들이 계속 채워 넣는 데이터라 나중에 생길 수 있다.
    - 외부 호출이 **실패한** 경우는 행을 만들지 않는다. 실패를 '없음'으로 적으면 영구히 영어로 남는다.
    """

    __tablename__ = "artist_names"

    artist_id = Column(String, primary_key=True)  # iTunes artistId
    name_ko = Column(String, nullable=True)
    # 어디서 찾았는지: "wikidata" | "itunes_album" | "none"
    source = Column(String, nullable=False)
    fetched_at = Column(DateTime, default=datetime.utcnow, nullable=False)
