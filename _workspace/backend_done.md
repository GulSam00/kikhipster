# backend 구현 완료 — 앨범 제목 정리 + 싱글·EP 필터 해제

## 수정 파일

### `backend/services/music_api.py`

| 변경 | 내용 |
|------|------|
| `_ALBUM_EP_MID` 신규 | `re.compile(r"\sEP\s")` — 제목 **중간**의 EP 표기. 대소문자 구분 |
| `_album_type` | 판정 2단계 → 3단계. 꼬리 → **중간 EP** → 트랙 수 |
| `is_single_or_ep` | 규칙은 그대로(꼬리만). docstring 에 "판정과 다르다"는 이유를 명시 |
| `search_albums` | `include_singles` 기본값 `False` → `True` |
| `get_artist_albums` | 같음 |

`SEARCH_OVERFETCH` 로직은 손대지 않았다 — `fetch = ... if not include_singles else want`
라서 기본값이 뒤집히면 자동으로 꺼지고, 필터를 켠 호출에서는 그대로 동작한다.

### `backend/routers/music.py`

`/search/albums`, `/artists/{id}/albums` 의 `Query(False, ...)` → `Query(True, ...)`.
docstring 도 현재 동작에 맞게 고쳤다.

## 판정 규칙이 필터 규칙과 다른 이유

`is_single_or_ep`(필터)는 **꼬리만** 보고 `_album_type`(판정)은 **꼬리 + 중간 EP** 를 본다.
일부러 다르다 — 필터를 켠 쪽(`include_singles=false`)이 기대하는 것은 "iTunes 가 꼬리로
분류한 싱글·EP"이고, 중간 EP까지 거르면 `NewJeans 2nd EP 'Get Up'` 같은 정규 미니앨범을
잃는다. 그건 이번에 고치려던 문제 그 자체다.

## 검증

**단위 — 12케이스 전부 통과**

```
ep      How Sweet - EP              single  Supernatural - Single
ep      NewJeans 2nd EP 'Get Up'    single  Ditto - Single
ep      NewJeans 1st EP 'New Jeans' album   feelslikeimfallinginlove (Single Version)
ep      Com Lag: 2+2=5 - EP         album   Sleep / Deep / NJWMX / In a Silent Way
single  Waltz for Cassiopeia
```

`is_single_or_ep` 분리 확인: `NewJeans 2nd EP 'Get Up'` → `False`, `How Sweet - EP` → `True`.

**실측 — 고유 앨범 4206건 (25개 질의, iTunes 직접)**

중간 EP 규칙으로 새로 `ep` 가 되는 것은 **3건뿐이고 전부 정탐**이다:
`NewJeans 1st EP 'New Jeans'`, `NewJeans 2nd EP 'Get Up'`,
`NewJeans Karaoke Piano EP (Piano Karaoke)`. **오탐 0건.**

**엔드포인트 — 실제 기동해서 호출**

- `GET /search/albums?q=NewJeans&limit=20` → 20건, 싱글·EP 포함, `total` 20
- 같은 질의 `&include_singles=false` → 8건 (옛 동작 그대로 살아 있음)
- `GET /artists/1635469693/albums?limit=20` → 16건 (필터 시 4건)
- `album_type` 이 응답에서 `ep`/`single`/`album` 으로 정확히 갈림

## 이번 변경과 무관하게 발견한 것

`NJWMX` 가 아티스트 앨범 목록에 **두 번** 나온다. collectionId 가 실제로 다르다
(`1719675892`, `1719868691`, 발매일 둘 다 2023-12-19) — iTunes 가 같은 앨범을 서로 다른
발매본으로 들고 있는 것이라 우리 쪽 중복이 아니다. 필터와도 무관하다(필터를 켜도 둘 다 남는다).
화면에서 지우려면 `(artistName, collectionName)` 으로 중복을 접어야 하는데, 그러면
리마스터·디럭스처럼 **일부러 구분해야 하는 재발매**까지 접힌다. 손대지 않았다.
