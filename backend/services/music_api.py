# TODO: [OpenAPI] 음악 API 미정. 연동 시 아래 함수들을 교체할 것.


def search_artists(query: str) -> list[dict]:
    """외부 음악 API로 아티스트 검색 (현재 mock)"""
    return [{"id": "mock_1", "name": f"Mock Artist: {query}", "image_url": None}]


def search_albums(query: str) -> list[dict]:
    """외부 음악 API로 앨범 검색 (현재 mock)"""
    return [{"id": "mock_1", "title": f"Mock Album: {query}", "cover_url": None}]


def get_artist_detail(artist_id: str) -> dict | None:
    """아티스트 상세 정보 (현재 mock)"""
    return {"id": artist_id, "name": "Mock Artist", "genre": "Unknown"}
