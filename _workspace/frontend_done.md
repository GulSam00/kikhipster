# frontend 구현 완료 — 앨범 제목 꼬리 제거 + 배지 라벨

## 파일

### `frontend/lib/domain/album-title.ts` (신규)

- `stripAlbumSuffix(title)` — 제목 끝의 ` - Single` / ` - EP` 제거.
  정규식은 백엔드 `_SINGLE_EP_SUFFIX` 와 같은 패턴이다(주석에 "한쪽을 고치면 다른 쪽도 본다"고 남김).
- `albumTypeLabel(type)` — `album`/`single`/`ep` → `Album`/`Single`/`EP`.

**중간 EP 는 떼지 않는다.** 꼬리는 iTunes 가 덧붙인 분류표지만 `NewJeans 2nd EP 'Get Up'`
의 EP 는 이름의 일부다 — 떼면 `NewJeans 2nd 'Get Up'` 이 된다.

### `frontend/lib/api/music.ts`

`cleanAlbum` / `cleanTrack` 을 두고 앨범이 들어오는 **모든** 경로에 걸었다:

| 함수 | 소비처 |
|------|--------|
| `searchAlbums` | 검색 앨범 탭, 탑스터 편집기, 월드컵 편집기 |
| `getArtistAlbums` | 아티스트 상세 |
| `getAlbumWithTracks` | 앨범 상세 |
| `getAlbumsByIds` | 탑스터 격자·목록·**PNG**, 월드컵 후보·대결·우승·랭킹 |
| `searchTracks` · `getTracksByIds` · `getArtistTopTracks` | 곡이 물고 있는 `album.name` |

**여기 한 곳에 건 이유**: 이 파일이 앨범 데이터가 프론트로 들어오는 유일한 문이고
`/api/music` 문자열도 여기에만 있다. 화면마다 떼면 반드시 빠뜨리는 곳이 생긴다
(특히 PNG 렌더와 OG 썸네일).

**백엔드에서 떼지 않은 이유**: `music_cache` 는 매핑을 마친 값을 저장한다.
백엔드에서 떼면 이미 저장된 행이 최대 30일간 옛 제목을 계속 내보내서 한 화면에
정리된 제목과 안 된 제목이 섞인다.

### `frontend/app/albums/[id]/page.tsx`

배지를 `className="capitalize">{album.album_type}` 에서
`{albumTypeLabel(album.album_type)}` 로 바꿨다.

**`capitalize` 는 `ep` 를 `Ep` 로 렌더한다.** EP 는 Extended Play 의 약어라 두 글자를 다
올려야 한다. 필터 때문에 `Album` 외의 값이 화면에 거의 안 떠서 그동안 드러나지 않았다 —
필터를 푸는 이번 변경으로 처음 보이게 됐고, 실제 SSR HTML 에서 `Ep` 로 나오는 것을 확인하고 고쳤다.

## 검증

`tsc --noEmit` 0 · eslint 0 · `next build` 통과.

**실제로 띄워서 SSR HTML 확인** (백엔드 8000 + 프론트 3300 기동):

| 경로 | 원문 | 렌더된 제목 | 배지 |
|------|------|------------|------|
| `/albums/1692987809` | `Zero (J.I.D Remix) - Single` | `Zero (J.I.D Remix)` | `Single` |
| `/albums/1695951888` | `NewJeans 2nd EP 'Get Up'` | 그대로 유지 | `EP` |
| `/albums/1719675892` | `NJWMX` | 그대로 | `Album` |

`/artists/1635469693`(뉴진스) 페이지 전체 HTML 206KB 에서 **`- Single` · `- EP` 잔여 0건**,
그러면서 `Ditto`·`Super Shy`·`How Sweet` 등 싱글·EP 앨범은 정상 노출(필터 해제 확인).

## 확인하지 못한 것

`/search` 는 정적 페이지 + 클라이언트 fetch 라 SSR HTML 로는 결과 목록을 볼 수 없다.
같은 `lib/api/music.ts` 를 타므로 동작은 같겠지만 **눈으로 본 것은 아니다.**
탑스터 PNG 렌더도 캔버스라 마찬가지다.

---

# 후속 — 앨범 종류 배지 (색 3종)

요청: 검색 미리보기에서도 ALBUM / EP / SINGLE 을 각기 다른 색 배지로 표시.

## 색을 새 토큰으로 뺀 이유

DESIGN.md § Color budget 이 정한 saturated 토큰은 `primary`(amber)와 `destructive` **둘뿐**이라
3종을 색으로 가를 수 없었다. 게다가 검색 앨범 탭은 **카드가 20개 깔리는 화면**이라 배지에
`primary` 를 쓰면 "한 화면 primary 4개 초과 = BLOCK"에 즉시 걸린다.

그래서 `--album-ep`(보라 293°) · `--album-single`(청색 233°) 두 토큰을 `globals.css` 에
새로 두고 DESIGN.md § Color 에 예외를 명문화했다(2026-08-27 체크박스 예외와 같은 방식).
**amber(70°)와 색상환에서 멀리 두는 것이 조건이다.** `album` 은 가장 흔한 기본값이므로
무채색으로 남겼다 — 셋 다 물들이면 그리드가 시끄러워진다.

채도는 **배경 15% · 테두리 30%** 로 낮춰 커버 아트를 이기지 않게 했다.

## 파일

| 파일 | 변경 |
|------|------|
| `app/globals.css` | `--album-ep` / `--album-single` 라이트·다크 2벌, `@theme inline` 노출 |
| `components/music/AlbumTypeBadge.tsx` | **신규** — 종류별 클래스 + `albumTypeLabel` |
| `components/music/AlbumCard.tsx` | 메타 줄에 배지 |
| `app/albums/[id]/page.tsx` | 상세 배지를 같은 컴포넌트로 교체(직접 쓴 `<Badge>` 제거) |

**배지를 제목 옆이 아니라 메타 줄(`2023 · 12곡`)에 뒀다.** 제목 옆에 붙이면 모바일 2열
(카드 폭 150px 남짓)에서 제목이 배지에 밀려 두세 글자만 남는다 — 종류보다 제목이 먼저다.

`variant="outline"` 위에 덮되 **variant 를 바꾸지 않았다.** `cn()` 은 twMerge 라 variant 가
다르면 다른 그룹으로 보고 둘 다 남기고, 그러면 기본값이 이긴다(CLAUDE.md 의 `SelectTrigger` 사례).

## 검증

`tsc` 0 · eslint 0 · `next build` 통과.

**CSS 규칙이 실제로 생성됐는지 확인했다** — 클래스가 HTML 에 보이는 것은 증거가 아니다(CLAUDE.md).
프로덕션 CSS(`.next/static/chunks/*.css`)에서:

```
--album-ep:#8d54ff / #a685ff        (라이트·다크 2벌 + lab() 폴백)
--album-single:#0084cc / #00bcfe
.bg-album-ep\/15{background-color:color-mix(in oklab, var(--album-ep) 15%, transparent)}
.border-album-single\/30{...}  .text-album-ep{...}
```

**렌더 확인** — `/artists/1635469693` SSR HTML 에서 배지가 종류별로 갈린다: `EP` 3개,
`Single` 11개, `Album` 2개.

**함정 하나**: dev 서버가 `globals.css` 변경을 반영하지 않아 한동안 토큰 0건으로 보였다.
Turbopack 캐시(`.next/dev`)를 지우고 재기동해야 잡힌다 — **CSS 토큰을 추가한 뒤 dev 화면이
그대로면 캐시부터 의심할 것.**
