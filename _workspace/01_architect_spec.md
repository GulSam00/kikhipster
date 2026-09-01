# 화면 정리 5건 (2026-09-01)

요청:
1. 토너먼트·탑스터 상세의 버튼 레이아웃 — 하트는 맨 마지막 중앙, 주요 기능 버튼은 키우고 중앙
2. `PlayerProvider` 볼륨을 하단 재생 바 **우측**으로
3. 앨범 상세에서 **곡 행을 눌러도 재생**, 재생 버튼을 행 맨 앞(번호 앞)으로
4. 검색에서 아티스트·곡 이미지가 안 나오는 문제 분석
5. 월드컵 페이지에서 곡 월드컵인지 앨범 월드컵인지 구분

## 4번 분석 결과 — 원인이 서로 다르다

실제 API 응답을 찍어 확인했다.

| 대상 | 응답 | 원인 | 고칠 수 있나 |
|------|------|------|--------------|
| 아티스트 | `image_url=None` (전건) | **iTunes 아티스트 엔티티에 이미지 필드가 아예 없다.** `_map_artist` 가 `None` 을 하드코딩한다 | 데이터가 없으므로 그대로는 불가 |
| 곡 | `album.cover_url` 이 **정상적으로 온다** | **`TrackRow` 가 `albumCover` 를 받고도 그리지 않는다.** 재생 큐에 넘길 때만 쓴다 | **UI만 고치면 된다** |

곡은 이번에 고친다. 아티스트는 우회로가 있으나(아래) 이번 범위에서는 보고만 한다 —
2026-08-20 에 같은 우회로를 검증하고 "앨범 위주 도메인이라 인물 사진은 필수 아니다"로
채택하지 않은 기록이 `docs/WORKLOG.md` 에 있다. 되살리려면 그 판단부터 뒤집어야 한다.

**아티스트 우회로**: `/lookup?id={artistId}&entity=album&limit=1` 로 최신 앨범 커버를
가져와 인물 사진 자리에 넣는다. 아티스트 1명당 요청 1회가 더 나가므로 검색 결과 20명이면
20회다 — 배치가 안 되는 구조라 캐시가 필수다.

## 1. 상세 액션 줄 (`DetailActionBar`)

지금은 `justify-between` 으로 **primary 왼쪽 / engage 오른쪽**이다. 이걸
**세로 2단 중앙**으로 바꾼다.

```
        [ 이미지 저장 ]              ← primary, 키움
      [ ♡ 12 ]  [ 공유 ]            ← engage, 아래 중앙
```

- `flex-col items-center` 로 쌓고 primary 가 위, engage 가 아래
- primary 버튼을 `h-11` → `h-12`, 좁은 화면에서는 폭을 채운다(`w-full sm:w-auto`)
- `flex-wrap` 은 유지 — 없으면 소유자 모바일에서 가로 스크롤이 난다(과거 실제 사고)

`DetailActionBar` 한 곳만 고치면 탑스터·월드컵 두 상세가 같이 바뀐다.

## 2. 볼륨 위치

**컨트롤 줄(아래 줄) 오른쪽 끝**, `duration` 텍스트 뒤로 옮긴다.

2026-08-30 에 위 줄로 뺐던 이유가 320px 가로 스크롤이었다. 그 제약은 그대로이므로
**슬라이더는 `sm` 이상에서만 보인다**는 규칙을 유지한 채 옮긴다. 음소거 버튼도 `sm`
이상으로 내린다 — 모바일 컨트롤 줄은 이미 꽉 차 있다. 모바일에서 음소거를 잃지 않도록
**위 줄에 음소거 버튼만 남긴다**(`sm:hidden`).

## 3. `TrackRow` 재구성

새 순서: **재생 버튼 → 번호 → (커버) → 제목·아티스트 → 시간 → 하트**

- **행 전체 클릭으로 재생.** `AlbumCard` 가 쓰는 "덮는 버튼" 패턴을 따른다 —
  `absolute inset-0` 버튼을 깔고 하트·재생 버튼은 그 위(`z-10`)에 둔다.
  `<div onClick>` 으로 만들면 § Component states 상 hover·focus ring 을 직접 붙여야 하고
  키보드 접근이 빠지기 쉽다. 실제 `<button>` 이면 그게 공짜로 온다.
- 행이 `relative` 가 되어야 한다.
- **커버는 `showCover` 로 켠다.** 앨범 상세는 전곡이 같은 커버라 켜지 않는다.
  검색 곡 탭에서만 켠다.

## 5. 월드컵 종류 표시

`TournamentCard` 제목 옆에 `곡` / `앨범` 배지. 라벨은 이미 있는 `ITEM_TYPE_LABEL` 을 쓴다.

2026-08-27 에 '앨범 N'·'플레이 N' 배지를 뺀 기록이 카드 주석에 있는데, 그때 뺀 것은
**수량**이고 지금 넣는 것은 **종류**다. 수량은 `ItemStats` 와 겹쳤지만 종류는 겹치는
정보가 없다 — 썸네일만으로는 앨범 커버인지 곡 커버인지 구분되지 않는다(둘 다 앨범 아트다).

색은 `AlbumTypeBadge` 와 같은 문제를 피해 **무채색**으로 간다. 대시보드는 카드가 여러 장
깔리는 화면이라 primary 를 쓰면 § Color budget 에 걸린다.

## 변경 파일

| 파일 | 변경 |
|------|------|
| `components/common/DetailActionBar.tsx` | 세로 2단 중앙 |
| `app/topsters/[id]/TopsterDetail.tsx` · `app/tournament/[id]/page.tsx` | primary 버튼 크기 |
| `components/tournament/PlayLauncher.tsx` | 같은 크기로 맞춤 |
| `components/layout/PlayerDock.tsx` | 볼륨을 컨트롤 줄 우측으로 |
| `components/music/TrackRow.tsx` | 순서 재배치 · 행 클릭 · 커버 |
| `app/search/page.tsx` | 곡 탭에 `showCover` |
| `components/tournament/TournamentCard.tsx` | 종류 배지 |

백엔드 변경 없음. DB·스키마 변경 없음.
