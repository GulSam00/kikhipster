# QA — 앨범 제목 정리 + 싱글·EP 필터 해제 (2026-08-31)

## 경계면 정합성

**응답 필드는 하나도 바뀌지 않았다.** 이번 변경은 (a) 기존 필드의 *값* 판정 규칙
(`album_type`), (b) 쿼리 파라미터 *기본값*(`include_singles`), (c) 프론트의 *표시* 가공뿐이다.

| 스키마 | 백엔드 `schemas/music.py` | 프론트 `types/music.ts` | 판정 |
|--------|--------------------------|------------------------|------|
| `AlbumSummary` | id · title · cover_url · artist_name · release_date · total_tracks · album_type | 동일 7개 | 일치 |
| `AlbumWithTracks` | album · tracks | 동일 | 일치 |
| `TrackSearchItem.album` | id · name · cover_url | 동일 | 일치 |

프론트 `cleanAlbum` 은 제네릭 `<T extends { title: string }>` 이라 필드를 더하거나 빼지 않고
`title` 만 바꾼다. `cleanTrack` 도 `album.name` 만 바꾼다. 따라서 **타입 변경이 필요 없다** —
실제로 `tsc --noEmit` 0.

DB 스키마 변경 없음 · 마이그레이션 없음. 제목은 저장하지 않는다
(`topster_items.album_spotify_id`, `tournament_items.item_id` 둘 다 id 만 든다).

## 규칙 두 벌이 어긋나지 않는지

제목 정리(프론트)와 종류 판정(백엔드)이 **서로 다른 파일의 같은 정규식**을 쓴다.
어긋나면 "제목은 정리됐는데 배지는 `album`" 또는 그 반대가 된다.

| | 패턴 | 위치 |
|---|------|------|
| 백엔드 꼬리 | `\s[-–—]\s*(single\|ep)\s*$` (IGNORECASE) | `music_api.py` `_SINGLE_EP_SUFFIX` |
| 프론트 꼬리 | `/\s[-–—]\s*(?:single\|ep)\s*$/i` | `album-title.ts` `SINGLE_EP_SUFFIX` |
| 백엔드 중간 | `\sEP\s` (대소문자 구분) | `music_api.py` `_ALBUM_EP_MID` |

꼬리 패턴은 동일(프론트는 캡처만 비캡처로). 중간 EP 는 **판정 전용**이라 프론트에 대응물이
없는 것이 맞다. 양쪽 주석에 "한쪽을 고치면 다른 쪽도 본다"를 남겼다.

실제 렌더로 교차 확인: `Zero (J.I.D Remix) - Single` → 제목 `Zero (J.I.D Remix)` + 배지 `Single`
(제목에서 뗀 정보가 배지에 그대로 살아 있음).

## 발견해서 고친 것

**`capitalize` 가 `ep` 를 `Ep` 로 렌더** — 앨범 상세 배지. 필터 때문에 `Album` 외의 값이
화면에 거의 안 떠서 그동안 드러나지 않았고, 필터를 푸는 이번 변경으로 처음 보이게 됐다.
`albumTypeLabel()` 로 교체해 `EP` 확인.

## 미해결 — 이번 범위 밖

**아티스트 앨범 목록에 `NJWMX` 중복.** collectionId 가 실제로 다르다(`1719675892`,
`1719868691`, 발매일 동일). iTunes 가 같은 앨범을 두 발매본으로 들고 있는 것이고
필터와 무관하다(필터를 켜도 둘 다 남는다). 접으려면 `(artistName, collectionName)` 으로
중복을 제거해야 하는데 리마스터·디럭스처럼 **구분해야 하는 재발매**까지 접히므로
판단이 필요하다. TASKS 에 남긴다.

## 눈으로 확인하지 못한 것

- `/search` 앨범 탭 — 정적 페이지 + 클라이언트 fetch 라 SSR HTML 에 결과가 없다
- 탑스터 PNG 다운로드의 앨범 목록 — 캔버스 렌더
- 월드컵 후보·대결·랭킹 — 로컬 DB 에 앨범 월드컵 데이터가 있어야 확인 가능

셋 다 `lib/api/music.ts` 를 타므로 같은 결과일 것이나, **본 것은 아니다.**
