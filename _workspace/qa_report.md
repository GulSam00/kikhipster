# QA — 화면 정리 5건 (2026-09-01)

## 경계면

**백엔드 변경 없음.** 응답 스키마·엔드포인트·DB 모두 그대로다. 프론트 표시 계층만 바뀌었다.

새로 쓰기 시작한 필드도 없다 — `TrackSearchItem.album.cover_url` 과
`TournamentSummary.item_type` 은 이미 응답에 있었고 화면이 쓰지 않고 있었을 뿐이다.

## 4번(이미지) 분석 — 원인이 둘로 갈린다

실제 API 응답을 찍어 확인했다.

```
GET /api/music/search/artists?q=아이유
  image_url=None  IU
  image_url=None  I.U.

GET /api/music/search/tracks?q=아이유
  cover_url=https://is1-ssl.mzstatic.com/image/thumb/Music124/...  Blueming
  cover_url=https://is1-ssl.mzstatic.com/image/thumb/Music221/...  Never Ending Story
```

| 대상 | 원인 | 이번 조치 |
|------|------|-----------|
| **곡** | 커버는 **정상적으로 온다**. `TrackRow` 가 `albumCover` 를 받고도 그리지 않았다 | 고쳤다(`showCover`) |
| **아티스트** | iTunes 아티스트 엔티티에 **이미지 필드가 아예 없다**. `_map_artist` 가 `None` 을 하드코딩 | 데이터가 없어 불가 — 아래 참조 |

**아티스트 우회로(미채택)**: `/lookup?id={artistId}&entity=album&limit=1` 로 최신 앨범 커버를
인물 사진 자리에 쓴다. 2026-08-20 에 검증까지 했으나 "앨범 위주 도메인이라 인물 사진은 필수
아니다"로 채택하지 않은 기록이 `docs/WORKLOG.md` 에 있다. 되살리려면 그 판단부터 뒤집어야
하고, **아티스트 1명당 요청 1회가 더 나가므로**(검색 20명이면 20회, 배치 불가) 캐시가 필수다.

## 접근성

`TrackRow` 행 클릭을 `<div onClick>` 이 아니라 `absolute inset-0` `<button>` 으로 만들었다.
DESIGN.md § Component states 는 raw `<div onClick>` 에 `hover:`·`focus-visible:ring-*` 이
없으면 BLOCK 으로 본다 — 진짜 `<button>` 이면 그게 따라온다.

재생 버튼은 덮개와 동작이 같아 `aria-hidden`·`tabIndex={-1}` 로 보조기술·탭 순서에서 뺐다.
같은 곡에 "미리듣기" 두 개가 읽히는 것을 막는다.

## 색 예산

새로 넣은 배지는 전부 무채색(`variant="outline"` + `text-muted-foreground`)이다.
월드컵 대시보드는 카드가 여러 장, 상세는 이미 `PlayLauncher` 가 primary 라 여기에 색을
더하면 § Color budget 에 걸린다.

## 미검증

`PlayerDock` 볼륨(재생 중에만 렌더) · `TournamentCard` 배지(클라이언트 무한 스크롤) ·
탑스터 상세 액션 줄(Client Component) · 행 클릭 동작. TASKS 에 남겼다.
