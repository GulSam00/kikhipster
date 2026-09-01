# 앨범 제목 접미사 정리 + 싱글·EP 필터 해제

> 2026-08-31. 요청: ① 표시되는 앨범 제목에서 `- Single` / `- EP` 꼬리를 떼고
> ② 앨범 검색·아티스트 앨범 목록의 싱글·EP 제외 필터를 해제하며
> ③ `album_type` 판정에 제목 중간의 ` EP ` 규칙을 더한다. 배지는 유지한다.

## 배경 — 2026-08-23 의 해석 오류

당시 요청은 **"제목 뒤에 붙은 `- Single` / `- EP` 가 거추장스럽다"** 였는데, 구현은
**"그런 앨범을 결과에서 빼자"** 로 갔다. 제목을 가공하는 코드는 코드베이스에 없다
(`_map_album` 은 `collectionName` 을 원문 그대로 넘긴다).

그 결과 두 가지가 남았다:

- 필터가 걸린 두 경로(`/search/albums`, `/artists/{id}/albums`)에서는 항목 자체가 없어서
  표기도 안 보인다 — 증상은 가려졌지만 원인은 그대로다
- 필터가 없는 경로(`/albums?ids=`, `/albums/{id}/tracks`)에서는 **표기가 그대로 보인다** —
  탑스터 격자 옆 목록, 탑스터 PNG, 월드컵 후보·대결·랭킹, 앨범 상세

그리고 필터는 **`NewJeans 2nd EP 'Get Up'` 같은 정규 발매작을 통째로 지운다.** K-POP 은
미니앨범이 주력인데 iTunes 가 그걸 `- EP` 로 표기하기 때문이다(newjeans 검색이 8건만
나오던 이유).

## 실측 근거

**표본: 고유 앨범 4206개** (K-POP·해외 25개 질의, iTunes `entity=album&country=KR`)

| 규칙 | 매칭 | 오탐 |
|------|------|------|
| 현행 접미사 `\s[-–—]\s*(single\|ep)\s*$` | 2705건 | — |
| 추가 ` EP ` (대문자, 양쪽 공백) | **3건** | **0건** |
| 위를 대소문자 무시로 완화 | 0건 더 | — |

` EP ` 로 추가로 잡히는 3건은 전부 정탐이다:
`NewJeans 1st EP 'New Jeans'`(4곡), `NewJeans 2nd EP 'Get Up'`(6곡),
`NewJeans Karaoke Piano EP (Piano Karaoke)`(4곡).

소문자 ` ep ` 는 4206건 중 0건이라 **대소문자 무시는 하지 않는다** — 이득이 없으면서
`Deep`/`Sleep` 류 위험만 늘린다(양쪽 공백 요구로 이미 막히지만 굳이 넓힐 이유가 없다).

## 설계

### ① 제목 접미사 제거 — **프론트에서 한다**

**백엔드에서 하지 않는 이유는 캐시다.** `music_cache` 는 `_map_album` 을 거친 **매핑 후**
값을 저장한다(`_warm_item_cache`). 백엔드에서 떼면 이미 저장된 행이 최대 30일간 옛 제목을
계속 내보내서, 같은 화면 안에서 정리된 제목과 안 된 제목이 섞인다.

**적용 지점은 `lib/api/music.ts` 한 곳.** 이 파일이 앨범 데이터가 프론트로 들어오는 유일한
문이고 `/api/music` 문자열도 여기에만 있다. 여기서 정규화하면 아래가 전부 자동으로 따라온다:

| 경로 | 소비처 |
|------|--------|
| `searchAlbums` | 검색 페이지 앨범 탭, 탑스터 편집기, 월드컵 편집기 |
| `getArtistAlbums` | 아티스트 상세 |
| `getAlbumWithTracks` | 앨범 상세 |
| `getAlbumsByIds` | 탑스터 격자·목록·**PNG 렌더**, 월드컵 후보·대결·우승·랭킹(`fetchPoolItems`) |
| `searchTracks` / `getTracksByIds` | 트랙의 `album.name` |

`lib/domain/album-title.ts` 에 `stripAlbumSuffix()` 를 두고 `lib/api/music.ts` 가 부른다.
`domain` 에 두는 이유는 이게 표시 규칙이지 엔드포인트 지식이 아니기 때문이다.

**중간 ` EP ` 는 떼지 않는다.** 접미사는 문장 끝이라 떼도 자연스럽지만 중간의 EP 는 제목의
일부다 — 떼면 `NewJeans 2nd 'Get Up'` 이 되어 망가진다. 중간 규칙은 **타입 판정 전용**이다.

### ② 싱글·EP 필터 해제 — 백엔드 기본값을 뒤집는다

`include_singles` 파라미터는 **남긴다.** 지우면 나중에 "싱글 숨기기" 토글을 붙일 때 다시
만들어야 한다. 기본값만 `False` → `True` 로 바꾼다.

- `services/music_api.py`: `search_albums`, `get_artist_albums` 시그니처 기본값
- `routers/music.py`: 두 엔드포인트의 `Query(...)` 기본값과 설명

오버페치(`limit*3`)는 **코드를 안 고쳐도 된다** — `fetch = ... if not include_singles else want`
라 기본값이 뒤집히면 자동으로 꺼진다. 필터를 켠 호출에서는 그대로 동작한다.

`get_artist_albums` 라우터는 캐시 키에 `include_singles` 를 넣으므로 기존 캐시와 섞이지 않는다.

### ③ `album_type` 에 중간 ` EP ` 규칙 추가

`_album_type` 판정 순서를 이렇게 둔다:

1. 접미사 `\s[-–—]\s*(single|ep)\s*$` → `single` / `ep`
2. **(신규)** 중간 `\sEP\s` (대소문자 구분) → `ep`
3. 그 외 `track_count <= 1` → `single`
4. 나머지 → `album`

`is_single_or_ep`(필터용)는 **접미사 규칙 그대로 둔다.** 필터는 기본으로 꺼지지만,
켰을 때의 의미는 "iTunes 가 꼬리로 표기한 것"이어야 한다 — 중간 EP까지 거르면
`include_singles=false` 를 켠 쪽이 정규 미니앨범을 잃는다. **판정과 필터의 규칙을
의도적으로 분리한다.**

### 배지

`app/albums/[id]/page.tsx` 의 `<Badge>{album.album_type}</Badge>` 는 **그대로 둔다.**
제목에서 꼬리를 떼면 종류 정보를 담는 자리가 배지뿐이라, 오히려 지금부터 필수가 된다.

## 변경 파일

| 파일 | 변경 |
|------|------|
| `backend/services/music_api.py` | `_ALBUM_EP_MID` 추가, `_album_type` 2단계 판정, 기본값 2곳 |
| `backend/routers/music.py` | `include_singles` Query 기본값·설명 2곳 |
| `frontend/lib/domain/album-title.ts` | **신규** `stripAlbumSuffix()` |
| `frontend/lib/api/music.ts` | 앨범·트랙 응답에 정규화 적용 |

DB 스키마 변경 없음(제목은 저장하지 않는다 — `topster_items.album_spotify_id`,
`tournament_items.item_id` 둘 다 id 만 들고 매번 API 로 이름을 받는다). 마이그레이션 없음.
응답 필드 추가·삭제 없으므로 프론트 타입도 그대로다.

## 검증 계획

- `_album_type` 4단 판정을 실제 iTunes 응답으로 재측정 — `ep` 가 3건 늘고 오탐 0인지
- 필터 해제 후 `search/albums` 가 싱글·EP를 돌려주는지, `total` 이 맞는지 (curl)
- `stripAlbumSuffix` 가 오탐 없이 도는지 — `(Single Version)`, `Sleep`, 중간 EP 보존
- `tsc` · `next build` · eslint
