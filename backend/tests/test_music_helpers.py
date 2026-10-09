"""iTunes 응답을 다루는 순수 함수. 네트워크를 타지 않는다.

여기 규칙은 전부 **실측으로 정해진 것**이라(깨지면 조용히 빈 화면이 된다) 회귀 방지 가치가 크다.
"""
import pytest

from services.music_api import _album_type, _search_country, _upscale_artwork, is_single_or_ep


@pytest.mark.parametrize("market,expected", [("KR", "US"), ("kr", "US"), ("US", "US"), ("JP", "JP")])
def test_search_storefront_never_uses_kr(market, expected):
    """KR 스토어프론트는 음악 카탈로그가 비어 /search 가 앨범·곡 0건을 돌려준다."""
    assert _search_country(market) == expected


def test_artwork_is_upscaled_and_none_is_kept():
    url = "https://is1.mzstatic.com/image/thumb/Music/x/100x100bb.jpg"
    assert _upscale_artwork(url).endswith("600x600bb.jpg")
    assert _upscale_artwork(url, 300).endswith("300x300bb.jpg")
    assert _upscale_artwork(None) is None and _upscale_artwork("") is None


@pytest.mark.parametrize(
    "title,expected",
    [
        ("Love Poem - EP", True),
        ("Through the Night - Single", True),
        ("Through the Night – single", True),  # en dash, 대소문자 무시
        ("Palette", False),
        ("Sleep", False),  # 단어 끝 EP 오탐 방지
        ("feelslikeimfallinginlove (Single Version)", False),  # 괄호 표기 오탐 방지
        ("NewJeans 2nd EP 'Get Up'", False),  # 필터는 꼬리만 본다
        ("", False),
    ],
)
def test_is_single_or_ep_looks_only_at_the_suffix(title, expected):
    assert is_single_or_ep(title) is expected


@pytest.mark.parametrize(
    "title,tracks,expected",
    [
        ("Love Poem - EP", 6, "ep"),
        ("Through the Night - Single", 1, "single"),
        ("Hello - Single", 3, "single"),  # 표기가 트랙 수보다 우선
        ("NewJeans 2nd EP 'Get Up'", 4, "ep"),  # 중간 EP 는 종류 판정에만 쓴다
        ("In a Silent Way", 2, "album"),
        ("Palette", 1, "single"),  # 표기가 없으면 트랙 수로 추정
        ("Palette", 12, "album"),
        ("Deep Sleep", 10, "album"),  # 소문자 'ep' 는 EP 가 아니다
    ],
)
def test_album_type_trusts_the_label_before_the_track_count(title, tracks, expected):
    assert _album_type(title, tracks) == expected
