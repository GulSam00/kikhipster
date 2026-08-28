# kikhipster 작업 로그

> 이 파일이 **작업 이력의 정본**이다. CLAUDE.md에는 이력을 적지 않는다.
> 아래 "커밋 이력" 표는 `.claude/hooks/update-changelog.sh` 가 커밋 직후 자동으로 한 줄씩 덧붙인다 — 수동으로 채우지 말 것.
> "세션 기록"은 커밋 메시지만으로 복원되지 않는 판단·검증 결과를 남기는 곳이다. 사람이 쓴다.

---

## 세션 기록

### 2026-08-28 (계속) — 재생기를 큐 기반으로, 앨범 수록곡 조회 복구

"어떤 화면에서 곡·앨범을 누르든 하단 재생목록에 쌓이고 자동으로 이어 재생" 요청.
한 곡짜리 미리듣기였던 `PlayerContext` 를 큐 플레이어로 다시 짰다.

**① 먼저 백엔드가 깨져 있었다 — 앨범 재생의 전제부터 없었다**
"앨범을 누르면 재생"을 하려면 수록곡이 필요한데, `/api/music/albums/{id}/tracks` 가
**K-POP 앨범에서 전수 404** 였다. iTunes lookup 이 스토어프론트마다 다르게 답한다:

| 요청 | US 앨범(Thriller) | KR 앨범(aespa Armageddon) |
|------|-------------------|---------------------------|
| `entity=song` (country 없음 = US) | collection 1 + **track 9** | **결과 0** |
| `entity=song&country=KR` | collection 1 + track 0 | collection 1 + **track 0** |

예전 주석은 "country를 빼면 트랙이 온다"고 적어 뒀는데 **그건 US 앨범 한정**이었다.
`entity=musicTrack`·`media=music`·다른 country 도 전부 확인했지만 KR 앨범은 어느 쪽으로도
트랙이 오지 않는다. 그래서 **① country 없이 → ② `country=KR` → ③ 검색으로 채우기**
3단으로 바꿨다. 검색은 KR 스토어에서도 `previewUrl` 을 정상으로 준다.
결과: Armageddon 10곡·LEMONADE 12곡·Thriller 9곡, preview 전부 있음. 앨범 상세도 200.
**다만 검색 폴백은 전곡을 보장하지 않는다** — 11곡 표기 앨범이 10곡으로 왔다(TASKS 에 남김).

**터뜨린 것: 죽은 uvicorn 이 포트를 계속 물고 있었다**
패치가 반영이 안 돼 한참 헤맸다. `taskkill` 이 "종료됨"을 찍었는데도 `netstat` 에
옛 PID 가 남아 있었고, 새 uvicorn 을 띄우자 **8000 포트에 두 프로세스가 동시에 LISTENING**
상태가 됐다(Windows 는 이걸 막지 않는다). 연결은 옛 프로세스가 받아서 새 코드가 안 돌았다.
로그로 확인한 단서는 "iTunes 요청이 한 번만 나가고 끝난다"였다 — 새 코드라면 3번 나가야 했다.
**포트가 안 듣는지 확인할 땐 `netstat` 으로 PID 까지 보고, 부모(reloader)와 자식을 모두 죽인다.**

**② PlayerContext — 큐 + 진행률**
`queue`/`currentIndex` 로 바뀌고 `enqueueAndPlay`·`next`·`prev`·`seek`·`removeAt`·`move`·
`clear` 가 생겼다. 판단이 들어간 곳:

- **`new Audio()` 를 버리고 `<audio>` 를 렌더 트리에 뒀다.** 곡마다 엘리먼트를 새로 만들면
  리스너를 다시 붙여야 하고 진행률·길이가 전환 순간에 어긋난다.
- **곡 전환 effect 의 의존성은 URL 하나다.** 객체를 넣으면 큐를 재정렬하기만 해도 같은 곡이
  처음부터 다시 재생된다(순서 바꾸다 노래가 끊긴다).
- **effect 안에서 setState 를 안 한다.** eslint `react-hooks/set-state-in-effect` 가 잡았고,
  실제로 맞는 지적이라 재생 상태·진행률·길이를 전부 `play`/`pause`/`loadstart`/`emptied`
  이벤트에서 받게 고쳤다. src 를 떼기만 하면 진행률이 마지막 값에 멈춰 있어 `load()` 로
  `emptied` 를 띄운다.
- **`setQueue` 업데이터 안에서 `setCurrentIndex` 를 부르던 걸 밖으로 뺐다.** 업데이터는
  순수해야 하고, StrictMode 에서 두 번 불리면 인덱스가 두 칸 밀린다.
- 같은 곡을 다시 누르면 큐가 늘어나는 대신 처음부터 다시 재생된다(id 로 중복 제거).
- `prev` 는 3초가 지났으면 이전 곡이 아니라 현재 곡을 처음으로 — 플레이어의 관례이고
  미리듣기가 30초라 이쪽이 실수를 덜 만든다.

**③ 재생기를 fixed 에서 흐름 안으로 옮겼다**
`MiniPlayer`(fixed)는 열려 있는 동안 본문 아래를 가렸다. 재생목록까지 얹히면 가리는 높이가
커져서 `body` 의 세로 flex 에 그냥 끼웠다 — `main` 이 줄어들 뿐 아무것도 가려지지 않는다.
**모바일 하단 탭바 여백(`pb-16`)의 주인도 `main` 에서 `PlayerDock` 으로 옮겼다.** 재생기가
흐름 안에 있으므로 여백도 그쪽에 있어야 탭바 자리가 정확히 한 번만 확보된다.
`MiniPlayer.tsx` 는 지웠고 `PlayerDock`(바) + `PlayerQueue`(펼침 목록)로 갈랐다.

**④ 순서 바꾸기는 손잡이에서만 시작한다**
행 전체를 드래그 대상으로 두면 "눌러서 그 곡으로 이동"과 충돌한다. `@hello-pangea/dnd` 는
탑스터 편집기가 이미 쓰던 것을 그대로 쓰되, 목록 컨테이너는 radix `ScrollArea` 가 아니라
평범한 `overflow-y-auto` 다 — dnd 의 자동 스크롤이 `ScrollArea` 의 뷰포트 한 겹을 못 넘는다.

**⑤ 색 예산 때문에 재생 버튼 대부분이 중립색이다**
DESIGN.md § Color budget 은 한 화면 primary 4개 초과를 BLOCK 으로 본다. 앨범 카드·후보
타일에 primary 원형 버튼을 달면 그리드 한 화면에서 수십 개가 된다. **primary 는 재생 바의
재생 버튼과 앨범 상세의 '전체 재생' 뿐**이고 목록에 깔리는 것은 `secondary`/`ghost` 다.
(재생 바는 재생 버튼 + 슬라이더 진행 구간으로 정확히 2개 — WARN 선에 걸친 값이라 더 안 늘렸다.)

**⑥ 탑스터에는 재생을 안 붙였다**
"어떤 화면 단이든"에 해당하지만 탑스터 격자·앨범 목록은 **사용자가 배경색·글자색을 고른
작품 렌더**다. 버튼을 얹으면 화면과 PNG 다운로드 결과가 달라진다. 대신 앨범 카드가 나오는
검색·아티스트 화면과 월드컵 전 구간(후보 그리드·대결·랭킹)에 붙였다.

**검증**
- `tsc --noEmit`·`next build` 통과, eslint **신규 0건**(전체 2건은 기존)
- 페이지 12종 200 — 홈·검색·목록 2·만들기 2·프로필·로그인·앨범 상세·아티스트 상세·
  월드컵 상세·랭킹·플레이
- SSR HTML 로 확인: 앨범 상세 '전체 재생' 1개, 아티스트 앨범 카드 재생 버튼 11개,
  월드컵 후보 20개·랭킹 20개
- **큐·시크·드래그·자동 다음 곡은 확인하지 못했다** — 전부 클라이언트 상태다(TASKS 에 남김)

### 2026-08-28 (계속) — lib 역할별 분리, 데이터 접근 계층, 규칙 상수 통일

"소스가 아키텍처대로 분리돼 있나" 진단에서 나온 것 중 셋을 처리했다.
(에디터 훅 분리는 파일이 크게 움직여 이번엔 뺐다.)

**① `lib/` 를 역할별로 나눴다 — components 와 축이 다른 게 의도다**
components 는 방금 **도메인**(topster/tournament/social…)으로 나눴는데 lib 는 **역할**로 나눈다.
컴포넌트를 역할(cards/forms/modals)로 나누면 탑스터 하나 고치는 데 세 폴더를 오가고,
lib 를 도메인으로 나누면 `'use client'` 경계가 안 보인다. 계층마다 유용한 축이 다르다.

```
lib/api/     client(구 api.ts) · auth · topsters · tournaments · plays · music · likes · comments
lib/hooks/   use-me · use-delete-item · use-infinite-list · use-like-status
             · use-album-covers · use-topster-grid
lib/domain/  bracket · pool-item · limits(신규)
lib/render/  topster-image · og
lib/utils.ts · lib/site.ts   (어디에도 안 속하는 것만 루트)
```

**② 엔드포인트 문자열을 `lib/api/` 안에 가뒀다**
`apiFetch` 가 19개 파일에 흩어져 있었고 `/api/topsters/{id}` 가 7곳, `/api/tournaments/{id}` 가
7곳에 중복이었다. 지금은 **`app/`·`components/` 의 `apiFetch` 직접 호출이 0건**이고,
`/api/` 문자열은 `lib/api/` 와 주석에만 남았다.

목록류는 함수가 아니라 **경로 빌더**를 내보낸다(`topsterListPath` 등) — `useInfiniteList` 가
경로 문자열을 받아 offset 을 붙여가며 부르는 구조라, 데이터를 반환해 버리면 그 훅을 못 쓴다.
`deletePath` 도 같은 빌더를 쓴다.

**덤으로 나온 중복: 사용자 타입이 세 곳에 서로 다르게 있었다**
`app/profile/page.tsx` 는 `{id,email,nickname,provider}`, `app/profile/[userId]` 는
`{id,nickname,provider}`, `lib/hooks/use-me.ts` 는 `{id,nickname}`. 백엔드 `routers/auth.py`
응답을 확인해 `types/user.ts` 하나로 모았다.

**③ 규칙 상수를 `lib/domain/limits.ts` 로**
`MIN_POOL=4`·`MAX_POOL=512`·`MAX_CELLS=25` 가 에디터 안에 각각 있었다. 정본은 백엔드지만
프론트도 같은 값을 알아야 하고, 어긋나면 **프론트는 통과시키고 백엔드가 422 를 뱉는** 모양으로
터져서 화면에서 원인이 안 보인다. 대응하는 백엔드 위치를 상수마다 주석에 적었다.

**터뜨린 것 둘 — 둘 다 `tsc`·`build` 로는 안 잡혔다**
- **`ViewCounter` 에 함수 prop 을 줬다가 월드컵 상세가 500.** `onView={() => mark…}` 로
  바꿨는데 그 페이지는 Server Component 라 함수를 클라이언트로 넘길 수 없다
  ("Event handlers cannot be passed to Client Component props"). 탑스터 상세는 클라이언트라
  통과해서 더 헷갈렸다. `target="tournament" id={...}` 처럼 **직렬화되는 값만 받고
  어느 엔드포인트를 부를지는 컴포넌트 안에서 고르게** 고쳤다
- **`rm -rf .next/dev` 로 dev 서버를 깨뜨렸다.** turbopack 이 쓰는 중인 캐시라
  "Failed to open SST file" 로 전 페이지가 500 이 됐다. 코드 문제가 아니었는데 잠깐 그렇게 보였다.
  **dev 서버가 도는 동안 `.next` 를 지우지 말 것**

**검증**
- `tsc --noEmit`·`next build` 통과, eslint 신규 0건(전체 2건은 기존)
- **페이지 15종 전부 200** — 홈·검색·목록 2·만들기 2·프로필·로그인·상세 3·수정 2·아티스트·앨범
- **백엔드 로그로 경로를 확인했다** — `GET /api/topsters/?limit=12&offset=0`,
  `/api/tournaments/{id}/ranking` 등이 그대로 도달해 200. 프론트 API 모듈이 만든 문자열이
  예전과 같다는 뜻이다

### 2026-08-28 (계속) — 커서·프리미티브 로컬 수정·폴더 재편·CoverImage

네 갈래 요청을 한 번에 처리했다.

**① 커서 — shadcn 프리미티브에는 `cursor-pointer` 가 하나도 없었다**
`Button` 을 포함해 전부. 앱 코드에서 버튼마다 붙이는 대신 **프리미티브 7종을 고쳤다**
(button, select 트리거·항목, dropdown-menu 항목 4종, checkbox, toggle, tabs).
select·dropdown 은 원래 `cursor-default` 였는데 이건 네이티브 메뉴를 흉내 내는 shadcn 기본값이라
그대로 바꿨다. **`npx shadcn add` 로 다시 받으면 사라지므로 파일 맨 위에 `// [kikhipster]`
주석으로 표시**해 뒀다.

프리미티브가 아닌 raw `<button>` 네 곳(탑스터 검색 결과, 월드컵 앨범 펼치기·후보 토글,
플레이 투표 카드)에도 직접 넣었다. 투표 카드에는 `disabled:cursor-not-allowed` 도 같이 줬다 —
투표 중에는 눌리지 않는데 손 모양이 남아 있으면 먹히는 줄 안다.

**② 폴더 — `components/music/` 한 곳에 24개가 쌓여 있었다**
이름만 보고 무엇이 어디 붙는지 알 수 없었다. 도메인으로 갈랐다:
`common`(8) · `topster`(4) · `tournament`(7) · `social`(2) · `music`(3, 음악 자체) · `layout`(2).
`music/` 에 남긴 건 AlbumCard·ArtistCard·TrackRow 뿐이다. 이동 21개, import 갱신 23개 파일.

**③ CoverImage — 같은 세 줄이 아홉 파일에 있었다**
`relative overflow-hidden bg-muted` + `Image fill object-cover` + "없으면 가운데 아이콘".
모양(정사각/원형)과 크기만 다르고 구조가 같아 `className` 으로 그 둘만 받게 뽑았다.
AlbumCard·ArtistCard·PoolItemTile·랭킹표에 적용했다.

**적용하지 않은 두 곳에 이유를 남겼다** — 이게 이번 추출에서 제일 중요한 판단이다:
- `TournamentEditor` 의 `Cover` 는 **`<button>` 안**이라 콘텐츠 모델이 phrasing content 다.
  `CoverImage` 는 `<div>` 라 넣으면 무효 마크업이 된다. `<span>` 판을 남겼다
- 탑스터 격자 셀은 커버가 없을 때 아이콘이 아니라 **색 블록**으로 칸을 표시하고 배경도
  사용자가 고른 색이라 전제가 다르다

**검증**
- `tsc --noEmit`·`next build` 통과, eslint 신규 0건(전체 2건은 기존)
- 페이지 8종 전부 200 (메인·탑스터 목록·월드컵 대시보드·검색·월드컵 만들기·상세 3종)
- 렌더 확인: 랭킹표 커버 `<img>` 8개(폴백 4개), `cursor-pointer` 가 메인 17·상세 10·랭킹 7곳
- `kikhipster-frontend` 스킬의 디렉터리 트리도 새 구조로 고쳤다 — 낡은 채로 두면
  다음 세션이 `components/music/` 에 또 쌓는다

### 2026-08-28 — 월드컵 편집기의 '빼기'를 탑스터와 같은 방식으로

담긴 목록 타일의 제거가 **우측 상단의 작은 X 버튼**이었다. 탑스터 편집기의 격자 셀은 이미
"클릭하면 제거, hover 하면 딤 위에 X" 방식이라, 같은 화면군에서 제거 방법이 두 가지였다.
타일 전체를 과녁으로 바꿔 작은 X 를 겨냥할 필요를 없앴다.

**탑스터 쪽을 그대로 베끼지는 않았다.** 격자 셀은 `<div onClick>` 이라 키보드로 접근할 수
없다(DESIGN.md § Component states 는 raw `<div onClick>` 에 `hover:` 와 `focus-visible:` 을
요구한다 — BLOCK). `PickedTile` 은 원래 `<Button>` 이라 접근성이 있었으므로, 타일 클릭으로
바꾸면서 그걸 잃으면 퇴보다. `<button>` 으로 감싸고 `group-focus-visible:opacity-100` 을
같이 걸어 **키보드 포커스에서도 오버레이가 뜬다.**

용어는 화면의 기존 말인 '빼기'를 유지했다(탑스터는 '제거'). 딤은 커버 이미지 위에 얹히는
것이라 시맨틱 토큰으로 표현할 수 없어 탑스터와 같은 `bg-black/60` 을 쓰고, radius 는
`Card` 의 `rounded-xl` 에 맞췄다 — 안 맞추면 모서리에서 딤이 삐져나온다.

**검증**
- `tsc --noEmit`·`next build` 통과, eslint 신규 0건, `/tournament/new` 200
- **담긴 목록은 항목을 담아야 나타나므로 SSR 로는 빈 상태만 확인된다** — hover·포커스
  오버레이는 사람이 봐야 한다

### 2026-08-27 (계속) — 두 상세의 UI 통일, 파괴적 동작 분리

탑스터 상세와 월드컵 상세가 같은 서비스의 화면으로 안 보이는 문제. **먼저 어긋난 지점을
코드에서 뽑아 표로 만들고 시작했다** — 눈대중으로 "비슷하게" 맞추면 다음에 또 갈린다.

어긋나 있던 것: 컨테이너 폭(5xl/4xl), 헤더 순서, 작성일 유무, 작성자 링크 여부,
집계 표시(양쪽 다 없음), 공유 라벨('링크 복사'/'공유'), 버튼 radius, 액션 줄이
콘텐츠 위냐 아래냐.

**표를 만드는 과정에서 실제 버그가 하나 나왔다**
탑스터 상세의 액션 줄은 `flex items-center` 로 **`flex-wrap` 이 없었다.** 소유자가
모바일에서 열면 좋아요·공유·수정·삭제 네 개가 `size="lg"` 로 한 줄에 묶여 페이지가
가로로 밀린다 — § Mobile 의 "가로 스크롤 발생 금지"(BLOCK) 위반이다. 월드컵 쪽은
`flex flex-wrap` 이라 멀쩡했다. 통일하면서 자연히 사라졌다.

**수정·삭제를 `⋯` 드롭다운으로 뺀 이유는 셋이다**
- 되돌릴 수 없는 삭제가 좋아요와 **같은 크기로 8px 옆에** 있었다
- 소유자면 버튼이 4~6개, 방문자면 2~3개라 같은 화면의 줄 길이가 사람마다 달랐다
- `destructive` 상시 노출이 `primary`(시작하기)와 겹쳐 § Color budget 의
  "primary와 destructive가 동시에 두드러지면 WARN"(amber↔red-orange 근접)에 걸렸다

`npx shadcn add dropdown-menu` 로 프리미티브를 들였다(package.json 은 안 바뀌었다 —
radix 의존성이 이미 있었다). 기존 sonner 확인 토스트는 그대로라 **메뉴에서 한 번,
토스트에서 한 번, 두 단계**가 된다.

**44px 터치 타깃은 프리미티브만으로 못 채운다**
`button.tsx` 의 아이콘 사이즈는 `icon-lg` 가 36px 로 가장 크다. 보이는 크기를 키우면
`⋯` 하나가 제목만큼 커지므로, **`after:-inset-1`(4px×2)로 히트 영역만 44px 로 넓혔다.**

**좋아요·공유를 콘텐츠 아래로 내렸다**
둘 다 내용을 보고 나서 하는 판단이다. 월드컵 상세는 이 줄이 후보 그리드 **위**에 있어서
후보를 보기도 전에 좋아요를 권하는 순서였다. 1차 CTA(시작하기·랭킹보기 / 이미지 저장)를
같은 줄 왼쪽에 두고 참여 동작을 오른쪽으로 몰았다(`DetailActionBar`).

**덤으로 메운 구멍: 상세에서 PNG 저장**
`downloadTopsterImage` 는 `TopsterEditor` 에만 붙어 있었다. 즉 **내가 만드는 중에만**
저장할 수 있고 남의 탑스터는 방법이 없었다. 순수 함수라 상세에서 그대로 부를 수 있어
1차 CTA 자리에 넣었다.

**폭은 `max-w-4xl` 로 통일했다.** 탑스터가 `5xl` 이었는데, 캔버스는 높이
(`h-[min(70vh,560px)]`) 기준으로 셀을 계산해서 격자 자체는 안 줄고 옆의 앨범 목록 칸만
좁아진다. 실제로 답답한지는 봐야 안다 — TASKS.md 에 남겼다.

**뒤이어 손본 것 (같은 세션)**
- 월드컵 상세의 '앨범 N'·'플레이 N' 배지도 뺐다. 카드에서만 빼고 상세에는 남겨 뒀었는데,
  통일된 헤더에서는 그 줄이 제목 위 한 칸을 통째로 차지한다. **후보 수는 `후보 N` 제목에,
  누적 플레이 수는 랭킹 화면 머리말(`누적 플레이 N판 기준`)에 그대로 있다** — 두 숫자가
  사라진 게 아니라 한 번씩만 나오게 됐다. 배지 슬롯 자체는 남겨 뒀고 탑스터의 격자 크기만 쓴다
- '랭킹보기'의 `rounded-full` 을 뗐다. 같은 그룹의 '시작하기'가 기본 `rounded-lg` 라
  둘이 나란히 있으면 알약 하나만 튄다. 결과적으로 **왼쪽(콘텐츠 동작)은 `rounded-lg`,
  오른쪽(참여 동작)은 `rounded-full`** 로 그룹이 모양으로도 갈린다

**강수 선택 화면을 없앴다 (같은 세션, 방향 전환)**
바로 앞 세션에 만든 `/tournament/{id}/play` 를 라우트째 지우고, 상세의 1차 CTA 자리에
`PlayLauncher`(select + 시작하기)를 놓았다. 그 화면이 하던 일이 **제목·후보 미리보기를
다시 보여주고 강수를 고르게 하는 것**이라, 방금 그 정보를 다 보여준 상세에서 한 번 더
페이지를 넘길 이유가 없었다. 고를 값이 하나뿐이라 select 로 충분하다.

딸려 온 것 둘:
- **카드의 '시작하기'를 상세로 되돌렸다.** 앞 작업에서 `/tournament/{id}/play` 로 보내
  두었는데 그 주소가 없어졌다. 카드는 좁아서 select 를 넣을 자리가 아니다
- `PlayStarter`(ToggleGroup 판)를 지웠다. `ToggleGroup` 자체는 탑스터 목록이 계속 쓴다

**SSR 에서 select 가 비어 있던 것**
`<SelectValue />` 를 비워 두면 Radix 가 선택값을 **클라이언트에서** 채운다. SSR HTML 에
빈 칸이 나가고 하이드레이션 직후 "8강"이 들어오며 폭이 튄다. 값이 controlled state 라
`<SelectValue>{size}강</SelectValue>` 로 직접 그려 서버·클라이언트가 같은 글자를 내게 했다.

**select 를 주황으로 올리고, 랭킹 행을 키웠다 (같은 세션, 사용자 피드백)**
- `PlayLauncher` 의 select 가 `secondary` 라 **주황 버튼 옆에 회색 상자가 붙은 꼴**이었다.
  둘이 한 동작이라는 게 읽히지 않고 색만 어수선하다. select 도 `bg-primary` 로 올리고
  경계는 배경색이 아니라 `border-primary-foreground/25` 한 줄로 냈다 — 같은 면 위의
  분할선이라는 뜻이다. chevron 은 `text-muted-foreground` 기본값이라 주황 위에서 안 보여
  `text-primary-foreground/70` 으로 덮었다. **덩어리 전체가 primary 강조 하나**로 카운트된다
- 랭킹 행: 커버 `size-10`→`size-16`, 제목 `text-sm`→`text-lg`, 부제·추이 `text-xs`→`text-sm`,
  셀에 `py-3`. **비율과 분수를 위아래로 나눴다** — 행이 커지자 한 줄에 붙여 둔 두 숫자가
  빈 가로 공간에 떠 보였고, 큰 값이 비율·작은 값이 근거라는 관계도 이쪽이 낫다

**그런데 그 주황이 화면에서는 회색이었다 (같은 세션, 사용자 지적)**
`SelectTrigger` 기본 클래스의 `data-[size=default]:h-8` 과 `dark:bg-input/30` 이
내가 얹은 `h-11 bg-primary` 를 이기고 있었다. `cn()` 은 `twMerge` 라 **variant 가 다르면
다른 그룹**으로 보고 둘 다 남기는데, 속성 선택자가 붙은 쪽이 specificity 에서 이긴다.
게다가 이 앱은 `dark` 고정이라 `dark:` 가 항상 적용된다. 결과적으로 **클래스는 붙어 있는데
높이 32px·회색**이었다.

**내 검증 방식이 틀렸던 게 진짜 원인이다.** SSR HTML 에서 `bg-primary` 가 보이는 걸 확인하고
"적용됨"으로 판정했는데, 봐야 했던 건 **기본값이 사라졌는지** 였다. `data-[size=default]:h-11`,
`dark:bg-primary` 로 같은 variant 를 다시 써서 `twMerge` 가 기본값을 지우게 고쳤고,
검증도 "남아 있으면 안 되는 클래스 0개"로 바꿨다. **CLAUDE.md 함정 목록에 넣었다.**

**그러고도 높이가 안 맞았다 (같은 세션, 사용자 재지적)**
색과 `h-11` 을 맞춘 뒤에도 두 요소가 다른 크기로 보였다. 렌더된 클래스를 나란히 놓고서야
보였는데, **버튼에는 `border`(1px)가 있고 select 에는 `border-0`, 패딩도 `px-2.5` vs `px-4`**
였다. `globals.css` 의 `* { @apply border-border }` 때문에 버튼에만 테두리가 보이고 폭도 달랐다.

속성별로 하나씩 맞추는 방식 자체가 틀렸다 — **`buttonVariants({ size: 'lg' })` 를 통째로
얹어** 테두리·패딩·글자·전이를 한 벌로 가져오고, 그 위에 셋만 덮었다: `justify-between`
(select 는 값과 chevron 을 양끝으로 밀어야 해서 `justify-center` 를 되돌린다),
`data-[size=default]:h-11`, `dark:bg-primary`(뒤 둘은 위에 적은 variant 규칙 때문).
대조 결과 `h-11`·`px-2.5`·`gap-1.5`·`text-sm`·`font-medium`·`border`·`rounded-lg` 가 일치한다.

**펼쳐지는 목록도 고쳤다 (같은 세션)**
`SelectContent` 기본값 `position="item-aligned"` 는 네이티브 select 처럼 **트리거를 덮으면서**
현재 항목을 트리거 자리에 맞춘다. 여기서는 트리거가 버튼 절반인 컨트롤이라 그게 덮이면
무엇을 누른 건지 사라진다. `popper` + `align="start"` 로 컨트롤 바로 아래에 펼치고,
폭은 `min-w-36`(144px) 대신 `min-w-(--radix-select-trigger-width)` 로 잡아 트리거와 같은
너비에서 시작해 긴 항목("128강")에 맞춰 늘어나게 했다. 항목에는 `py-2` 를 줘서 h-11
트리거와 밀도를 맞췄다.

**이건 SSR 로 검증할 수 없다** — `SelectContent` 는 Portal 이라 열려야 DOM 에 생긴다.
`tsc`·`next build` 까지가 한계다.

**마지막으로 두 칸의 너비를 같게 맞췄다.** `flex` 에서는 각자 콘텐츠만큼만 차지해서
"8강"과 "시작하기"의 폭이 그대로 벌어진다. 컨테이너를 `grid w-fit grid-cols-2` 로 바꾸고
두 요소에 `w-full` 을 주면 **넓은 쪽에 맞춰 두 칸이 같아진다**. 시작하기의 `Play` 아이콘은
뺐다 — 칸이 넓어지면서 아이콘+텍스트가 가운데 몰려 오히려 답답했고, chevron 하나만 남은
select 쪽과도 균형이 맞는다.

같은 의심으로 랭킹표의 `TableCell`(기본 `p-2` + 내가 준 `py-3`)도 확인했다. 이쪽은 variant 가
없는 순수 유틸리티라 CSS 선언 순서로 갈리는데, **빌드된 CSS 에서 `.py-3`(21018) 이
`.p-2`(20247) 보다 뒤**라 의도대로 12px 이 먹는다.

**DESIGN.md 를 같이 고쳤다.** § Visual reference 의 랭킹 행이 "Melon 의 행 밀도 최대화 논리를
이 표에 국소 적용" 이라고 적고 있었는데, 이번 변경이 정확히 그 반대다. 방침을 철회하고 이유를
남겼다 — **멜론식 밀도는 수백 곡을 스캔하는 차트의 논리이고, 이 표는 후보 수십 개짜리 결과
화면이다.** § Typography 의 `text-lg` 용도에도 랭킹 행을 더했다.

**검증**
- `tsc --noEmit`·`next build` 통과, eslint 신규 0건(전체 2건은 기존).
  라우트를 지운 직후 `tsc` 가 `.next/types/validator.ts` 에서 없는 페이지를 찾는다며 실패했는데,
  이전 빌드가 만든 캐시라 재빌드로 사라진다
- `/tournament/{id}/play` → **404**, 메인 카드 링크에 `/play` 없음
- select 렌더 1개 + `aria-label="강수"`, SSR 초기값 "8강" 표시(고친 뒤)
- 플레이 생성 경로: `POST /plays {"size":8}` → playId → `/play/{id}` 200.
  **검증으로 만든 판은 지웠다**(랭킹 집계에 섞이므로)
- select trigger 에 `bg-primary` 적용·`bg-secondary` 잔존 0, 버튼에 칸막이 클래스 1개
- 랭킹 SSR: `size-10` 0개 / `size-16` 12행분, 셀 `py-3` 12행×5칸분
- 배지 제거 후 월드컵 상세의 `data-slot="badge"` 0개, 액션바 radius 실측:
  시작하기·랭킹보기 `rounded-lg` / 좋아요·공유 `rounded-full`
- 월드컵 상세 SSR: 요소 순서가 `배지 2 → h1 → 집계 → h2(후보) → 시작하기 → 랭킹보기 →
  좋아요 → 공유 → h2(댓글)` 로 의도와 일치. `max-w-4xl` 확인. 비로그인이라 ⋯ 메뉴는 없음(정상)
- 탑스터 상세 200 — 다만 Client Component 라 **SSR HTML 로는 본문을 볼 수 없다**

**안 한 것 — 사람이 봐야 한다**
- ⋯ 메뉴가 실제로 열리는지, 삭제 2단계가 자연스러운지 (소유자 로그인이 필요해 SSR 로는 못 본다)
- 상세의 '이미지 저장'이 실제 PNG 를 내려주는지
- `4xl` 로 좁힌 탑스터 캔버스가 답답하지 않은지

### 2026-08-27 (계속) — 카드 집계 3종, 월드컵 배지 정리, 시작하기 경로

메인 화면 카드 요청 3건. **조회수는 컬럼부터 없었고, 월드컵 좋아요는 누를 데가 없었다** —
착수 전에 코드를 읽어 둘 다 확인하고 물어서 정했다.

**① 조회수 — 상세 GET 에서 올리지 않기로 했다**
가장 쉬운 자리는 상세 GET 이지만 그러면 **수정 화면, OG 썸네일 생성, Next 프리페치까지
전부 조회로 세어진다.** 이 프로젝트는 두 상세가 이미 `opengraph-image.tsx` 를 갖고 있어서
크롤러가 링크를 긁을 때마다 숫자가 오르게 된다. 전용 `POST /{id}/view` 를 두고 상세 화면의
`ViewCounter`(아무것도 그리지 않는 클라이언트 컴포넌트)가 마운트 시 한 번만 부르게 했다.

`sessionStorage` 로 거르는 건 중복 방지이자 **개발 모드 방어**다 — StrictMode 가 effect 를
두 번 실행해서 없으면 로컬에서 매번 2씩 오른다. 증가는 `UPDATE … view_count + 1` 한 문장이다.
읽어서 +1 하고 쓰면 동시 조회에서 한쪽이 덮인다.

**② 좋아요·댓글 수 — 카드마다 세면 목록 한 장에 쿼리가 40번**
`Like`·`Comment` 가 둘 다 `(target_type, target_id)` 구조라 배치 집계 헬퍼를 각 라우터에
하나씩 뒀다(`like_counts`, `comment_counts`). **없는 대상은 키에서 빠지므로 호출부가 0을
채운다**는 규약을 주석에 적었다. 탑스터의 `user/me` 목록은 원래 좋아요를 카드마다 세고
있었는데(N+1) 이번에 같이 배치로 내렸다.

`Like.target_id` 는 String 이고 PK 는 UUID라 **문자열로 바꿔 물어야 한다** — 목록 정렬용
조인이 이미 `cast(Topster.id, String)` 을 쓰고 있던 것과 같은 이유다.

**③ 월드컵 좋아요는 백엔드 작업이 없었다**
`routers/like.py` 는 `target_type` 을 검증하지 않는다. 그래서 상세에 `LikeButton` 을
`targetType="tournament"` 로 붙이고 프론트 `LikeTargetType` 에 한 줄 넣은 게 전부다.
색 예산은 '시작하기'(primary) + 좋아요(눌렸을 때 primary) 2개로 § Color budget 상한 안이다.

**④ 배지 제거와 카드 레이아웃**
월드컵 카드의 '앨범 N'·'플레이 N' 배지를 빼고 그 자리에 집계 한 줄을 넣었다. 상세의 같은
배지는 그대로 뒀다 — 요청이 메인 화면 카드였고, 종류·후보 수는 상세에서 여전히 쓸모가 있다.
탑스터 카드는 **닉네임과 집계를 다른 줄로 나눴다**. 메인은 카드가 6열까지 좁아져서
한 줄에 두면 닉네임과 숫자가 같이 잘린다.

**⑤ 시작하기 → `/tournament/{id}/play`**
`/play/{playId}` 로 바로 보내려면 카드에서 강수를 정해 판을 만들어야 해서, 지난 세션에
분리한 강수 선택 화면이 무의미해진다. 상세를 거치던 한 단계만 줄였다.

**검증**
- 마이그레이션: 행이 있는 상태로 downgrade→upgrade 왕복 확인
- `POST /view`: 204, 없는 id 404, 2회·3회 호출 후 목록·상세의 `view_count` 가 각각 2·3 으로 일치
- 집계: 댓글·좋아요를 직접 심어 목록과 상세가 같은 수를 내는지 확인(검증 행은 남겨 두지 않았다)
- **쿼리 수 실측**: 탑스터 5장 3회, 월드컵 3장 5회 — 카드 수에 비례하지 않는다
- **브라우저에서 실제로 동작했다.** 백엔드 로그에 `OPTIONS` 프리플라이트를 동반한
  `POST /view` 가 찍혔다(curl 은 프리플라이트를 내지 않는다). 열려 있던 탭에서 `ViewCounter`
  가 돌아 월드컵 조회수가 3→4 로 올랐다
- SSR HTML: 메인의 `data-slot="badge"` 0개(배지 제거됨), 상세는 2개 유지, 카드마다
  조회·좋아요·댓글 라벨 3종, '시작하기' href 가 `/play` 로 끝남
- `tsc --noEmit`·`next build` 통과, eslint 신규 0건(전체 2건은 기존 `Navbar`·검색 화면)

**안 한 것**
- 조회수에 유니크 집계가 없다. 탭을 새로 열면 다시 센다 — 카드에 보여줄 대략의 인기 지표로 뒀다
- 댓글 좋아요는 여전히 화면이 없다(모델·API 는 그대로 있다)

### 2026-08-27 (계속) — T5 기능 요청 6건

접수한 7개 요청(플레이 흐름 2건은 한 덩어리라 6건으로 묶임)을 순서대로 처리했다.
**착수 전에 코드를 읽어 보드 기록과 다른 점을 두 번 더 잡았다.**

**① 상세의 수정·삭제 — 기존 기획과 부딪혀 한 번 멈췄다**
삭제는 원래도 있었다. 다만 **수정 화면 안에** 있었다(`OwnerEditButton` 주석의 "삭제는 수정 화면 안에 있다"가
그 설계였다). 요청대로 상세에 노출하면 진입점이 상세·수정 화면·프로필 카드 3곳이 되고 확인 토스트도 3벌이
된다. 물어서 **수정 화면에서 빼기로** 정했고, 확인 로직을 `lib/use-delete-item.ts` 한 벌로 모았다.
삭제 후에는 상세 페이지가 사라지므로 목록으로 보내고 `router.refresh()` 로 캐시된 목록을 갱신한다.

**② 담긴 목록 카드화**
요청이 정확했다 — 담긴 목록은 제목만 든 `Badge` 나열이고 썸네일은 검색 결과 행에만 있었다.
상세의 후보 그리드(`PoolItemTile`)와 같은 모양으로 맞췄다. '빼기' 버튼을 **중립으로 두고 hover에서만
destructive** 로 가는 건 예전 Badge 동작을 이은 것이다 — 타일마다 붉은 버튼을 상시 노출하면 풀이 커질수록
화면이 경고문처럼 보인다.

**③ 공개/비공개 제거 — 자동 생성된 downgrade가 그대로면 실패했다**
`alembic revision --autogenerate` 가 만든 downgrade 는 `nullable=False` 컬럼을 `server_default` 없이
되살린다. **행이 있는 상태에서 되돌리면 NOT NULL 위반으로 죽는다.** `server_default=true` 로 채운 뒤
default 를 떼어 원래 모양으로 되돌리게 고쳤고, 행 5개가 있는 채로 왕복을 돌려 확인했다.
컬럼에 걸려 있던 것들도 같이 사라졌다 — 목록 필터, 상세의 403 분기(그래서 `get_optional_user` 의존성도
불필요해졌다), 댓글의 `_assert_writable`. **비공개 탑스터에 대한 403 경로 자체가 없어진 것**이라
검증에서 "예전엔 403이던 상세가 이제 200"까지 확인했다.

**④ OG 메타데이터 — 기존 렌더는 재활용할 수 없었다**
`lib/topster-image.ts`(252줄)는 `'use client'` 에 `CanvasRenderingContext2D`·`toBlob` 기반이다.
OG 썸네일은 크롤러가 URL을 긁을 때 **서버에서** 만들어져야 하는데 `ImageResponse` 는 satori 기반이라
canvas를 못 쓴다. 서버로 옮기려면 `node-canvas` 네이티브 의존성이 붙어 Fargate 이미지 빌드에 부담이 된다 —
그래서 새로 그렸다. satori 에는 Tailwind 도 CSS 변수도 없어 **DESIGN.md 토큰의 실제 색값을 `lib/og.tsx`
에서만 하드코딩**한다.
탑스터 상세는 `'use client'` 라 `generateMetadata` 를 붙일 수 없어 서버/클라이언트로 나눴다.
처음엔 커버를 186×210으로 깔았다가 `objectFit:cover` 가 정사각 커버의 위아래를 잘라내서,
630 영역을 2×2(315)·3×3(210) **정사각** 셀로 바꿨다.

**⑤ 강수 선택을 `/tournament/{id}/play` 로 분리**
`playId` 는 강수를 정해야 서버가 만들어주므로(`POST /plays` 본문에 `size`) 강 선택 화면은 `/play/{playId}` 를
쓸 수 없다. 월드컵 하위 주소를 쓰면 주소에 대상이 남아 새로고침에 견디고, 뒤로가기가 상세로 떨어지며,
`/play/[playId]` 와 라우팅이 겹치지 않는다(`/play/new` 였다면 `playId="new"` 로 잡힐 자리를 두고 다퉜다).

**⑥ 플레이 화면 개편 — DESIGN.md 를 먼저 고치고 시작했다**
정본에는 "'대진표 보기' → `Dialog` 안 pan/zoom" 으로 적혀 있어 요청("배경 상시 + 우측 상단 전환")과
어긋났다. 이번 세션에만 정본이 코드보다 낡은 걸 두 번 고쳤던 터라 **코드보다 문서를 먼저** 고쳤다.
갈리는 지점 두 개는 물어서 정했다:
- **모바일에서는 배경 트리를 렌더하지 않는다.** 좁은 화면에서는 페이지가 가로로 밀리거나(§ Mobile 위반)
  알아볼 수 없게 줄여야 한다. 전환 버튼으로만 본다
- **배경에는 현재 경기와 승자가 올라갈 자리까지만** 그린다. 128강에서 전체를 깔면 선과 점의 덩어리가 되고,
  "올라간다"는 것도 이 범위에서 가장 잘 읽힌다

승자가 올라갈 자리는 서버가 명시적으로 주지 않아 **"다음 라운드의 `match_num` = 현재의 절반(내림)"**
규칙으로 찾는다(완전 이진 트리라 성립). 투표는 서버 응답 전에 표시를 먼저 바꾸고(누른 직후가 피드백이
의미 있는 순간) 한 박자 뒤 다음 경기로 넘어가되, `prefers-reduced-motion` 이면 대기 없이 넘어간다.

**검증**
- 상세 소유자 버튼: 비로그인 SSR 에 삭제 버튼 0개(소유자에게만 노출)
- `is_public`: 목록 5/5(예전 비공개 포함), 응답에 필드 없음, 상세 전부 200, 유저별 3/3, 404 유지, 댓글 목록 200.
  마이그레이션 downgrade→upgrade 왕복 확인
- OG: 두 라우트 200 `image/png`(~900KB, 커버가 실제로 박힌 크기), **렌더 결과를 눈으로 확인**,
  `og:title`/`description`/`image` 가 절대 URL로 출력
- 플레이 흐름: `/tournament/{id}/play` 200, 강수 토글 렌더, POST 8강 → 라운드 4개 → `/play/{id}` 200
- `tsc --noEmit`·`next build` 통과, eslint **신규 0건**(전체 2건은 기존)

**안 한 것 — 이게 이번 작업의 가장 큰 빈틈이다**
- **플레이 화면을 브라우저로 못 봤다.** 카드 확대·배경 대진표·전환·애니메이션은 전부 Client Component 라
  SSR HTML 로는 검증이 안 되고 playwright 도 없다. `tsc`·`next build`·응답 200 까지가 한계였다.
  **사람이 한 번 봐야 한다** — `docs/TASKS.md` T5 에 남겼다
- `FullBracket` 에 실제 연결선을 안 그렸다. 라운드를 열로 놓고 균등 간격으로 쌓기만 한다

### 2026-08-27 (계속) — 캐시 TTL을 한 표로 합치고, 낡은 주석 정리

바로 앞 작업이 남긴 부채 두 건을 닫았다. **둘 다 "내가 방금 만든 것"이라 미루면 다음 사람이 속는다.**

**TTL이 두 곳에 흩어져 있었던 게 문제의 원인이었다**
읽는 쪽은 라우터가 인자로 넘기고(`DETAIL_TTL_DAYS` / `LISTING_TTL_DAYS`), 지우는 쪽은 purge가
자체 기준(가장 긴 30일)을 썼다. 그래서 목록류를 1일로 줄였을 때 purge가 따라오지 않아
**하루면 무효가 되는 행이 29일을 더 버텼다.** 조회 시점에 걸러지니 정확성 문제는 아니지만
공간이 아깝다 — 실측하니 **목록 payload 한 행이 배치 캐시 행의 10배가 넘는다**
(`artist_albums` ~3.6KB vs `album` ~330B).

`ITEM_TYPE_TTL_DAYS` 표 하나로 합치고 조회(`get_cached`·`get_cached_one`)와 정리(`purge_expired`)가
같은 표를 보게 했다. **`get_cached_one` 에서 TTL 인자를 아예 없앤 게 핵심이다** — 호출부가 TTL을
고를 수 있는 한 언제든 다시 어긋난다. 표에 없는 타입은 기본 30일로 잡는다(짧게 잡으면 등록을
잊었다는 이유만으로 조용히 캐시가 안 먹는다).

**모델 주석이 거짓이 돼 있었다**
`item_type = Column(String, primary_key=True)  # "album" | "track"` — 단건 캐시를 붙이면서 6종이 됐다.
종류마다 `item_id` 의 의미와 payload 모양이 달라서(목록류는 파라미터를 다 이어 붙인 키를 쓴다)
표로 적어 뒀다. TTL 정본이 어디인지도 함께 적었다.

**검증**
- **purge**: 6종 × (2일 전 / 31일 전) + tombstone + 미등록 타입을 심고 정리 실행.
  **목록류는 2일 전 행도 지워지고**(TTL 1일 — 이번에 고친 부분), 상세·배치는 2일 전만 남고 31일 전은
  지워졌다. tombstone·미등록 타입까지 15케이스 전부 기대와 일치. 검증 행은 지웠다
- **캐시 회귀**: TTL 인자를 없앤 뒤에도 단건 4경로가 그대로 동작. 단건 캐시를 비우고 재측정해
  **1차 1회 → 2차 0회**(쓰기·읽기 양쪽 확인). `include_singles` 키 분리도 그대로(17 vs 46)
- 재기동 판정은 이번엔 처음부터 **응답이 아니라 기동 로그**로 했다

### 2026-08-27 (계속) — T3 잔여 과제 5건 일괄 처리

**보드에 적힌 문제와 실제 코드가 다른 경우가 두 번 더 나왔다.** 착수 전에 코드를 먼저 읽은 게 매번 이득이었다.

**① 프로필 목록 무한 스크롤**
`use-infinite-list` 를 프로필(내·유저별)에도 붙였다. 목록 화면과 다른 점이 셋 있어 훅을 손봤다:
- **`enabled` 옵션 추가.** 프로필은 사용자 확인이 먼저다. 비로그인으로 `/me/list` 를 먼저 때리면
  로그인 화면으로 넘어가기 **전에** 401 토스트가 뜬다. `enabled: !!me` 로 순서를 강제했다.
  그 대가로 기존 `Promise.all` 병렬이 직렬 2단계가 됐지만, 사용자 카드가 먼저 뜨고 목록이 뒤따르는
  쪽이 오히려 자연스럽다
- **`removeItem` 추가.** 카드마다 삭제 버튼이 있는데 목록을 훅이 소유하게 됐다. 지울 때
  **`offsetRef` 도 같이 당긴다** — 안 당기면 서버 목록이 한 칸 줄어 다음 페이지에서 한 건을 건너뛴다
- **헤더의 개수 표시.** "내 탑스터 4" 의 숫자는 이제 "지금까지 불러온 개수"라 오해를 준다.
  총 개수를 서버가 안 주므로 **`reachedEnd` 일 때만** 숫자를 보인다
하단 블록(sentinel·로딩·재시도·끝 안내)이 4곳으로 늘어 `InfiniteListFooter` 로 뽑고 기존 두 화면도 거기에 맞췄다.

**② DESIGN.md 정본 보정 — 문서가 코드보다 낡아 있었다**
- § Visual reference 의 탑스터 행이 Netflix·Watcha 만 근거로 두고 있었으나 실제 구조는 topsters.org 를 따랐다.
  "구조는 topsters.org, 타일 인터랙션은 Netflix·Watcha" 로 나눠 적었다
- 탑스터 배경색·글자색의 임의 hex 를 **§ Color budget 예외로 명문화**했다. arbitrary value 금지는
  UI 크롬 규칙이고, 여기서 hex 는 스타일이 아니라 **사용자가 입력한 데이터**라는 게 근거다
- 덤으로 "현재 구현과의 격차" 문단이 **"진행 상태가 useState 에만 있어 새로고침하면 사라진다"** 고
  적고 있었다. 월드컵 재설계로 이미 서버에 기록되므로 사실이 아니다 — 고쳐 적었다

**③ 월드컵 풀 전체 보기**
`PoolItemTile` 은 `next/image` 라 기본 lazy 다. 즉 **비싼 건 이미지가 아니라 메타데이터 배치 조회**다
(앞 24개만 보여주던 원래 이유). 그래서 앞 24개는 SSR 그대로 두고 나머지를 `PoolGrid` 의
"더 보기"(48개씩)로 이어 받게 했다.
`initialRequested` 를 서버에서 따로 넘기는 게 핵심이다 — **`initialItems.length` 로 대신할 수 없다.**
iTunes 에서 사라진 항목은 응답에 안 실려 와서 받은 개수가 더 적고, 그 차이만큼 다음 구간의 시작이 밀린다.

**④ iTunes 캐시 후속**
- **단건 조회 4경로**(아티스트 상세 / 아티스트 앨범 / 앨범 트랙 / 아티스트 트랙)에 캐시를 붙였다.
  배치 캐시와 같은 테이블을 쓰되 `item_type` 으로 갈린다(`artist_detail`, `artist_albums`, …)
- **TTL 을 두 종류로 나눴다.** 상세는 30일, **목록류는 1일** — "이 아티스트의 앨범 목록"은 신보가 나오면
  실제로 바뀌어서 30일을 걸면 새 앨범이 한 달 동안 안 보인다
- **응답을 가르는 파라미터를 전부 캐시 키에 넣었다**(`artist:market:limit:include_singles`).
  하나라도 빠지면 필터를 끈 요청이 켠 결과를 받는다
- **검색은 캐시하지 않되 결과 항목을 배치 캐시에 write-through 한다.** 질의어는 키 적중률이 낮지만,
  검색 응답 항목이 배치 응답과 **같은 스키마**(AlbumSummary/TrackSearchItem)라 그대로 재사용된다.
  실제 사용 흐름이 늘 "검색 → 고르기 → 저장 → 목록에서 커버 배치 조회"라 이게 제일 크게 먹는다.
  `put_cached` 에 `requested=[]` 를 넘기는 게 중요하다 — 넘기면 검색에 안 걸린 ID 를 tombstone 으로 남긴다
- **만료 행 정리**(`purge_expired`)를 앱 기동 시 1회 돌린다. 만료분은 재조회되면 덮어써지지만
  **다시 조회되지 않는 행은 영원히 남는다.** 별도 스케줄러를 안 둔 건 배포 원칙상 상시 구동이 아니라
  기동이 곧 주기이기 때문이다(CLAUDE.md)

**⑤ 랭킹 집계를 SQL 로 — 이번 세션에서 가장 위험했던 변경**
플레이·라운드를 전부 파이썬으로 끌어와 두 번 돌던 것을 SQL group by 로 내렸다.
한 라운드가 `item_a`/`item_b` 두 칸을 쓰므로 **UNION ALL 로 한 열로 펼쳐야** 항목 기준 집계가 된다.
`COUNT(DISTINCT play_id)` / `COUNT(*) FILTER (winner_id IS NOT NULL)` / `COUNT(*) FILTER (winner_id = item_id)`
세 개로 기존 루프를 대체했고, 우승 횟수는 `plays` 쪽에서 따로 집계한다.

**검증 (⑤는 옛 구현과 직접 대조했다)**
- **랭킹**: 커밋 이전 `_aggregate` 를 그대로 스크립트에 옮겨 와 같은 입력에 대해 결과를 비교했다.
  기존 월드컵 3개(플레이 4·9·4) + **시드 25플레이/75라운드**(과거·최근·미투표·미완주 혼합)에서
  현재/과거 집계와 `_rank` 결과까지 **전부 일치**. 검증 후 시드는 지웠다
- **캐시**: 판정을 응답이 아니라 **백엔드 로그의 iTunes 외부 요청 수**로 했다(8/27 오전의 교훈).
  단건 4경로 모두 1차 1회 → **2차 0회**. `include_singles` 를 바꾸면 결과가 갈리는 것(17 vs 46)으로
  캐시 키 분리도 확인
- **write-through**: 캐시를 비우면 배치 조회가 iTunes 를 1회 부르고(대조군), 검색을 먼저 하면 **0회**
- **purge**: 재기동 로그에 `music_cache: 만료 행 8개 정리` 가 실제로 찍혔다
- **PoolGrid**: 36개짜리 월드컵을 만들어 SSR HTML 확인 — 타일 **24개**, 버튼 **"더 보기 (남은 12개)"**,
  예전 "외 N개" 문구 사라짐. 확인 후 정리
- `tsc --noEmit` 통과, eslint **신규 0건**(전체 2건은 기존), 주요 페이지 7개 200

**또 옛 프로세스가 응답했다 — 이번엔 리로드가 끝나지 않았다**
`WatchFiles detected changes ... Reloading...` 뒤에 **`Started server process` 가 안 찍혔는데도 요청은 200** 이었다.
그대로 검증했으면 변경 전 코드를 측정할 뻔했다. 태스크를 죽이고 8000 LISTENING PID 를 확인한 뒤
재기동하니 그제야 새 코드로 떴다(purge 로그가 그 증거였다). **재기동 판정은 응답 코드가 아니라
기동 로그로 한다.**

**안 한 것**
- 브라우저 실제 조작은 이번에도 못 했다(playwright 부재). 무한 스크롤 발화와 '더 보기' 클릭은
  코드·SSR DOM·API 계약까지만 확인했다
- 로그에서 **로그인 상태의 GET 에 여전히 프리플라이트(OPTIONS)가 붙는 걸 봤다.** `Authorization` 헤더가
  단순 요청 조건을 깨기 때문이라 8/27 오전의 Content-Type 제거만으로는 안 없어진다. 지금은 그대로 뒀다

### 2026-08-27 (계속) — main push, 색 예산 예외 명문화, 목록 무한 스크롤

**main 을 origin 에 올렸다 (24 → 27커밋)**
`fix/design-budget-and-api-nits` 를 fast-forward 로 넣고 `6bbc96d..8bb3945` push.
로컬에만 있던 월드컵 개편 전체가 이제 원격에 있다. 로컬 브랜치 3개는 전부 main 에 병합된 상태로 남겨 뒀다.

**색 예산(T3) — 코드가 아니라 규칙을 고쳤다**
문제의 `bg-primary` 는 화면이 칠한 게 아니라 **`components/ui/checkbox.tsx` 의 shadcn 기본값**
(`data-checked:bg-primary`)이었다. 프리미티브를 중립으로 내리면 앞으로 생길 모든 체크박스에 영향이 가고
CLAUDE.md 의 "shadcn/ui 위에서 조립한다" 와도 부딪힌다. 그래서 DESIGN.md § Color budget 에
**"선택 상태 폼 컨트롤" 예외**를 명문화했다 — 이미 있던 "반복 콘텐츠 타일" 예외와 같은 논리
("주의를 끄는 강조" vs "상태를 색으로 인코딩")에 같은 형태의 조건(size-4~5, shadcn 기본 스타일)을 달았다.
**코드 변경 0.**

**페이지네이션(T3) — 보드에 적힌 문제가 실제와 달랐다**
"둘 다 `limit=30` 고정" 이라고만 적혀 있었는데, **백엔드는 이미 `limit`/`offset` 을 전부 받고 있었다**
(topster·tournament 의 목록·유저별·내 목록 전부 `Query(20, ge=1, le=100)`). 진짜 막힌 건
(1) 프론트의 `limit:'30', offset:'0'` 하드코딩과 (2) 응답이 `list[...]` 라 **총 개수가 없다**는 것이었다.
그래서 무한 스크롤을 고르면 **백엔드 변경이 0**이 된다 — 총 개수 없이 "응답이 limit 미만이면 마지막 페이지"로 판정하면 되기 때문.

**`lib/use-infinite-list.ts` 로 뽑았다**
두 목록 페이지의 로직이 사실상 같아서(에디터 추출과 같은 이유) 훅으로 공유한다. 설계에서 걸린 것들:
- **스크롤 컨테이너가 `body` 가 아니라 `main` 이다**(`app/layout.tsx` 가 `body overflow-hidden` + `main overflow-y-auto`).
  IntersectionObserver 의 `root` 를 안 주면 `rootMargin` 이 뷰포트 기준이 돼 미리 불러오기가 안 걸린다.
  `el.closest('main')` 을 root 로 준다
- **sentinel 은 첫 로딩 중에도 DOM 에 있어야 한다.** 목록이 그려진 뒤에 붙이면 관찰 시작이 한 박자 늦는다
- **실패 시 자동 로딩을 멈춘다.** 안 멈추면 sentinel 이 계속 보이는 동안 실패 요청이 쏟아진다.
  `reachedEnd`(진짜 끝)와 `failed`(실패로 멈춤)를 따로 두고 후자에만 '다시 불러오기' 버튼을 낸다
- **세대 번호로 늦게 온 응답을 버린다.** 정렬을 바꾼 직후 이전 필터의 응답이 도착해 섞이는 걸 막는다.
  `finally` 의 플래그 해제도 세대가 같을 때만 한다 — 아니면 이미 버려진 요청이 새 요청의 in-flight 를 풀어 버린다
- **id 로 중복을 걸러낸다.** offset 방식이라 보는 사이 새 항목이 앞에 끼면 같은 행이 두 번 온다

**eslint `react-hooks/set-state-in-effect` 를 우회하지 않고 구조를 맞췄다**
`load(true)` 를 effect 에서 직접 부르면 규칙에 걸린다. 이 규칙은 **호출된 async 함수 안까지 추적**해서,
"동기 setState 를 await 뒤로 옮긴다"만으로는 안 풀렸다. 최종적으로 세 가지를 했다:
(1) 필터 변경 시 초기화는 effect 가 아니라 **렌더 중 조정**(`prevKey` 비교, React 공식 패턴),
(2) `load` 의 동기 구간에서는 ref 만 만지고 setState 는 전부 await 뒤,
(3) effect 에서는 `(async () => { await load(true) })()` 로 감싼다 — 코드베이스의 다른 목록 화면과 같은 형태.
`buildUrl` 을 담는 ref 갱신도 렌더 중이라 `react-hooks/refs` 에 걸려서 effect 로 옮겼고,
**그 effect 는 로딩 effect 보다 먼저 선언해야 한다**(effect 는 선언 순서로 실행되므로 key 와 buildUrl 이
같은 렌더에서 함께 바뀔 때 새 URL 이 쓰인다).

**검증**
- **API 계약**: 훅과 같은 방식으로 순회해 일괄 조회 결과와 대조. topsters(4건)·tournaments(3건)를
  `limit=1`·`limit=2` 로 각각 완주 — **중복 0, 순서 완전 일치**, limit 미만이 오는 지점에서 정확히 종료.
  딱 나누어떨어지면 빈 페이지 1회를 더 받고 끝난다(훅도 같은 동작)
- **정렬 4종 + 검색**(topster popular / tournament popular_all·popular_month / topster q=a) 전부
  offset 순회 = 일괄 조회. 인기순은 집계 서브쿼리로 정렬해 tie-break 가 없으면 페이지 경계가 흔들리는데, 그러지 않았다
- `tsc --noEmit` 통과, `next build` 통과, eslint **신규 0건**(전체 2건은 기존 `search/page.tsx`·`Navbar.tsx`)
- 프로덕션 서버로 주요 페이지 5개 200, `/topsters` SSR HTML 에 **sentinel div 가 정확히 1개** 렌더되는 것 확인

**환경 함정 — CLAUDE.md 의 실행 절차가 그대로는 안 먹었다**
`uvicorn --port 8000` 이 `[Errno 13] 바인딩 권한 거부`로 죽었다. 포트 점유가 아니라
`netsh interface ipv4 show excludedportrange protocol=tcp` 에 **7902~8401 이 통째로 예약**돼 있어서다
(8/26 에 3040~3539 로 겪은 것과 같은 현상이고 구간만 바뀌었다 — Docker Desktop 이 뜨면 생긴다).
이번엔 검증용으로 백엔드 8500, 프론트 3600 을 썼다. **다음에 8000 이 안 뜨면 프로세스부터 찾지 말고
예약 구간을 먼저 볼 것.**

**안 한 것**
- **브라우저에서 실제 스크롤은 못 돌렸다** — playwright 가 여전히 없다(설치 없이는 헤드리스 구동 불가).
  IntersectionObserver 가 실제로 발화하는지, `main` root 설정이 맞는지는 **코드와 SSR DOM 까지만** 확인했다
- 로컬 데이터가 탑스터 4·월드컵 3건뿐이라 `limit=30` 기본값에서는 2페이지째가 아예 발생하지 않는다.
  위 검증은 `limit` 을 1~2로 낮춰 계약만 확인한 것이다
- 프로필의 내 목록·유저별 목록은 그대로 `limit` 고정이다. 이번엔 목록 두 곳만 바꿨다

### 2026-08-27 (계속) — 리뷰·감성 태그를 구현 범위에서 제외

**결정: 앨범/곡 평가 기능은 이번 범위에서 만들지 않는다.** 폐기가 아니라 보류다 — 나중에 추가할 수 있다.

- `CLAUDE.md` 목표 문장에서 **"리뷰" 삭제** → 목표는 검색·탑스터·토너먼트·댓글·좋아요 5종
- `docs/TASKS.md` T3에서 리뷰 항목을 빼고 **새 섹션 "언젠가 (지금은 안 만든다)"** 를 만들어 옮겼다.
  "진행 예정"과 구분하려고 섹션을 나눴다 — 착수 계획이 없다는 뜻이지 안 만들기로 확정한 게 아니다
- `_workspace/planning.md` §7 제목·경고 블록 갱신, 맨 끝 "미결 사항"의 유일한 항목이 이걸로 해소됨

**리뷰와 감성 태그를 한 덩어리로 처리했다**
§7이 애초에 **"텍스트 리뷰 대신"** 감성 태그를 쓰자는 안이다. 같은 자리를 놓고 경쟁하는 대안이라
리뷰만 결정하고 태그를 남기면 반쪽 결정이 된다. 되살릴 때도 **둘 중 어느 쪽인지부터** 정해야 한다고
양쪽 문서에 적어 뒀다.

**과제 보드에 없으면 잊힌다 — 이번이 실례다**
감성 태그는 `_workspace/planning.md` 에만 있고 `docs/TASKS.md`·`docs/WORKLOG.md` 어디에도
없었다(grep 확인). 2026-07-06 커밋 이후 그 문서를 한 번도 안 고쳤으니 7주 가까이 미결로 방치된 것이다.
**기획 문서에만 있는 미결은 정본 보드에 올려야 한다.**

**T3에 적혀 있던 근거가 낡아 있었다**
리뷰 항목이 "`Comment` 는 `topster_id` 에 고정돼 있어 대체 불가"라고 적고 있었는데, 8/22에
`(target_type, target_id)` 범용 구조로 바뀌어 그 근거는 더 이상 사실이 아니다. 실제 이유는
**별점 컬럼이 없다**는 것이다(`backend/models/comment.py` 확인 — `content` 텍스트뿐). 옮기면서 고쳐 적었다.

**코드 변경 없음.** 문서 4개(`CLAUDE.md`, `docs/TASKS.md`, `_workspace/planning.md`, 이 파일)만 손댔다.
`planning.md` 헤더의 "상태: 기획 확정 (구현 전)" 도 함께 갱신했다 — 구현이 기획을 한참 앞질러서
그대로 두면 현재 상태를 오해하게 된다. 현재 구현 범위는 `docs/TASKS.md` 표를 본다.

### 2026-08-27 — main 머지, 색 예산·프리플라이트·싱글 필터 3건

**브랜치를 main 에 fast-forward 로 넣었다**
`feat/topster-worldcup-rework` 24커밋. main 에 별도 커밋이 없어 merge commit 없이 들어갔다.
아직 push 는 안 했다 — origin/main 대비 로컬이 24 앞서 있다.

**`uvicorn --reload` 가 변경을 못 잡았다 — 이번 세션 최대 함정**
싱글·EP 필터를 넣고 curl 로 확인했는데 필터 ON/OFF 가 똑같이 46개를 돌려줬다. 코드는 맞았다.
백엔드 로그의 **실제 iTunes 요청 URL 이 `limit=50`** 인 걸 보고서야 옛 프로세스가 응답 중임을 알았다
(내 코드는 overfetch 로 150이어야 한다). WatchFiles 가 파일 변경을 놓친 것이다.
**게다가 새 uvicorn 을 8000에 띄웠더니 "Uvicorn running on 8000" 을 정상적으로 찍었는데도
요청은 계속 옛 프로세스가 받았다** — Windows 라 바인딩이 조용히 겹쳤다. 옛 태스크를 명시적으로
죽이고 나서야 반영됐다. **다음에 백엔드 수정이 안 먹는 것처럼 보이면 응답이 아니라
로그의 실제 외부 요청 URL 을 먼저 볼 것.** 재기동은 옛 프로세스 종료가 선행돼야 한다.

**`apiFetch` 에 헤더 덮어쓰기 버그가 하나 더 있었다**
`headers` 를 먼저 두고 `...options` 를 뒤에 펼치고 있어서, 호출부가 `headers` 를 넘기는 순간
`Authorization` 까지 통째로 덮인다. 지금은 headers 를 넘기는 호출부가 0곳이라 안 터졌을 뿐이다.
Content-Type 을 손대는 김에 `...options` 를 먼저 펼치도록 순서를 뒤집었다.

**검증**
- `apiFetch` 는 브라우저가 없어 `npx tsx` 로 `fetch`·`localStorage` 를 모킹해 단위 확인했다:
  GET → `Authorization` 만, POST+body → `Content-Type` 추가, GET+커스텀 헤더 → `Authorization` 유지
- 아티스트 앨범 필터: 라디오헤드(657515) **46개 → 17개, 싱글·EP 0개**. 필터 OFF 는 46개/29개 그대로.
  백엔드 로그에서 iTunes 요청이 `limit=150`(overfetch) 인 것까지 확인
- `TrackRow`: 앨범 상세 SSR HTML 에서 **미리듣기 버튼 12개 전부 ghost**, `bg-primary` 는
  Navbar 로그인 CTA 1개만 남음 (12 → 1)
- `tsc --noEmit` 통과, eslint 신규 0건, 주요 페이지 8개 전부 200

**안 한 것**
- GET 프리플라이트가 실제로 줄었는지는 브라우저 네트워크 탭으로 못 봤다. 헤더 구성까지만 확인했다
- push 안 함


### 2026-08-26 (계속) — 쌓인 변경 커밋 분할, 월드컵 상세에 댓글 영역

**먼저 미커밋 상태였던 8/26 작업 전체를 6개 커밋으로 나눴다**
23개 파일 수정 + 신규 9개가 한 덩어리로 남아 있었다. 나중에 이 중 하나만 되돌릴 수 있도록
의존 순서대로 쪼갰다: `apiFetch` 204 + `use-me` → 댓글 `edited_at` → 좋아요 배치 → 탑스터 수정·삭제 →
월드컵 수정·프로필 나열 → docs. 뒤 커밋이 앞 커밋의 모듈을 import 하므로 이 순서를 뒤집으면
중간 커밋에서 빌드가 깨진다.

**월드컵 댓글은 백엔드를 손댈 게 없었다**
`/api/comments/tournament/{id}` 는 대상 존재 검증(`_assert_target_exists`)·수정·삭제·월드컵 삭제 시
`purge_comments` 까지 이미 다 있었다. 화면만 없던 상태라 상세 페이지에 `Separator` +
`CommentSection targetType="tournament"` 4줄을 붙인 게 전부다.

**검증 (API 15항목, 전부 PASS)**
빈 목록 → 작성 201(`target_type=tournament` 확인) → 갓 만든 댓글 `edited_at=None` → 같은 내용 PUT은
`edited_at` 미기록 → 다른 내용 PUT은 기록 → 비로그인 작성/수정/삭제 401 → 없는 월드컵 404 →
월드컵 삭제 204 → 댓글 목록 404 → `comments` 행 0건(동반 삭제).
SSR HTML에서 `<h2>` 가 `후보 4` / `댓글 0` 두 개로 렌더되고 빈 상태 문구가 있으며 비로그인이라
입력 폼은 없음을 확인했다. **SSR 단계의 "댓글 0"은 언제나 0이다** — `CommentSection` 이 클라이언트
컴포넌트라 초기 `useState([])` 가 그대로 찍히고 실제 목록은 하이드레이션 뒤에 온다.

**환경 함정 두 개 — 다음에 또 만난다**
- **Docker Desktop이 뜨면 Windows가 TCP 3040~3539를 예약해 `npm run dev`(:3300)가 `EACCES` 로 죽는다.**
  포트 점유가 아니라 `netsh interface ipv4 show excludedportrange protocol=tcp` 에 잡히는 예약 구간이라
  `-H 127.0.0.1` 로 바꿔도 소용없다. 이번엔 검증용으로 3600을 썼다. 항구적으로 고치려면
  `net stop winnat` → `net start winnat` 으로 예약을 풀거나 개발 포트를 구간 밖으로 옮겨야 한다
- backend venv에는 `requests` 가 없다. 검증 스크립트는 `httpx`(FastAPI가 이미 의존)로 쓸 것

**안 한 것**
- 브라우저 클릭 흐름은 이번에도 못 돌렸다(playwright 부재). 로그인 상태에서만 보이는 입력 폼·수정 버튼은
  API 레벨로만 확인했다
- 월드컵 카드·대시보드에는 댓글 수가 안 나온다. 목록 응답에 개수가 없어 붙이려면 스키마부터 손대야 한다

### 2026-08-26 (계속) — 프로필에 월드컵 나열, 내 항목 수정·삭제

**프로필용 월드컵 목록 엔드포인트가 아예 없었다**
탑스터는 `/me/list` 와 `/user/{id}` 가 있는데 월드컵은 대시보드 목록 하나뿐이었다. 둘을 추가하면서
대시보드가 쓰던 카드 조립부(썸네일·후보 수 배치 조회)를 `_summaries()` 로 뽑아 세 경로가 공유하게 했다.
**월드컵에는 `is_public` 같은 공개 플래그가 없다** — 만들면 곧 공개다. 그래서 '내 목록'과 '남의 목록'이
같은 결과를 돌려주고, 엔드포인트만 인증 여부로 갈린다.
`/user/{id}` 와 `/me/list` 는 세그먼트가 2개이고 첫 칸이 리터럴이라 `/{tournament_id}` 와 안 겹친다
(like.py 의 `batch` 와 달리 선언 순서를 신경 쓸 필요가 없다 — 그래도 주석으로 근거를 남겼다).

**월드컵 수정에는 종류 선택 단계가 없다**
만들기 위저드는 3단계(종류 → 정보 → 담기)인데 수정은 2단계다. 백엔드가 `item_type` 을 안 바꾸기 때문이다 —
이미 치러진 플레이의 대진과 종류가 어긋난다. 화면에서 아예 빼서 "바꿀 수 있다"는 인상을 주지 않았고,
수정 페이지도 PUT 본문에 `item_type` 을 안 싣는다.
탑스터 때와 같은 이유로 위저드를 복제하지 않고 `TournamentEditor` 로 추출했다(486줄 → 페이지 22줄).

**카드에 버튼을 넣으려면 `TopsterCard` 구조를 바꿔야 했다**
기존 카드는 전체가 `<Link>` 였다. **앵커 안에 버튼을 넣으면 마크업이 무효고 클릭도 링크에 먹힌다.**
링크가 미리보기·제목까지만 감싸도록 바꾸고 버튼은 그 밖에 뒀다(`TournamentCard` 는 원래 그 구조였다).
그 과정에서 카드 전체 hover 틴트가 `group-hover` 로 안 걸리게 돼 `has-[a:hover]:bg-accent` 로 되살렸다.

**삭제 후 목록은 다시 안 불러온다**
서버가 이미 지웠으니 `setState` 로 그 항목만 빼면 된다. 다시 부르면 왕복이 한 번 더 늘고
화면이 한 번 깜빡인다. 확인 토스트의 `id` 는 삭제 경로로 잡아 **항목마다 하나만** 뜨게 했다.

**검증**
- 백엔드 20항목 — `me/list` 401(비로그인)/200(토큰), 새 월드컵이 최신순 맨 앞, 카드 필드(`item_count`·`preview_item_ids` 4개) 채워짐,
  `user/{id}` 비로그인 조회 가능, 수정(제목·설명·풀 5개 교체·`item_type` 불변·`available_sizes` 재계산),
  비로그인 수정/삭제 401, 삭제 204 → 조회 404 → 댓글 동반 삭제 → `me/list` 개수 복귀
- **대시보드 정렬 4종(recent/popular_all/popular_year/popular_month) 회귀 확인** — `_summaries()` 추출로 목록 응답이
  안 깨졌는지 봐야 했다. 4종 모두 `item_count`·`preview_item_ids` 동일
- 풀 검증 경로가 둘이라는 걸 확인했다: **4개 미만은 스키마가 422**, **중복을 빼서 4개 미만이 되면 라우터가 400**.
  처음엔 전자를 400으로 기대해 테스트가 틀렸던 것이고 동작은 정상이었다
- 월드컵 상세 SSR HTML에서 **비로그인에는 수정 앵커가 렌더되지 않음**을 확인(렌더된 앵커 6개 중 `/edit` 없음).
  `/edit` 문자열 자체는 RSC 페이로드에 클라이언트 컴포넌트 prop 으로 실려 있어, 단순 문자열 검색으로는 판정이 안 된다
- `tsc --noEmit` 통과, `eslint` 신규 0건, 영향 페이지 8개 전부 200

**안 한 것**
- 프로필 화면의 실제 렌더는 못 봤다. 두 프로필 모두 Client Component라 SSR HTML에는 '불러오는 중...' 만 나온다 —
  섹션은 클라이언트 fetch 이후에 그려진다. 호출하는 API는 위에서 전수 검증했다
- 월드컵 상세에는 여전히 댓글 영역이 없다(`CommentSection` 은 tournament 대상을 지원한다). 이번 범위 밖
- 목록은 여전히 `limit` 고정이다 — 페이지네이션은 `docs/TASKS.md` T3에 남아 있다

### 2026-08-26 — T2 완료: 백엔드에 있는데 화면이 없던 기능 4건

네 항목(탑스터 수정/삭제 UI, 댓글 수정 UI, 앨범·트랙·아티스트 좋아요, 탑스터 댓글의 `CommentSection` 통일)을
붙이면서 **화면을 만들기 전에 기존 코드가 실제로 동작하는지부터 확인했고, 거기서 잠복 버그 두 개가 나왔다.**

**잠복 버그 1 — `apiFetch` 가 204를 못 받는다**
`DELETE` 계열은 전부 204(빈 본문)인데 `apiFetch` 는 무조건 `res.json()` 을 불렀다.
빈 본문에 `json()` 을 부르면 `SyntaxError` 라 **삭제가 성공해도 호출부의 `catch` 로 떨어진다** —
기존 댓글 삭제가 "삭제 실패" 토스트를 띄우면서 목록에서도 안 사라지는 상태였다.
로컬 204 서버를 띄워 `json() THREW: SyntaxError` 를 직접 확인한 뒤 `res.status === 204` 를 분기했다.
이걸 안 고쳤으면 이번에 붙인 탑스터 삭제도 똑같이 깨졌을 것이다.

**잠복 버그 2 — `localStorage.user_id` 는 `/profile` 을 거쳐야만 존재한다**
탑스터 상세가 `localStorage.getItem('user_id')` 로 '내 댓글'을 판정했는데, 그 값을 쓰는 곳은
`app/profile/page.tsx` 한 군데뿐이었다. 즉 **프로필을 안 들른 세션에서는 삭제 버튼이 아예 안 떴다.**
`/api/auth/me` 를 쓰는 `lib/use-me.ts` 로 통일했다 — 토큰 유효성까지 같이 검증되는 이점도 있다.
같은 화면에서 페이지와 댓글 영역이 동시에 물어보므로 모듈 캐시를 둬 요청은 한 번만 나간다.
로그아웃 시 `clearMeCache()` 를 부르지 않으면 직전 사용자로 남으므로 `Navbar` 에서 같이 지운다.

**"(수정됨)" 은 `updated_at` 으로 판정할 수 없다 — 컬럼을 새로 넣었다**
`created_at` / `updated_at` 의 `default` 가 각각 `utcnow()` 를 **따로** 호출해서 insert 직후에도
마이크로초가 어긋난다. `onupdate` 도 본문과 무관한 UPDATE에 걸린다. 그래서 1초 오차 같은
휴리스틱 대신 `comments.edited_at`(nullable)을 추가하고, **본문이 실제로 바뀔 때만** 채운다.
같은 내용으로 다시 저장하면 `(수정됨)` 이 안 붙는다 — API로 확인함. 기존 행은 NULL(수정된 적 없음)로 남는다.
마이그레이션 `b3e6c1d84f27`.

**좋아요는 배치 조회를 먼저 만들고 붙였다**
앨범 상세의 트랙이 12행인데 행마다 `GET /api/likes/{type}/{id}` 를 부르면 화면 하나에 13번이다.
`GET /api/likes/batch/{type}?ids=` 를 추가하고(`lib/like-status.ts` 가 `album-covers` 와 같은
"등록 → 한 틱 뒤 합쳐 호출" 방식으로 모은다) 타입당 1회로 줄였다.
**이 라우트는 `/{target_type}/{target_id}` 보다 먼저 선언해야 한다** — 순서가 바뀌면
`/api/likes/batch/track` 이 `target_type="batch"` 로 잡힌다. 실제로 처음에 그렇게 물려서
`{"liked":false,"like_count":0}` 이 돌아왔다(라우터 자체는 순서가 맞았고, uvicorn `--reload` 가
`routers/like.py` 변경을 못 잡아 옛 프로세스가 답한 것이었다. 백엔드를 재기동해 확인).

**색 예산 때문에 좋아요 버튼을 두 톤으로 나눴다**
상세 헤더의 단독 버튼은 눌리면 `bg-primary`(기존 탑스터 상세와 동일), 트랙 행처럼 여러 개가
나열되는 자리는 `tone="inline"` — ghost 버튼에 **채움 + 밝기 단계**로만 상태를 보인다.
DESIGN.md § Color budget 상 primary 강조가 한 화면 4개를 넘으면 BLOCK이기 때문이다.
그 과정에서 **`TrackRow` 의 미리듣기 버튼이 이미 행마다 `bg-primary`** 라는 걸 발견해
(앨범 상세 12행 = primary 12개) `docs/TASKS.md` T3의 DESIGN.md 불일치 항목에 적어 뒀다. 이번 범위 밖이라 안 고쳤다.

**만들기 화면을 복제하지 않고 추출했다**
`/topsters/new` 가 551줄인데 표시 옵션이 8종이라, 수정 화면을 따로 만들면 옵션이 늘 때마다 두 곳을
고쳐야 한다. `components/music/TopsterEditor.tsx` 로 추출하고 두 페이지는 `onSubmit`(POST/PUT)만 다르게 넘긴다
(`new/page.tsx` 551줄 → 27줄). 내부 배치 타입을 `AlbumSummary` → `PoolItem` 으로 바꾼 게 핵심 —
수정 화면이 `/api/music/albums?ids=` 로 받은 걸 변환 없이 그대로 꽂을 수 있다.
**커버가 다 도착하기 전에는 에디터를 안 띄운다.** 먼저 띄우면 에디터가 빈 배치로 `useState` 를
잡아버려 나중에 온 앨범이 반영되지 않는다. iTunes에서 사라진 앨범도 id는 살려 둔다 —
`null` 로 두면 저장할 때 그 칸이 조용히 빠져 사용자가 모르는 사이 앨범이 지워진다.

**검증 (화면이 아니라 API로)**
- 댓글: 작성 → 같은 내용 PUT(`edited_at` 그대로 None) → 다른 내용 PUT(`edited_at` 채워짐) → 두 경로 목록 모두 노출 → 비로그인 PUT 401 → DELETE 204. 11항목 전부 PASS
- 탑스터: 생성 → 옵션 8종 + 아이템 전부 교체 PUT → 값 하나씩 대조 → DELETE 204 → 조회 404 → 댓글도 같이 사라짐. 16항목 전부 PASS
- 좋아요: album·track·artist 각각 토글 on → 배치 조회 반영 확인 → 토글 off. 배치가 요청한 id를 전부 돌려주고 없는 대상도 `{liked:false, like_count:0}` 으로 채우는 것까지 확인
- `tsc --noEmit` 통과, `eslint` 는 기존 2건(`search/page.tsx`, `Navbar.tsx` 의 set-state-in-effect) 외 신규 0건
- 앨범 상세 SSR HTML에 좋아요 버튼 13개(앨범 1 + 트랙 12), 전부 `aria-label` + `aria-pressed` 보유

**안 한 것**
- 브라우저에서 실제 클릭 흐름은 못 돌렸다. playwright 패키지가 이 프로젝트에 없어 설치 없이는 헤드리스 구동이 안 된다 —
  배치가 정말 1회로 합쳐지는지는 백엔드 접근 로그로 확인이 필요하다
- 삭제 확인은 **sonner 토스트의 action 버튼**이다(`components/ui` 에 AlertDialog 프리미티브가 없다). 처음엔 `window.confirm` 으로 뒀다가 앱 전체가 토스트로 통일돼 있어 바꿨다 — 토스트는 저절로 사라지므로 방치하면 '취소'와 같은 결과가 된다(안전한 쪽이 기본값). 놓치지 않게 duration 을 10초로 두고 id를 고정해 연타해도 쌓이지 않게 했다
- 댓글 좋아요(`target_type="comment"`)는 API만 있고 화면은 여전히 없다

### 2026-08-23 (계속) — 앨범 검색에서 싱글·EP 제외

**먼저 패턴을 실측했다 — 추측으로 정규식을 쓰지 않았다**
앨범 검색 900건, 트랙 검색 800건을 뽑아 꼬리를 집계했다.

| 대상 | 결과 |
|------|------|
| 앨범 title 마지막 `" - "` 뒤 | **`Single` 469건(52%), `EP` 79건(9%)**. 나머지는 전부 1~2건짜리 진짜 부제(`The 2nd Album`, `TOKYO DOME (Live)`, `R.I.P Nujabes` …) |
| 트랙 name | **해당 표기 없음**(800건 중 0). 싱글·EP 표기는 컬렉션(앨범) 이름에만 붙는다 |
| 구분자 문자 | 실제로는 **반각 하이픈 `" - "` 하나뿐**. en/em dash 는 안 나왔지만 방어적으로 받아둠 |

즉 "곡 검색에서 - Single 이 보인다"는 건 트랙이 아니라 **앨범 목록** 이야기였다.

**구분자를 반드시 요구해야 한다 — 오탐을 실측으로 확인**
접미만 보면 두 가지가 걸린다: (1) 단어 끝이 EP 인 제목(집계에서 `l` 뒤 `EP` 로 잡힌 1건),
(2) `feelslikeimfallinginlove (Single Version)` 같은 괄호 표기. 그래서 패턴을
`\s[-–—]\s*(single|ep)\s*$` 로 두고 앞의 구분자를 필수로 했다.

**트랙 수 기반 판별은 못 믿는다**
기존 `_album_type()` 은 `track_count <= 1` 이면 single 이었는데, 실측에서
`" - Single"` 표기인데 트랙이 2개 이상인 게 89건, `" - EP"` 인데 10곡짜리(`Com Lag: 2+2=5 - EP`)도
있었다. 반대로 트랙 1~2개인 진짜 앨범도 있다(`In a Silent Way`). **제목 표기를 먼저 믿고
없을 때만 트랙 수로 떨어지도록** 바꿨다 — `album_type` 이 이제 `single`/`ep`/`album` 을 정확히 준다.

**필터를 거는 곳과 안 거는 곳**
- 검다: `GET /api/music/search/albums` (기본값 제외, `include_singles=true` 로 해제 가능)
- **안 건다: `GET /api/music/albums?ids=`** — 이미 저장된 탑스터가 싱글을 담고 있으면
  커버가 안 나와 화면이 깨진다. ID 조회는 사용자가 명시한 대상이므로 거르면 안 된다
- 트랙 검색은 손대지 않았다. 표기 자체가 없다

**오버페치가 필요했다**
싱글·EP를 빼면 결과가 60% 넘게 사라져서, `limit=20` 요청에 그대로 20건만 받아오면
8건짜리 목록이 된다. iTunes에서 `limit*3`(상한 200)을 받아 거른 뒤 잘라낸다.

**검증**
- 12개 질의 189건 전수에서 **싱글·EP 잔여 0건**
- 오탐 없음: `feelslikeimfallinginlove (Single Version)`, `Sleep`, `Sleep (Faded)` 전부 남음
- ID 배치 조회는 필터를 안 탄다 — 싱글 3개 요청 → 3개 반환, `album_type` 이 `single`/`ep` 로 정확
- 요청 개수를 못 채우는 질의가 있는데(newjeans 8건 등) **오버페치 부족이 아니라 실제 앨범이 적은 것**:
  원본 50건 중 앨범이 8건뿐이고 필터가 그 8건을 다 돌려준다. blackpink 는 원본 50건에 6건인데
  오버페치 덕에 8건을 찾아냈다
- 월드컵이 쓰는 `limit=50` 경로도 잔여 0건. 트랙 검색 결과는 그대로
- 탑스터 만들기 화면 실제 검색 결과에 싱글·EP 표기 0개(헤드리스 확인)

**남긴 것**
- 괄호 표기(`(Deluxe)`, `(Remastered)`, `(Live)`, `(Taylor's Version)` …)는 그대로 둔다.
  실측에서 꽤 나오지만 **진짜 앨범의 판(edition)** 이라 지울 대상이 아니다. 중복처럼 보이면
  나중에 따로 논의할 것
- 아티스트 상세의 앨범 목록(`/artists/{id}/albums`)에는 필터를 안 걸었다. 같은 노이즈가 있지만
  이번 요청 범위 밖이다
- `music_cache` 에 남은 예전 payload 는 `album_type` 이 옛 규칙(트랙 수)으로 들어 있다.
  TTL 30일 안에 자연히 교체되고, 필터는 제목으로 판단하므로 동작에는 영향 없다

### 2026-08-23 (계속) — 앨범 정보 줄바꿈, 항목이 띠 높이를 균등 분할하지 않게

요청 둘: (1) 글자가 잘리지 않고 줄바꿈 (2) 한 행의 정보들이 띠 높이를 나눠 갖지 않고
자기 높이만 차지 — 행 아래 빈 자리가 남아도 괜찮다.

**바꾼 것**
- `truncate` 제거 → `break-words` + `leading-snug`. 긴 제목이 전부 보인다
- 항목 높이 고정(`cell / width`) 제거 → 자연 높이로 위에서부터 쌓임(`justify-center` 도 제거)
- 글자 크기가 줄 높이에 묶여 있던 걸 풀고 셀 크기에만 완만히 연동(`cell * 0.1`, 10~13px)
- 다운로드 PNG에도 같은 규칙 적용 + 캔버스용 `wrapText()` 신설(단어 단위로 자르고,
  한 단어가 폭을 넘으면 글자 단위로 더 쪼갬)

**요청대로만 하면 글자가 서로 겹친다 — 실측으로 확인**
행 띠 높이를 `cell` 로 고정한 채 항목을 자연 높이로 쌓으니, 5x5에서 **행 0의 내용이 행 1을
27px 침범**했다(내용 bottom 395 > 다음 띠 top 368). "행 사이 빈 간격은 괜찮다"는 말은
빈 자리를 뜻하지 글자가 겹쳐도 된다는 뜻은 아니라고 봤다.

그래서 행 높이를 `minmax(cell, max-content)` 로 바꿨다 — 내용이 들어가면 격자와 정확히 정렬되고,
넘치면 그 행만 늘어나 아래가 밀린다. 넘칠 때 격자와의 정렬이 어긋나는 건 감수한다.
**글자가 겹치는 것보다 낫고, "자르지 않는다"는 요구와 양립하는 유일한 선택이다.**

**목록 세로 정렬 방식도 바꿔야 했다**
전에는 목록 전체를 `m-auto` 로 가운데 정렬해 격자와 맞췄는데, 줄바꿈으로 목록이 길어지면
**flex 의 auto 마진이 위쪽을 잘라먹는다.** 격자가 가운데 정렬되며 생기는 위쪽 여백을
`gridOffsetTop()` 으로 계산해 `padding-top` 으로 주는 방식으로 바꿨다 — 길어져도 안 잘리고
첫 줄은 여전히 격자 첫 행과 맞는다.

**검증**
- 5x5 실측: 항목 높이가 `30/30/15/45/15` 로 제각각(균등 분할 아님), `text-overflow: ellipsis` 없음,
  격자 행 top과 목록 띠 top 일치, **다음 행 침범 없음**(내용 bottom 395 < 다음 띠 top 399)
- 긴 제목 전체 노출 확인: `The Beatles – Sgt. Pepper's Lonely Hearts Club Band (2017 Mix)` 3줄로 표시
- 다운로드 PNG 눈으로 확인 — `'Round About Midnight (Mono Version)` 이 두 줄로 나오고 잘리지 않음
- 상세 패널 3x3/4x4/5x5 전부 `992x632` 유지
- 전 라우트 × 데스크톱·모바일: 문서 스크롤 0건, 가로 스크롤 0건, 바닥 도달 전부 OK
- `tsc --noEmit` 통과, eslint 기존 오류 1건만

### 2026-08-23 (계속) — 앨범 정보를 격자 행에 세로 정렬, 글자색 옵션

요청 6건: 격자 공간 확대 / 정보란 글자 축소 / **정보를 격자 행 높이에 맞춰 출력** /
글자색 커스텀 / 아티스트·제목 같은 색 / 체크박스 확대.

**핵심은 "행 정렬"이었다**
목록을 그냥 세로로 나열하던 걸, **격자와 같은 행 높이·간격의 그리드로 깔아** 각 줄 묶음이
대응하는 격자 행과 같은 띠 안에 들어가게 했다. 5x5면 첫 행 앨범 5개 정보가 첫 행 높이 안에
표시된다 — 목록의 어느 줄이 어느 칸인지 눈으로 바로 짚힌다.

그래서 한 줄 높이는 `cell / width` 로 정해지고 글자 크기도 거기 맞춘다(`lineHeight * 0.58`,
하한 8px). 칸이 많아질수록 글자가 작아지는 건 의도된 것이고, "글자 더 작게" 요청도 이걸로 풀린다.

**셀 크기를 부모가 계산하게 구조를 바꿈**
목록이 격자와 같은 행 높이를 알아야 해서, 셀 계산을 `TopsterGridBox` 안에서 부모(`TopsterCanvas`,
만들기 페이지)로 올렸다. `computeCell()` 과 `topsterGridStyle(…, cell)` 로 나누고 둘이 같은
값을 공유한다. `TopsterGridBox` 는 역할이 없어져 삭제.

**세로 정렬이 안 맞던 이유**
띠 높이·항목 수는 맞는데 격자와 242px 어긋났다. **격자는 고정 영역 안에서 세로 가운데 정렬인데
목록은 위에서부터 쌓였기 때문.** 목록도 `m-auto` 로 가운데 정렬하니 정확히 맞았다(둘의 전체
높이가 같게 계산되므로 가운데 정렬만으로 딱 맞는다). 실측 확인: 격자 행 top 440/531 = 목록 띠 top.

**글자색 옵션**
`text_color` 컬럼 추가(기본 `#ffffff`). 배경색을 자유롭게 고를 수 있는데 글자색이 흰색 고정이면
밝은 배경에서 안 보인다. 아티스트와 제목은 **같은 색**으로 통일하고 구분자(`–`)만 남겼다 —
색으로 나누던 걸 없앤 것.

**격자 공간 확대**
격자가 세로가 아니라 **가로 폭에 묶여** 있었다(세로 여백이 남는데 셀은 87px). 사이드바
`380px → 320px`, 목록 `w-64 → w-44` 로 좁혀 셀이 **87 → 105px** 로 커졌다.

**검증**
- 5x2 / 5x5 에서 목록 띠 높이 = 셀 높이, 띠별 항목 수 = 행별 앨범 수, 격자 행 top과 목록 띠 top **일치**
- 글자색 `#ffd166` 이 제목·목록·다운로드 PNG 전부에 반영
- 체크박스 20x20 (기본 16x16 → `size-5`)
- 상세 패널 3x3/4x4/5x5 전부 `992x632` 동일 유지
- 다운로드 PNG 눈으로 확인 — 행 정렬·단일 색·제목 구분선 정상
- 전 라우트 × 데스크톱·모바일: 문서 스크롤 0건, 가로 스크롤 0건, 바닥 도달 전부 OK
- `tsc --noEmit` 통과, eslint 기존 오류 1건만

**작업 중 실수**
`lib/topster-image.ts` 를 문자열 슬라이스로 치환하다 파일을 망가뜨렸다(치환 지점이 어긋나
상단에 코드가 끼어들었다). 긴 파일의 블록 교체는 슬라이스 대신 통째로 다시 쓰는 게 안전하다.

### 2026-08-23 (계속) — 페이지 높이를 layout 단에서 고정, 탑스터 점유 영역 고정

앞선 피드백 반영에서 잘못 잡은 것 둘을 고치고, 요구 넷을 새로 넣었다.

**바로잡은 것**
- **제목 구분선은 탑스터 안 제목이 아니라 `/topsters/new` 의 h1 "새 탑스터"** 였다. 캔버스 안
  제목에 걸었던 구분선을 h1 로 옮겼다(캔버스 제목은 `truncate` 만 남김)
- **"크기 고정"은 격자 모양까지 고정하라는 뜻이 아니었다.** 격자는 칸 수에 따라 유동적으로
  변하되 **탑스터가 차지하는 영역**이 안 변해야 한다. 앞서 격자 영역을 정사각형으로 못 박아
  1xN 에서 좌우 여백만 크게 남았는데, 이제 영역만 고정하고 격자는 그 안에서 두 축을 다 쓴다

**layout 단에서 문서 스크롤을 없앰**
`body` 를 `h-full overflow-hidden` 으로, `main` 을 `min-h-0 flex-1 overflow-y-auto` 로 바꿨다.
문서 자체는 스크롤하지 않고 `main` 안에서만 스크롤한다. 이래야 페이지가 **"헤더를 뺀 남은 높이"를
definite 한 값으로** 받을 수 있고, 만들기 화면이 `h-full` 하나로 화면을 꽉 채운다.

기존 페이지들은 스크롤 주체가 문서 → `main` 으로 바뀌었을 뿐 보이는 동작은 같다. 전 라우트에서
**맨 아래까지 실제로 스크롤해 도달 여부를 확인**했다(콘텐츠가 잘리면 여기서 드러난다).

**"차지하는 영역 고정"을 어디에 걸어야 하는가**
격자 영역에만 높이를 주면 부족했다 — **앨범 정보 목록이 격자보다 길면 그쪽이 패널을 밀어낸다.**
실측에서 5x5 상세만 패널이 `992x821` 로 커졌다(3x3·4x4는 `992x641`). 높이를 격자가 아니라
**행 컨테이너 자체**에 걸고 목록을 `min-h-0 overflow-y-auto` 로 두니 전부 `992x641` 로 맞았다.

**앨범 정보는 자르지 않고 줄바꿈**
`truncate` 를 걷어내고 `break-words` 로 바꿨다. 말줄임하면 어느 앨범인지 알 수 없어지는데,
넘치면 안 되므로 줄바꿈 + 세로 스크롤이 맞다.

**다운로드 PNG는 반대로 격자에 딱 맞춘다**
화면은 "차지하는 영역 고정"이지만 내려받는 이미지는 레이아웃이 아니라 결과물이다. 영역을 고정하면
1x2 이미지에 빈 여백만 커진다. 셀 해상도를 300px로 고정하고 격자에 딱 맞게 자르도록 되돌렸다 —
커버 화질도 칸 수와 무관하게 같아진다.

**검증**
- 만들기 화면: 1x5 / 3x3 / 5x5 / 5x1 에서 패널이 전부 `708x734` 로 동일, 셀만 129 → 132 → 77 → 77
  로 변함. 패널 하단 `876 <= 뷰포트 900` (화면을 안 벗어남), 페이지 스크롤 없음, 목록이 패널 안
- 상세 페이지: 3x3 / 4x4 / 5x5 전부 패널 `992x641` 동일, 셀만 184 → 137 → 108
- 전 라우트 × (데스크톱 1440x900, 모바일 390x844): 문서 스크롤 0건, 가로 스크롤 0건,
  `main` 을 끝까지 굴려 **바닥 도달 전부 OK**
- 모바일 만들기 화면도 한 화면에 들어간다(패널 358x360)
- 다운로드 PNG 눈으로 확인 — 격자에 딱 맞고 제목 구분선·목록 정상
- `tsc --noEmit` 통과, eslint 는 기존 오류 1건(`app/topsters/[id]/page.tsx:38`)만

**남긴 것**
- DESIGN.md 어긋남 3건은 그대로다(§ Color budget 위반, § Visual reference, 배경색 임의 hex)
- `main` 이 스크롤 컨테이너가 되면서 **`window.scrollTo` 를 쓰는 코드가 있으면 안 먹는다.**
  지금 코드베이스에는 없지만 새로 쓸 때 주의할 것

### 2026-08-23 (계속) — 탑스터 고정 크기 격자, 사이드바 높이, 제목 구분선, 목록 넘버링

사용자 피드백 5건 반영: (1) 칸을 늘려도 탑스터 크기 고정 (2) 좌측 옵션이 화면 높이를 채움
(3) 제목 밑 구분선 (4) 넘버링을 앨범 정보 목록에도 (5) 격자 상한 5x5.

**"크기 고정"이 생각보다 까다로웠다 — CSS만으로는 안 됐다**
격자를 정사각형 박스에 못 박고 셀이 작아지게 하면 되는데, 셀이 정사각형이어야 하고(커버가
정사각형) 격자 전체가 박스를 넘으면 안 된다. 즉 `cell = (side - gap*(N-1)) / N`, `N = max(w,h)`.

이걸 CSS `min()` 으로 쓰려다 실패했다. **행(row) 트랙의 백분율은 블록 크기 기준인데 그 값이
불확정이라 트랙이 무너진다** — 실측에서 3x3 셀이 `16x5px` 로 찌그러졌다. 열은 되고 행은 안 되는
비대칭이라 CSS만으로 우회하기 어려워, `ResizeObserver` 로 박스 한 변을 재서 px로 못 박았다
(`lib/topster-grid.ts`). setState 는 옵저버 콜백 안에서만 일어나므로 연쇄 렌더 경고도 안 난다.

그전에 시도한 "트랙은 1fr, 셀에 aspect-square" 방식도 안 된다 — w≠h 면 트랙이 직사각형이 돼
`aspect-square h-full w-full` 이 서로 싸운다(실측: 1x2에서 셀이 560x278).

**결과**: 1x2 · 3x3 · 5x5 · 2x5 전부 박스 560x560 고정, 셀만 184 → 121 → 71px 로 줄어든다.
셀은 모든 조합에서 정사각형.

**가로 스크롤이 생겼던 이유**
격자 박스에 `shrink-0` 을 걸어놨더니 미리보기 열(740px)에 `560 + 288(목록)` 이 안 들어가
페이지 전체가 넘쳤다. `shrink-0` 을 떼고 감싸는 flex 에 `min-w-0` 을 줘서 해결.
데스크톱·모바일 7개 라우트 전부 가로 스크롤 없음을 재확인했다.

**나머지**
- 사이드바: `lg:sticky lg:top-4 lg:h-[calc(100vh-6rem)]` + 탭 내용만 `overflow-y-auto`. 미리보기가
  길어져도 옵션이 같이 밀려 올라가지 않아야 만지면서 결과를 볼 수 있다
- 제목 구분선: 배경색을 자유롭게 고를 수 있어서 여백만으로는 경계가 안 보이는 조합이 생긴다.
  화면(`border-b border-white/20`)과 다운로드 PNG(캔버스 `stroke`) 양쪽에 넣었다
- 목록 넘버링: `item.position + 1` — 격자 배지와 **같은 값**이라야 목록과 칸을 짚어 맞출 수 있다
- 상한 5x5: 전체 크기가 고정이라 칸이 많아질수록 셀이 작아지는데, 5를 넘으면 커버를 알아볼 수 없다.
  `MAX_SIDE 10→5`, `MAX_CELLS 60→25`
- 다운로드 PNG도 같은 규칙으로 바꿨다 — 격자 영역이 늘 `GRID_BOX=1500px` 라 칸 수와 무관하게
  결과 이미지 크기가 같고, 셀이 그 안에서 가운데 정렬된다

**또 `--reload` 에 당했다 (이번 세션 세 번째)**
`MAX_SIDE` 를 5로 줄였는데 6x5 가 201로 통과했다. 코드가 아니라 리로더가 안 돈 것.
`curl /openapi.json` 으로 `maximum: 5` 를 확인하고 나서야 잡혔다. **스키마 상수를 바꿨으면
OpenAPI를 찍어보고 넘어갈 것.**

**검증**
- 격자 크기별 실측: 1x2/3x3/5x5/2x5 → 박스 전부 `560x560`, 셀 `184²/121²/71²/71²` (전부 정사각형)
- 상한: 5x5·1x5·5x1 → 201, 6x5·5x6·6x6 → 422. OpenAPI `maximum: 5` 확인
- 프론트 입력에서 width=9 를 넣으면 5로 잘린다
- 만들기 → 저장 → 상세: 1x5 · gap 10 · `#0d2b2b` · 넘버링이 상세에서 그대로 재현(구분선·목록 번호 포함)
- 다운로드 PNG 눈으로 확인 — 제목 구분선, 고정 격자 영역, 말줄임 정상
- 데스크톱(1440) · 모바일(390) 7개 라우트 가로 스크롤 0건, console 에러 0건
- `tsc --noEmit` 통과. eslint는 기존 오류 1건(`app/topsters/[id]/page.tsx:38`, 이번 변경과 무관)만 남음

**남긴 것**
- 1xN 격자는 고정 박스 안에서 한 줄만 차지해 좌우 여백이 크게 남는다. "크기 고정"의 당연한 결과라
  그대로 뒀지만, 박스를 내용에 맞춰 줄일지는 결정 사항
- DESIGN.md 어긋남 3건(§ Color budget 위반, § Visual reference, 배경색 임의 hex)은 그대로 남아 있다

### 2026-08-23 (계속) — 탑스터를 topsters.org 구조로: 옵션 탭 · 비정방형 격자 · 이미지 다운로드

**레퍼런스를 추측하지 않고 실제로 관측했다**
topsters.org를 헤드리스 크롬으로 띄우고, 검색 결과를 **마우스 드래그로 실제 배치해서** 목록이 어떻게 그려지는지 봤다. 그 사이트는 차트를 `<canvas>` 로 그려서 DOM 텍스트 추출이 0건이라, 스크린샷을 봐야만 확인되는 구조였다. 확인한 것: 목록은 격자 우측, `Artist – Album` 한 줄씩, **줄(row) 단위로 묶여 빈 줄로 구분**, 번호 없음. 색값은 안 가져오고 우리 토큰을 쓴다.

**`grid_size` 를 width/height 로 쪼갬**
"width/height 조절"은 셀 픽셀 크기가 아니라 **칸 개수**(열 수 / 행 수)라는 사용자 확인을 받았다. 1x5, 2x3 같은 비정방형이 가능해진다. 기존 행은 정사각형이었으므로 `width = height = grid_size` 로 백필하고 `grid_size` 를 지웠다. `position` 은 `row * width + col` 로 평탄화한 인덱스라 width 가 바뀌면 배치가 자동으로 재해석된다.

표시 옵션 6개를 같이 넣었다: `background_color`(사용자 지정 hex), `cell_gap`, `show_title`, `show_album_info`, `show_numbering`. 라우터는 `OPTION_FIELDS` 튜플 하나로 생성/수정/응답을 돌려 써서 옵션이 늘 때 한 군데만 고치면 된다.

**이미지 다운로드 — DOM 캡처가 아니라 캔버스 직접 그리기**
`html-to-image` 류는 웹폰트·CSS 변수·레이아웃까지 재현해야 해서 깨질 구석이 많다. 여기서 그릴 건 사각형·이미지·텍스트뿐이라 캔버스에 직접 그리는 편이 예측 가능하다. **저장 전에도 동작한다** — 서버에 아무것도 안 물어보고 화면 상태만으로 그린다.

선결 조건이 CORS였는데, mzstatic이 `access-control-allow-origin: *` 를 준다. `crossOrigin='anonymous'` 로 불러오면 캔버스가 안 오염돼 `toBlob` 이 된다 — 브라우저에서 실제로 그려 `toDataURL` 까지 성공하는 걸 확인하고 착수했다. 서버 프록시 불필요.

**작업 중 잡은 실제 버그 3건**
- **검색 결과를 연속 클릭하면 같은 칸에 덮어써진다.** `placeAlbum` 이 렌더 시점의 `grid` 로 빈 칸을 찾아서, 한 React 배치 안에서는 전부 같은 인덱스를 가리켰다. 헤드리스로 4장을 빠르게 넣었더니 2장만 들어가 드러났다 — 사람이 손으로 누르면 리렌더가 껴서 잘 안 보이는 종류다. 빈 칸 탐색을 **업데이터 안으로** 옮겨 해결
- **`a.click()` 직후 `revokeObjectURL` 을 부르면 다운로드가 취소된다.** 헤드리스에서 파일이 아예 안 생기는 걸로 재현. 10초 뒤에 정리하도록 바꿈
- **캔버스의 긴 제목이 그림 밖으로 넘쳤다.** `fillText` 의 `maxWidth` 는 글자를 눌러 찌그러뜨려서 못 쓴다 — 이진 탐색으로 말줄임하는 `ellipsize` 를 따로 만듦

**연쇄 렌더 경고를 만들지 않기 위해**
격자를 `useState` + `useEffect` 동기화로 두면 프로젝트 eslint(`react-hooks/set-state-in-effect`)에 걸린다. **배치(placements)만 상태로 두고 격자는 렌더에서 파생**시켰다. 부수 효과로 격자를 줄였다 늘려도 원래 앨범이 살아난다. 검색 effect도 setState를 타이머 콜백 안으로 옮겼다.

**Radix Tabs 는 합성 클릭에 반응하지 않는다**
검증 스크립트에서 `element.click()` 으로 탭을 눌렀더니 `aria-selected` 가 안 바뀌었다. 실제 마우스 이벤트(`page.click()`)로 바꿔야 동작한다 — 앞으로 이 프로젝트 UI를 자동 검증할 때 반복될 함정이다.

**검증**
- 백엔드 경계 10건 전부 통과: 정상 2x3 / 1x5 201, width 0·11 422, 칸 61개(10x7) 422, position 격자 밖 422, `rgb()` 형식 색 422, `#fff` 201, gap 음수·41 422
- 기존 행 백필 확인: 3→3x3, 4→4x4, 5→5x5
- **헤드리스로 만들기 화면 실동작 확인** — 탭 2개, 2x3 설정 시 `grid-template-columns: 178px 178px` + 6칸, gap 16px, 배경 `rgb(59,29,74)`, 넘버링 표시, "2×3 = 6칸" 힌트
- **다운로드 PNG를 실제로 꺼내 눈으로 확인** — 파일 저장 자체는 헤드리스 제약으로 안 떨어져서, `createObjectURL` 을 가로채 blob(701KB)을 파일로 뽑아 확인했다. 제목·커버·줄 단위 목록·말줄임 전부 정상
- **만들기 → 저장 → 상세 전체 흐름**: 1x5 · gap 10 · 배경 `#0d2b2b` · 넘버링으로 만든 뒤 저장하니 상세 페이지가 `cols: 656px`(1열) · 5칸 · gap 10px · `rgb(13,43,43)` · 넘버링 · 목록 5줄 · 커버 5장으로 **그대로 재현**
- 회귀: 프론트 6개 라우트 200, 백엔드 4개 200. `tsc --noEmit` 통과, 신규/수정 파일 eslint 무경고

**남긴 것**
- **DESIGN.md § Color budget 위반이 생겼다.** 옵션 탭의 체크박스 4개가 체크 시 `bg-primary`(amber)라, "탑스터 저장" 버튼까지 합쳐 한 화면에 primary 강조가 **5개** — 규칙상 4개 초과는 BLOCK이다. 폼 컨트롤을 "강조 요소"로 셀지 정하고 DESIGN.md에 예외를 적든지, 체크박스를 중립으로 내리든지 해야 한다
- **DESIGN.md § Visual reference 의 탑스터 행이 구현과 어긋난다.** 지금 Netflix·Watcha만 근거로 두고 있는데 실제로는 topsters.org 구조를 따랐다. 관측 근거가 있으니 정본에 추가할 수 있다
- 배경색은 사용자 콘텐츠라 임의 hex를 허용했다(형식만 `#RGB`/`#RRGGBB` 로 강제). DESIGN.md의 "임의 색상값 금지"는 UI 크롬 규칙이라 층위가 다르다는 판단인데, 이것도 정본에 안 적으면 리뷰에서 위반으로 잡힌다
- 1열(1xN) 격자는 셀이 화면 폭만큼 커진다(656px). 동작 문제는 아니지만 최대 폭을 둘지는 미정
- 탑스터 **수정 UI는 여전히 없다** — 옵션이 7개가 됐는데 저장 후에는 못 고친다. T2 항목의 무게가 늘었다

### 2026-08-23 (계속) — 탑스터 커버 실제 렌더 + iTunes 응답 DB 캐시

두 가지를 같이 했다. 탑스터 미리보기가 색칠한 칸(목업)이라 실제 앨범 커버로 바꾸는 일과,
그러면 iTunes 호출이 폭증하므로 그 앞에 DB 캐시를 두는 일.

**정렬 축소 (선행)**
탑스터 `sort` 를 `recent | popular` 두 개로 줄였다. 월드컵은 기간별 인기(전체·년·월)를
두지만 탑스터는 기간 구분 없이 인기순 하나만 쓰기로 했다. 정렬용/표시용 서브쿼리가
하나로 합쳐져 쿼리도 짧아졌다.

**캐싱하는 것은 이미지 바이트가 아니라 메타데이터다**
커버는 mzstatic이 호스팅하는 URL이라 우리가 다시 서빙하면 스토리지·대역폭만 떠안는다.
매번 부담하는 건 "이 앨범 ID의 커버 URL이 뭐냐"를 알아내는 iTunes 왕복이고, 그 답만
`music_cache` 테이블에 적어둔다. payload는 `_map_album`/`_map_track` 이 만든 dict 그대로라
응답 스키마와 같은 모양이고, 꺼내서 바로 돌려줄 수 있다.

**tombstone이 필요했던 이유 — 실측으로 드러남**
캐시를 붙였는데 웜 요청이 여전히 iTunes를 부르길래 로그를 봤더니, **iTunes 검색이 돌려준
앨범 ID 중 lookup으로는 안 풀리는 게 있었다**(120개 중 `1508421225`, `754383858`).
탑스터는 검색 결과에서 앨범을 고르므로 실제 데이터에 섞일 수 있고, 그러면 목록을 열 때마다
그 ID들 때문에 iTunes를 다시 부른다. 그래서 "없다"는 사실도 캐싱한다(payload NULL).
다만 '없음'은 뒤집힐 여지가 크므로 TTL을 짧게 뒀다 — 데이터 30일 / tombstone 1일.

**JSONB에 None을 넣으면 SQL NULL이 아니다**
tombstone을 넣었는데 `select ... where payload is null` 이 0건을 돌려줬다. SQLAlchemy가
Python `None` 을 JSONB 컬럼에 **JSON `null`** 로 저장하기 때문이다. Python 쪽은 둘 다 None으로
읽어 동작은 맞았지만 DB에서 tombstone을 세거나 지울 수 없는 상태였다.
`JSONB(none_as_null=True)` 로 고쳤다.

**async 라우트 + 동기 Session**
`/api/music/*` 라우트는 `async def` 인데 이 프로젝트의 Session은 동기다. 그대로 부르면
이벤트 루프가 막히므로 캐시 읽기/쓰기를 `run_in_threadpool` 로 뺐다.

**캐시 payload가 스키마와 어긋나면 스스로 낫는다**
매핑 로직이나 응답 스키마가 바뀌면 예전 payload가 검증에 걸린다. 그대로 돌려주면 직렬화에서
500이 나므로 검증 실패는 캐시 미스로 취급해 다시 받아오고 덮어쓴다(`_cache_hits`).

**프론트: 카드가 각자 등록하고 한 번에 합쳐 부른다**
탑스터 카드 한 장이 최대 25칸, 목록 한 페이지 30장이면 카드가 각자 부를 경우 수백 요청이 된다.
그렇다고 페이지가 prop으로 내려주는 방식도 안 맞는다 — 카드는 홈(Server Component), 목록,
프로필 2곳까지 **네 군데**에서 쓰이기 때문이다. 그래서 `lib/album-covers.ts` 에 모듈 레벨
배치 로더를 뒀다. 카드가 필요한 ID를 등록하면 한 틱 뒤 하나의 요청으로 합쳐지고, 결과는
전역 맵에 남아 다른 카드가 재요청하지 않는다. 사용처 네 곳이 코드 변경 없이 다 같이 좋아진다.

완료 알림은 반환 Promise가 아니라 **구독(listener)** 으로 돌린다. Promise로 하면 배치가 도는
중에 마운트된 카드가 "자기 ID가 안 들어 있는 배치"의 Promise를 받아 영영 안 그려진다 —
실제로 처음엔 그렇게 짰다가 요청이 갈라지는 걸 보고 고쳤다.

**검증**
- 백엔드 실측(앨범 ID 120개): 콜드 110ms → **웜 7.0ms(약 16배)**, 웜 구간 iTunes lookup **0회**(로그로 확인). 캐시 118행 + tombstone 2행
- `sort=popular_all|popular_month|popular_year` → 전부 422(폐기 확인), `popular` 정상
- **헤드리스 크롬으로 실제 커버 렌더 확인** — 목록 58장, 홈 70장, 상세 9장 전부 `naturalWidth > 0`(진짜 로드됨). console 에러 0건
- **프로덕션 빌드(`next build` + `next start`)로도 재확인** — dev 전용 동작이 아님을 확인
- 배치가 합쳐지는 것 확인: 탑스터 4장 59칸 → 고유 50개 ID **한 번의 요청**. 처음에 "요청 2회"로 보였던 건 CORS **프리플라이트(OPTIONS)** 였고, `window.fetch` 를 감싸 세어보니 실제 GET은 1회였다
- 회귀: 프론트 `/`·`/topsters`·`/tournament`·`/profile`·`/search`·`/topsters/new`·`/tournament/new` 200, 백엔드 목록·검색·월드컵 200
- `tsc --noEmit` 통과, 신규/수정 파일 eslint 무경고

**남긴 것**
- `models/__init__.py` 가 오래돼 `TournamentItem`/`TournamentPlay` 가 빠져 있었다(모듈 import 덕에 metadata 등록은 됐지만 `__all__` 이 거짓말). 이번에 같이 채웠다
- `app/topsters/[id]/page.tsx:38` 에 기존 eslint 에러(effect 본문 동기 setState)가 있다. 이번 변경과 무관한 HEAD 상태이고 고치지 않았다
- `lib/api.ts` 의 `apiFetch` 가 **GET에도 `Content-Type: application/json` 을 붙여** 매 URL마다 CORS 프리플라이트가 뜬다. 앱 전역에 걸린 작은 낭비 — 이번 범위 밖이라 두었다
- 검색·아티스트·앨범 상세 등 **단건 조회 경로는 아직 캐시를 안 탄다.** 배치 경로(`/api/music/tracks`, `/api/music/albums`)만 적용했다
- `music_cache` 만료 행을 지우는 정리 작업이 없다. TTL이 지나면 덮어쓰기는 되지만 안 쓰이는 행은 쌓인다

### 2026-08-23 (계속) — 탑스터 목록을 월드컵 대시보드와 같은 축으로

`GET /api/topsters/` 에 `q`(제목·설명 부분 일치)와 `sort`(recent | popular_all | popular_year | popular_month)를 붙이고, `app/topsters/page.tsx` 를 Server Component → Client Component 로 바꿔 검색창 + 정렬 토글을 달았다. 월드컵 대시보드(`app/tournament/page.tsx`)와 구조·디바운스(300ms)·에러 처리(`sonner`)를 그대로 맞췄다.

**인기 지표를 무엇으로 둘 것인가**
월드컵의 인기순은 '플레이 횟수'인데 탑스터엔 플레이가 없다. 대응물은 **좋아요 수**다. 기간(전체/년/월)은 `Like.created_at` 을 자른다 — 탑스터 생성 시각이 아니라서, 오래전에 만든 탑스터도 이번 달에 좋아요를 많이 받으면 월간 상위로 올라온다. 월드컵에서 `TournamentPlay.created_at` 을 자른 것과 같은 규칙.

**조인에 cast가 필요했던 이유**
`Like.target_id` 는 String(범용 target 구조라 Spotify ID도 담는다)이고 `Topster.id` 는 UUID다. 그대로는 조인이 안 돼 `cast(Topster.id, String)` 으로 맞췄다. Postgres의 `uuid::varchar` 는 소문자 하이픈 표기라 like 라우터가 URL 경로에서 그대로 받아 저장하는 문자열과 일치한다 — 실제 데이터로 확인함.

**부수적으로 걷어낸 N+1**
`_build_response` 가 탑스터마다 좋아요를 세고 있었다(목록 20건 = 20쿼리). 집계 서브쿼리 결과를 `like_count` 인자로 주입해 없앴다. 카드가 그리드 미리보기를 그리므로 `items` 도 `selectinload` 로 당겨온다 — 컬렉션이라 `joinedload` 는 limit/offset과 얽힌다.

**또 `--reload` 에 당했다**
`sort` 를 붙였는데 정렬 4종 응답이 전부 동일했다. 코드가 아니라 리로더 문제 — 로그에 `Reloading...` 만 찍히고 `Application startup complete` 가 안 나왔고, FastAPI는 모르는 쿼리 파라미터를 조용히 무시하므로 **구버전이 200으로 정상 응답해서** 한눈에 안 보였다. 2026-08-22 기록과 같은 함정. 스키마·시그니처를 고쳤으면 `curl /openapi.json` 으로 파라미터가 실제로 붙었는지부터 볼 것.

**검증**
- 시드 5건(공개 4 + 비공개 1)에 좋아요 시각을 0~500일로 흩뿌려 경계를 갈랐다. 좋아요는 `(user, target)` 유니크라 표본을 만들려면 유저가 여럿 필요해서 더미 유저 6명을 만들었다(`seed*@kikhipster.local`)
- `popular_month` 에서 **좋아요 4개인 항목이 3개인 항목 아래로 내려간다**(4개 중 2개만 30일 안) — 기간 필터가 실제로 동작한다는 증거. `popular_all` 은 4>3>2>0 정순
- 검색: 제목 일치, 설명 일치(`hip`), 대소문자 무시(`HIP`), 결과 0건, 검색+정렬 조합. 비공개 탑스터는 제목이 정확히 걸리는 검색어에도 안 나옴
- `sort=bogus` → 422
- **헤드리스 크롬(puppeteer-core)으로 실제 렌더까지 확인** — 정렬 토글 클릭 시 카드 순서가 바뀌고, 검색어 입력 시 결과가 좁혀지고, 없는 검색어에 '검색 결과가 없습니다'가 뜬다. console 에러 0건
- 회귀: 파라미터 없는 기존 호출(홈 `limit=12`) 200 + 응답 shape 동일, `/api/topsters/user/{id}` 200, `/me/list` 401(무인증), 프론트 `/`·`/topsters`·`/profile` 200
- `tsc --noEmit` 통과, eslint 무경고

**남긴 것**
- 목록이 `limit=30` 고정 — 대시보드와 **같은** 페이지네이션 부재 문제다. 둘을 같이 푸는 게 맞다
- 검색이 제목·설명만 본다(작성자 닉네임 제외) — 월드컵과 동일하게 맞춘 것이라 바꾸려면 양쪽을 같이 바꿔야 한다
- 목록이 클라이언트에서 로드돼 SSR HTML에는 카드가 없다(검색창·정렬 토글까지만). 월드컵 대시보드와 같은 상태

### 2026-08-23 — 토너먼트 전면 재설계: 월드컵(정의) / 플레이(한 판) 분리

**왜 스키마부터 갈아엎었나**
요청은 "생성 흐름을 바꾸고 대시보드를 붙여달라"였지만, 요구된 동작 세 개가 기존 모델과 양립하지 않았다: (1) 풀을 4~512개 담고 (2) 플레이할 때 강수를 고르고 (3) 풀에서 무작위 추출. 기존 `Tournament`는 곧 한 판이라 size가 고정이고 대진이 생성 즉시 확정됐다. 그래서 **월드컵(정의: 이름·설명·타입·풀) ↔ 플레이(한 판: 강수·대진·진행상태)** 로 분리했다. `tournament_items`, `tournament_plays` 신설, `tournament_rounds`는 tournament_id → play_id.

부수 효과가 오히려 본질에 가까웠다 — **어제 만든 랭킹이 이 구조에서야 제대로 작동한다.** 곡 하나당 참가 판이 1~2개뿐이던 게, 무작위 추출 + 반복 플레이로 표본이 자연히 쌓인다. 검증 시드(7판)에서 항목별 참가 수가 5/3/3/1/2/5로 갈렸다 — "우승 횟수"가 아니라 "우승 비율"을 쓴 이유가 이제 데이터로 보인다.

**사용자 확인으로 정한 것**
- 인기순 = **플레이 횟수**. 기간(전체/년/월)은 `TournamentPlay.created_at`을 자른다 — 월드컵 생성 시각이 아니라서, 오래전 만든 월드컵도 이번 달에 많이 플레이되면 월간 상위로 올라온다
- 플레이 강수 상한 **128강**(127경기). 풀은 512까지 담되 한 자리에서 끝낼 수 있는 선
- **비로그인 플레이 허용** → `plays.user_id` nullable. 익명 판은 누구나(=play_id를 아는 사람만) 진행 가능, 로그인 유저가 시작한 판은 본인만. 남이 남의 결과를 바꾸면 랭킹이 그 사람 취향이 아니게 된다

**실측으로 잡은 함정 — iTunes lookup은 조용히 잘린다**
풀이 512개라 배치 조회가 필수인데, 직접 찔러보니 **200개 요청 → 200개 정상, 300개 요청 → 210개만 반환, 512개 → 응답 자체가 깨짐.** 에러가 아니라 조용히 잘려서 안 재봤으면 "왜 후보 일부가 안 보이지"로 한참 헤맬 자리였다. `services/music_api.py`의 `_lookup_chunked`가 150개씩 쪼개 부르고 요청 순서대로 재조립한다. `country`는 여기서도 안 넘긴다.

**곡 모드에서 앨범 펼치기**
`/tournament/new` 3단계 위저드의 핵심. 곡 월드컵인데 앨범을 검색하면 `GET /api/music/albums/{id}/tracks`로 수록곡을 펼쳐 개별 추가 또는 "N곡 전체 추가"를 할 수 있다. 앨범 트랙 응답에는 커버가 없어 앨범 커버를 물려준다.

**작업 중 드러난 기존 버그 3건 (전부 타입이 응답과 어긋난 것)**
화면이 200으로 떠서 그동안 안 걸렸다 — `docs/WORKLOG.md` 2026-08-20의 "화면만 보고 정상 동작을 판단하지 않는다"가 또 맞았다.
- `AlbumSummary`를 프론트가 `name` + `artist_id`로 선언했는데 백엔드는 `title`을 주고 `artist_id`는 아예 없다 → **`AlbumCard`의 앨범 제목이 전부 빈 문자열이었다.** 검색 결과·탑스터 만들기 화면 전반에 영향
- `AlbumWithTracks`를 평평한 모양으로 선언했는데 실제로는 `{album, tracks}` 중첩 → **앨범 상세 페이지 헤더(제목·커버·발매연도·트랙수)가 통째로 undefined였다**
- `/artists/{id}/top-tracks`를 `TrackItem[]`로 선언했으나 백엔드는 `TrackSearchItem[]`을 준다
셋 다 타입을 실제 응답에 맞추고 사용처를 고쳤다. 앨범 상세에 "In Between Dreams"가 이제 실제로 뜨는 것까지 확인.

**폐기한 것**
- `POST /{id}/copy`(어제 만든 복제) — "플레이 생성"이 그 역할을 대신해 개념이 중복
- `/tournament/[id]/play` 라우트 → `/play/[playId]`로 이동(플레이가 월드컵의 하위가 아니라 독립 개체가 됐으므로)
- `components/music/TournamentStartButton.tsx` → `PlayStarter.tsx`(강수 선택 포함)

**검증**
- 백엔드 E2E 33항목 전부 통과: 생성/검증(4개 미만 422, 중복 제거 후 미달 400, 무인증 401), 무작위 추출(두 번 뽑으면 다른 조합), 강수 검증(풀 초과 400, 2의 거듭제곱 아님 400), 완주, 익명 투표 200, 남의 판 투표 403, 검색(한글 포함)·정렬 4종, 랭킹 순위 연속성, 앨범 배치 순서 유지, 수정/삭제 권한
- 시드 7판(곡 20개 풀) 후 랭킹: 편향 준 곡이 5/5 우승 100%, 참가 수가 항목마다 다르게 집계됨. 추이는 전부 NEW(플레이가 전부 방금이라 7일 전 표본 없음) — 의도한 동작
- 프론트: `/`, `/tournament`, `/tournament/new`, `/tournament/[id]`(곡·앨범 둘 다), `/tournament/[id]/ranking`, `/play/[playId]`, `/search`, `/albums/[id]` 전부 200. 상세에 후보 커버 200개 렌더, 랭킹 표에 퍼센트·분수·추이 렌더 확인
- `tsc --noEmit` 통과, 신규 파일 eslint 무경고(연쇄 렌더 경고 2건은 effect 본문 동기 setState를 걷어내 해결)

**남긴 것**
- 랭킹이 매 요청 전수 계산 — 플레이가 수천 건 쌓이면 집계 테이블 필요
- 월드컵 수정/삭제 API는 있는데 UI 없음
- 상세의 풀 표시가 앞 24개로 잘림, 대시보드 페이지네이션 없음

### 2026-08-22 (계속) — 토너먼트 상세·플레이·랭킹 3라우트, 댓글 범용화

메인 카드에 "시작하기 / 랭킹보기 / 공유" 세 버튼을 붙여달라는 요청에서 출발했는데, 셋 다 뒷받침하는 게 하나도 없어서 사실상 토너먼트 도메인을 한 겹 더 쌓는 작업이 됐다.

**요청 해석에서 갈린 지점 (사용자 확인 후 확정)**
- 랭킹 지표가 "우승 횟수 / 월드컵 횟수", "승리 횟수 / 1대1 횟수"였다 — 한 판 안에서는 각각 1/1이라 의미가 없다. 즉 **여러 토너먼트에 걸친 누적 통계**를 요구하는 것. 다행히 `tournaments` + `tournament_rounds`만으로 전부 계산돼서 T3의 스코어 산식 설계를 기다릴 필요가 없었다
- 표에 나오는 곡은 **이 토너먼트 참가곡으로 한정**, 지표만 전체 누적 — 사용자 확인함
- "하단에 작성 조회" = 댓글 — 사용자 확인함

**시작하기를 "복제 후 진행"으로 정한 이유**
남의 토너먼트를 그 자리에서 플레이하면 원본 `rounds.winner_id`를 덮어써 소유자의 진행이 깨진다. `POST /{id}/copy`로 같은 곡 구성의 내 토너먼트를 새로 만들고 거기서 진행한다. 부수 효과가 좋은데, **플레이가 쌓일수록 랭킹의 참가/우승 표본이 같이 늘어난다** — 위 지표가 의미를 갖는 건 이 구조 덕분이다. 원본은 기록으로 남는다.

**순위 추이 계산**
스냅샷 테이블 없이, `tournaments.created_at < now-7d` 로 거른 데이터로 순위를 **다시 계산**해 현재 순위와 뺀다. 기준 시점에 표본이 없던 곡은 0이 아니라 `NEW`로 구분한다(대시와 헷갈리면 안 됨). 데이터가 커지면 집계 테이블이 필요해질 방식이라 TASKS에 남김.

**댓글 범용화 — FK가 사라진 대가**
`Comment.topster_id` → `(target_type, target_id)`. Like가 이미 쓰던 구조라 그대로 맞췄다. 마이그레이션 `2a5c81d47b90`에서 기존 행을 `target_type='topster'`로 백필. **여기서 조용히 깨질 뻔한 것**: FK가 없어지면서 탑스터 삭제 시 DB가 댓글을 지워주지 않는다 — `delete_topster`에 `purge_comments()` 를 명시적으로 넣고, 실제로 탑스터를 지워 댓글이 같이 사라지는 것까지 확인했다. 기존 `/api/topsters/{id}/comments` 경로는 내부적으로 같은 함수를 부르게 해서 프론트 변경 없이 유지.

**iTunes 배치 트랙 조회**
`GET /api/music/tracks?ids=1,2,3` 신설. 랭킹·상세·플레이 전부 "트랙 ID만 알고 제목/아트워크는 모르는" 상태라 필수였다. 세 가지 함정: (1) 여기서도 `country`를 안 넘긴다, (2) 응답 순서가 요청 순서와 다르고 없는 ID는 조용히 빠진다 → 호출부에서 재정렬, (3) 앨범 ID를 섞어 보내면 `wrapperType="collection"` 행이 섞여 온다(실제로 확인) → track만 남긴다.

**uvicorn --reload를 믿지 말 것**
이번 세션에서 `--reload`가 "Reloading..." 로그만 남기고 **재기동을 끝내지 못한 경우가 세 번** 있었다. 스키마를 고쳤는데 응답에 새 필드가 안 붙어 프론트가 500이 났고(`tournament.user` undefined), 원인이 코드가 아니라 리로더였다. 스키마·라우터를 고친 뒤에는 응답을 curl로 직접 확인하고, 안 붙었으면 재기동할 것.

**검증**
- 랭킹: 시드 3판(10일 전 2판 + 1일 전 1판) 상태에서 Karma Police 2/3·rank 1·추이 +1 확인. 이후 복제본을 API로 7경기 완주시키자 2/4·No Surprises 1/4로 **수치가 실제로 갱신**되는 것까지 확인
- 복제 201 + 라운드 4개 생성, 비로그인 상세 조회 200, 토너먼트 댓글 작성/목록 200·201, 잘못된 target_type 422, 없는 대상 404
- 회귀: 기존 탑스터 댓글 경로 GET 200 / POST 201, 탑스터 삭제 시 댓글 동반 삭제
- 프론트: `/`, `/tournament/[id]`, `/tournament/[id]/play`, `/tournament/[id]/ranking` 전부 200. 상세에 참가 곡 8/8과 mzstatic 아트워크, 랭킹 표에 퍼센트·분수·추이 렌더 확인. `tsc --noEmit` 통과, 신규 파일 eslint 무경고
- DESIGN.md § Color budget: 카드 버튼 3종을 전부 중립 variant로 두고, 플레이 완료 화면의 "랭킹 보기"도 `secondary`로 내려 한 화면 primary 2개를 넘지 않게 맞춤

**남긴 것**
- 토너먼트 **목록 페이지 없음** — 홈 "더보기"가 `/tournament`(새로 만들기)로 가서 라벨과 동작이 어긋난다
- 탑스터 상세 댓글은 아직 옛 인라인 코드 — `CommentSection`으로 교체하면 통일됨
- 랭킹 페이지 댓글은 클라이언트에서 로드돼 SSR HTML에는 안 보인다. API 레벨로는 확인했지만 브라우저 렌더는 미확인

### 2026-08-22 — 프론트 포트 변경, 메인 페이지 개편(둘러보기 제거 + 전체 토너먼트 목록)

**로컬 포트 3000 → 3300**
- 3000·3001이 다른 서비스에 점유돼 프론트를 3300으로 옮김. `frontend/package.json`의 `next dev -p 3300` 하나만 바꾸면 되는 게 아니라 백엔드 `CORS_ORIGINS`·`FRONTEND_URL`(`.env`, `.env.example`, `config.py` 기본값)까지 같이 옮겨야 한다 — 안 그러면 CORS 차단 + OAuth 콜백 후 3000으로 리다이렉트. preflight에 `access-control-allow-origin: http://localhost:3300` 오는 것까지 확인
- 카카오 콘솔 "사이트 도메인"에 3000이 등록돼 있다면 콘솔에서 직접 갱신해야 함(코드로 처리 불가)

**기동 중 발견 — `.env`에 죽은 Spotify 키가 남아 서버가 아예 안 떴다**
- 2026-08-21의 iTunes 교체에서 `config.py`의 `spotify_*` 필드를 지웠는데, git 미추적인 로컬 `backend/.env`에는 `SPOTIFY_CLIENT_ID/SECRET/DEFAULT_MARKET` 3줄이 그대로 남아 있었다. pydantic-settings가 extra 필드를 금지해 `ValidationError`로 alembic·uvicorn이 **둘 다** 죽는 상태. `.env.example`은 이미 `MUSIC_DEFAULT_MARKET`으로 정리돼 있었으므로 로컬 `.env`만 뒤늦게 따라간 것
- 교훈: `.env.example`에서 변수를 지우는 변경은 팀원·본인의 기존 로컬 `.env`를 자동으로 고쳐주지 않는다. 스키마에서 필드를 제거할 땐 마이그레이션 안내를 남기거나 `extra="ignore"`를 검토할 것

**메인 페이지 개편**
- "둘러보기" 4칸 숏컷 섹션 제거. Navbar에 같은 목적지가 이미 다 있어 중복이었고, `text-primary` 아이콘 4개 + 링크 버튼으로 `DESIGN.md` § Color budget 기준 BLOCK(primary 5개)에 해당하던 자리였다
- "최근 탑스터"는 **백엔드가 이미** `is_public=True` + `created_at desc` 전체 조회였다 — 프론트도 그 엔드포인트를 쓰고 있었으므로 요구사항(전체 사용자 최신순)은 변경 없이 이미 충족. 서로 다른 두 유저의 탑스터를 심어 실제로 최신순 노출되는 것까지 확인하고 코드는 손대지 않음
- 하단에 "최근 토너먼트" 섹션 신설. `GET /api/tournaments/`가 **아예 없어서** 새로 만듦(목록용 `TournamentSummaryResponse` — `rounds`는 무거워 제외, `user` 조인 포함, 비로그인 조회 허용). 기존 `GET /{id}`는 `user_id` 소유자 검증이 있어 목록에 재사용 불가

**남긴 구멍 (의도적)**
- `/tournament/[id]` 상세 라우트가 없어 토너먼트 카드에 링크를 못 걸었다 → 정적 카드로 두고 `TournamentCard.tsx`에 TODO. T3의 스코어링 모델 재설계와 엮여 있어 임의로 만들지 않음
- 우승곡을 트랙 ID로만 알아 곡 제목 표시 불가(iTunes 단건 트랙 조회 엔드포인트 부재). 목록마다 외부 API를 N번 호출하는 건 피함

**검증**
- `GET /api/tournaments/` 200, 시드 3건이 `created_at desc`로 정렬돼 반환되는 것 확인
- 홈 렌더: 시드 상태에서 토너먼트 3건이 8/22 → 8/21 → 8/20 순으로, 작성자 닉네임·강수·상태 배지와 함께 노출. "둘러보기" 문자열 0건. 시드 제거 후 두 섹션 모두 Empty 상태 정상
- `tsc --noEmit` 통과, 변경 파일 eslint 무경고
- `created_at`이 naive UTC라 JS `new Date()`가 로컬시로 오해하는 문제 → `lib/utils.ts`에 `formatDate()` 추가(타임존 접미사 없을 때만 `Z` 부착)

### 2026-08-21 (계속) — T1 착수: Spotify → iTunes Search 실제 교체

**백엔드 교체**
- `services/music_api.py`를 `SpotifyMusicService` → `ITunesMusicService`로 전면 재작성. 인증이 필요 없어 `services/spotify_auth.py`(`SpotifyTokenManager`) 삭제, `main.py`/`config.py`에서 관련 배선(`token_manager`, `spotify_client_id/secret`) 전부 제거. `schemas/music.py`는 어댑터 계층에서 흡수해 구조 변경 없음
- `.env`/`.env.example`의 `SPOTIFY_*` 3개 변수를 `MUSIC_DEFAULT_MARKET` 하나로 교체

**실제 호출하며 발견한 iTunes API 특이사항 2건 (문서만으론 안 보이던 것)**
- `/lookup?id={albumId}&entity=song`에서 `limit`을 생략하면 트랙이 0개로 온다(collection 레코드만) — `limit=200`으로 고정해 해결
- 여기에 `country` 파라미터까지 같이 넘기면 `limit`을 줘도 트랙이 다시 0개로 잘린다(재현 확인, 원인 불명 — Apple 쪽 지역 카탈로그 스코핑 버그로 추정). `collectionId`가 전역 고유값이라 `country` 없이 호출하는 걸로 우회. `CLAUDE.md` "과거에 실제로 터진 함정"에 등재해 재발 방지

**프론트 이미지 도메인**
- `next.config.ts`의 `remotePatterns`가 `*.scdn.co`(Spotify)로 고정돼 있어 그대로 뒀으면 아트워크가 전부 깨졌을 것. `*.mzstatic.com`(Apple 아트워크 CDN)으로 교체

**진짜 실행해보고서야 드러난 기존 버그**
- `artists/[id]/page.tsx`가 `artist.albums.length`를 호출하는데, `ArtistDetail` 스키마(백엔드·프론트 둘 다)엔 애초에 `albums` 필드가 없었다 — Spotify가 403으로 막혀 있던 내내 이 코드가 한 번도 실행된 적이 없어 안 걸린 순수 사전 존재 버그. `docs/TASKS.md` T2의 "아티스트 앨범 목록 API 프론트 미사용" 항목과 정확히 같은 원인이라 이번에 같이 고침 — `getAlbums()`를 신설해 `GET /api/music/artists/{id}/albums`를 병렬로 호출하도록 변경, `types/music.ts`의 `ArtistDetail`에서 존재한 적 없던 `albums` 필드 제거

**검증**
- 백엔드: 아티스트/앨범/트랙 검색, 아티스트 상세·앨범 목록·트랙 목록, 앨범 트랙 목록, 존재하지 않는 ID(404) 전부 curl로 직접 확인. 한글/일문 검색도 재확인
- 프론트: `/`, `/search`, `/artists/[id]`, `/albums/[id]`, `/topsters`, `/tournament` 전부 실제 iTunes 데이터로 200 렌더링 확인, `tsc --noEmit` 통과

**문서 정리**
- `docs/TASKS.md`에서 ⛔ 차단됨(Spotify 403) 섹션과 T1 전체를 제거(완료), T2에서 "아티스트 앨범 목록" 항목 제거(완료), T3 토너먼트 항목의 "T1 이후" 표현을 "T1 완료, 착수 가능"으로 갱신, 현재 구현 범위 표를 iTunes 기준으로 갱신

### 2026-08-21 — T1 음악 API 결정 (iTunes Search), 팔로워 기능 제거

**Deezer vs iTunes Search 실제 쿼리 비교**
- 둘 다 공개 API라 인증 없이 직접 curl로 검증. 한글 아티스트명 단독 검색(`김광석`)은 둘 다 정확했지만, **혼합 표기 쿼리에서 갈림** — Deezer는 `"아이유 Blueming"`(한글+영문), `"아이유 블루밍"`(순한글) 둘 다 0건. iTunes는 둘 다 정확 매칭
- 일본어도 확인: `"米津玄師 Lemon"` 검색 시 Deezer 1위는 로마자 `Kenshi Yonezu`+노래방 커버 노이즈, iTunes 1위는 네이티브 표기 `米津玄師` 정곡
- **결정: iTunes Search API.** 케이팝/제이팝처럼 아티스트명 원어 + 곡명 영문 조합이 흔한 도메인에서 혼합 쿼리 실패는 치명적이라고 판단
- 30초 미리듣기(`previewUrl`), 앨범 아트워크(`artworkUrl100`, `600x600bb` 치환으로 고해상도) 정상 확인. `primaryGenreName`은 배열이 아니라 단일 문자열이라 매핑 시 처리 필요

**iTunes 제약 2건 확인 및 처리**
- `followers` 필드가 iTunes엔 없음 → 필드 자체 죽은 코드 여부부터 확인(`popularity`는 프론트 어디서도 안 쓰여 죽은 데이터, `followers`는 `ArtistCard.tsx`·`artists/[id]/page.tsx`에서 실제 렌더링 중이었음). 사용자가 팔로워 기능 자체를 제거하기로 결정 → 프론트 2곳 + `types/music.ts` + 백엔드 `schemas/music.py`·`music_api.py`(3곳)에서 전부 삭제
- 아티스트 엔티티에 인물 사진 필드가 아예 없음(앨범/트랙 아트워크는 있음) — `/lookup?id={artistId}&entity=album`으로 최신 앨범 커버를 대신 가져오는 우회로를 검증까지 했으나, 사용자가 "앨범 위주 도메인이니 인물 사진은 필수 아니다"로 판단해 채택 안 함. 기존 마이크 아이콘 폴백(`ArtistCard.tsx`) 그대로 유지
- 상세는 `docs/TASKS.md` T1

### 2026-08-20 (계속) — 토너먼트 기획 변경, omd 스킬 3종 적용

**omd 스킬 적용**
- `omd-init` 시도했으나 중단 — 이번 세션에 코드 역추출로 이미 작성한 `DESIGN.md`(Netflix/Watcha 근거 포함)가 omd-init의 Core v2 그래프 파이프라인보다 이 프로젝트엔 더 정확해서, 새로 만들지 않고 기존 문서를 그대로 유지하기로 결정
- `omd-sync` 실행 — `CLAUDE.md`/`AGENTS.md`/`.cursor/rules/omd-design.mdc` shim 3종을 전부 신규 생성(기존에 하나도 없었음), `.omd/sync.lock.json`에 해시 기록. 김에 `CLAUDE.md`의 stale한 내용(catch{} 18곳·`text-violet-400` 예시)도 같이 정리
- `omd-reference-capture`는 후보로 검토했으나 보류 — Netflix/Watcha가 카탈로그 상 `legacy_snapshot`(재검증 필요) 상태지만 지금 급한 우선순위가 아니라고 판단

**토너먼트 백엔드 착수 → 기획 변경으로 보류**
- 현재 `tournament_rounds`가 트랙 ID만 저장하고 메타데이터가 없어 새로고침 시 복구가 안 된다는 문제로 서버 측 라운드 저장 + 복구 API를 설계하려 했으나, 실제 검증해보니 `GET /api/music/search/tracks`가 이미 500(Spotify 차단 여파)이라 착수 시점 자체가 안 맞다는 게 드러남
- 이 과정에서 사용자가 토너먼트 기획을 통째로 바꾸기로 결정: 서버에 라운드별 대진 기록을 저장하지 않고, **진행 상태는 프론트 `localStorage`에만**(새로고침은 견디되 기기 간 동기화는 포기), **완료 시엔 승패 기록이 아니라 트랙별 선택률/도달 라운드 기반 스코어만 서버에 POST**하는 방식으로 전환. 여러 유저 플레이가 쌓여 트랙 랭킹으로 집계되는 걸 노리는 설계. 정확한 스코어 산식은 미정
- **착수 시점을 T1(음악 API 교체) 이후로 명시적으로 미룸** — 지금 Spotify ID 기준으로 스키마를 짜봐야 곧 갈아엎어야 하기 때문. 코드 변경은 없었음(설계 단계에서 방향 전환), 상세는 `docs/TASKS.md` T3

### 2026-08-20 — 로컬 기동, OAuth 연결, Spotify 차단 확인, 문서 구조 개편

**로컬 3종 기동 검증**
- Docker Desktop 기동 → `kikhipster-db` healthy, Alembic은 이미 `1f0a9c2b7e3d (head)` 라 추가 마이그레이션 없음
- 백엔드 `:8000`, 프론트 `:3000` 정상. `GET /api/topsters/` → 200 `[]` 로 DB 경로까지 확인

**OAuth 연결 완료 (Google·Kakao)**
- 두 provider 모두 authorize 엔드포인트까지 실제 요청해 검증. Google은 `Sign in - Google Accounts` 페이지 200 (`redirect_uri_mismatch`·`invalid_client` 없음), Kakao는 `KOE***` 없이 로그인 페이지 도달
- 브라우저에서 실제 계정 동의하는 단계만 남음

**Spotify Web API 차단 확인 — 이번 세션 최대 발견**
- `api.spotify.com/v1/search` → 403 `"Active premium subscription required for the owner of the app."`
- 토큰 발급은 성공(140자)하므로 자격증명·대시보드 설정 문제가 **아니다**. 이 오진에 시간을 쓰지 않도록 `docs/TASKS.md` 차단 항목에 명시
- 결정: 구독하지 않고 다른 음악 API로 교체 (Deezer 유력)

**코드 조사로 드러난 것** (상세는 `docs/TASKS.md` T2·T3)
- 백엔드에 있는데 프론트가 안 쓰는 기능 4건 — 탑스터 수정/삭제, 댓글 수정, 앨범/트랙/아티스트 좋아요, 아티스트 앨범 목록
- 토너먼트 진행 상태가 React state에만 있어 새로고침에 소실됨
- 리뷰 기능은 목표에만 있고 모델·라우터·페이지·기획 전부 부재

**문서 구조 개편**
- 작업 로그(이 파일)와 과제(`docs/TASKS.md`)를 CLAUDE.md에서 분리. CLAUDE.md는 하네스 정의와 항구적 규약만 담고 두 파일을 포인터로 참조
- `update-changelog.sh` 의 기록 대상을 CLAUDE.md → `docs/WORKLOG.md` 로 변경. 컨텍스트를 잠식하지 않는 파일이 되었으므로 기존 15행 상한을 제거하고 전체 이력을 보존

**`DESIGN.md` 신설 — 프론트 디자인 시스템 정본화**
- 코드에서 역추출한 현재 상태(타이포·radius·spacing·component states·모바일 규칙)를 `DESIGN.md`로 문서화. `omd-designer-review` 스킬이 이걸 기준으로 audit
- 브랜드 컬러를 violet → **amber**로 교체(`frontend/app/globals.css`). violet은 근거 기록이 전혀 없던 값이었음을 커밋 이력(`2bcb79b`, `15d483d`)으로 확인 후 교체 — coral은 향후 포인트 강조용으로 보류
- oh-my-design 검증 레퍼런스 카탈로그(`C:\Users\qwerg\.claude\data\references\`)로 리서치: 카탈로그 인덱스(`reference-tags.md`, 94개)가 실제 카탈로그(440개)보다 훨씬 좁다는 것부터 발견. Spotify DESIGN.md는 최신 "증거 한정" 포맷이라 그리드/hover 정보가 없어 토큰 공급자로만 격하하고, **Netflix + Watcha**(둘 다 카탈로그 검증됨)를 그리드·hover·elevation 로직의 주 레퍼런스로 확정. 다크 표면값(`background`/`card`)은 zinc 그대로 유지하기로 결정 — 로직만 차용, 색값은 안 바꿈. 토너먼트 브래킷 트리는 카탈로그에도 카탈로그 밖(Letterboxd·RYM·AOTY·PIKU, 전부 403으로 관측 실패)에도 참고할 게 없어 자체 설계로 명시
- `omd-designer-review` 2라운드 실행(`홈페이지 app/page.tsx` 대상): round 1에서 BLOCK 3건(카드 focus-visible 누락 2건, 탑스터 그리드 셀의 컬러 예산 초과 1건) 발견 → focus-visible 추가 + DESIGN.md 컬러 예산 규칙에 "반복 콘텐츠 타일 예외" 조항 추가로 round 2에서 전부 RESOLVED. WARN 4건(섹션 헤더 크기 불일치, 임의 radius/폰트 크기 값, 컬러 예산 경계)은 미해결로 이월

**T3 리뷰 기능 — 결정 보류**
- `Comment` 모델이 `topster_id`에 고정돼 있어(`backend/models/comment.py`) 리뷰(앨범/아티스트/트랙 대상 별점+텍스트)를 댓글로 대체 불가함을 확인. 구현 vs CLAUDE.md 목표 제외, 결정은 보류하고 T3의 다른 항목부터 진행하기로 함

**T3 프론트 에러 처리 완료**
- `frontend/app/` 내 `catch {}` 18곳 중, Server Component 4곳(`page.tsx`, `topsters/page.tsx`, `albums/[id]`, `artists/[id]`)은 `sonner`가 클라이언트 전용이라 토스트를 못 씀 — 대신 `lib/api.ts`에 상태 코드를 보존하는 `ApiError` 클래스를 추가하고, 신설한 `app/error.tsx`(Next.js 라우트 에러 경계)로 처리. 기존 코드가 "fetch 실패"와 "진짜 404"를 `notFound()` 하나로 뭉개고 있던 것도 `ApiError.status === 404` 체크로 분리
- 나머지 Client Component 쪽 14곳은 `toast.error()`로 정리하되, 이미 토스트가 붙어 있던 5곳(`topsters/[id]/page.tsx`의 좋아요·댓글·링크복사, `topsters/new/page.tsx`의 저장 실패)은 손대지 않음. `profile/page.tsx`는 401(진짜 로그인 만료)과 그 외 에러를 분리해 후자는 더 이상 강제로 `/login`으로 쫓아내지 않고 재시도 UI를 보여주도록 수정
- 타입체크(`tsc --noEmit`) 통과, 주요 라우트 200 확인

### 2026-08-14 — 로컬 DB 검증 및 DB API 장애 3건 수정

`alembic upgrade head` 로 7개 테이블 생성 확인(스탬프 `1f0a9c2b7e3d`). 탑스터 생성/목록/상세·댓글·좋아요·토너먼트 생성·삭제 cascade까지 실제 호출로 확인. **DB 기반 API는 이 시점부터 검증된 상태다** — 더 이상 "500이라고 가정"하지 않아도 된다.

검증 중 드러난 버그 3건을 수정(`fb651dc`). 재발 방지 규약은 CLAUDE.md "작업 시 유의사항"으로 옮겼다. 상세는 Notion §7.2.

### 2026-08-13 — 배포 전 선행 작업

DB 설정 일원화, Alembic 도입, CORS 환경변수화, `backend/Dockerfile` 추가 (`2ad8388`).
배포 1차 목적을 "서비스 상시 공개"가 아니라 **AWS 아키텍처 실습**으로 재정의. 원칙과 스택은 CLAUDE.md 참조, 근거·비용표는 Notion §11.

### 2026-07-06 이전 — 초기 구축

Spotify 연동 백엔드, 프론트 기획(`_workspace/planning.md`), QA 리뷰(`_workspace/qa_report.md`), 전체 UI의 shadcn/ui 이관(PR #1).

---

## 커밋 이력

> `.claude/hooks/update-changelog.sh` 가 자동 기록한다. 전체 이력의 정본은 `git log`.

| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-07-03 | 초기 구성 | 전체 | - |
| 2026-08-13 | 현재 상태·대기 작업·배포 스택 섹션 추가, 목표에 shadcn/ui 반영 | CLAUDE.md | 세션 간 작업 상태 인계 |
| 2026-08-13 | docs: CLAUDE.md에 현재 작업 상태 및 대기 작업 기록 | CLAUDE.md | 커밋 `c529622` |
| 2026-08-13 | chore: git commit 후 CLAUDE.md 변경 이력 자동 갱신 hook 추가 | .claude, CLAUDE.md | 커밋 `d1385d7` |
| 2026-08-13 | fix: 변경 이력 hook의 대상 칸 구분자 깨짐 수정 | .claude, CLAUDE.md | 커밋 `0df850b` |
| 2026-08-13 | chore(backend): 배포 전 선행 작업 완료 - DB 설정 일원화, Alembic 도입, CORS 환경변수화, Dockerfile | backend | 커밋 `2ad8388` |
| 2026-08-13 | docs: CLAUDE.md 현재 상태 갱신 - main 병합 반영, 배포 전 선행 작업 4건 완료 기록 | CLAUDE.md | 커밋 `f6892ed` |
| 2026-08-13 | chore : CLAUDE.md 수정 | CLAUDE.md | 커밋 `0e6cbf4` |
| 2026-08-14 | fix(backend): 로컬 DB 검증에서 드러난 DB API 장애 3건 수정 | backend | 커밋 `fb651dc` |
| 2026-08-19 | Merge pull request #2 from GulSam00/fix/db-api-local-verification | - | 커밋 `a913c75` |
| 2026-08-20 | docs: 작업 로그·과제를 CLAUDE.md에서 분리해 전용 파일로 이관 | .claude, CLAUDE.md, docs | 커밋 `a70d0b8` |
| 2026-08-20 | fix(hooks): 이력 행만 담은 커밋은 이력에 기록하지 않도록 수정 | .claude | 커밋 `68dce41` |
| 2026-08-20 | Merge branch 'docs/split-worklog-and-tasks' | - | 커밋 `1ad2940` |
| 2026-08-20 | feat(frontend): 디자인 시스템 정립 + API 에러 처리 정리 | .reviews, DESIGN.md, docs, frontend | 커밋 `d3300ba` |
| 2026-08-20 | chore: oh-my-design shim 동기화 + 토너먼트 기획 변경 반영 | .cursor, .omd, AGENTS.md, CLAUDE.md, docs | 커밋 `03fbb7d` |
| 2026-08-21 | feat(music): T1 음악 API를 iTunes Search로 결정, 팔로워 기능 제거 | backend, docs, frontend | 커밋 `052e1bc` |
| 2026-08-21 | feat(music): T1 착수 — Spotify를 iTunes Search API로 실제 교체 | CLAUDE.md, backend, docs, frontend | 커밋 `4e54aca` |
| 2026-08-25 | chore: 프론트 개발 포트를 3300으로 변경 | .claude, CLAUDE.md, README.md, backend, frontend | 커밋 `1b316be` |
| 2026-08-25 | chore: .gitignore에 루트 .env 추가 | .gitignore | 커밋 `432ae42` |
| 2026-08-25 | fix(frontend): 음악 응답 타입을 백엔드 실제 형태에 맞게 정정 | frontend | 커밋 `8705bd1` |
| 2026-08-25 | feat(comment): 댓글 대상을 (target_type, target_id)로 범용화 | backend, frontend | 커밋 `b66c7bc` |
| 2026-08-25 | feat(tournament): 월드컵(정의)과 플레이(한 판)를 분리 | backend | 커밋 `f540ac6` |
| 2026-08-25 | feat(music): ID 배치 조회 + iTunes 응답 DB 캐시 | backend | 커밋 `0dc6d14` |
| 2026-08-25 | feat(tournament): 월드컵 대시보드·생성 위저드·플레이·랭킹 화면 | frontend | 커밋 `609ec61` |
| 2026-08-25 | feat(topster): 비정방형 격자와 표시 옵션 8종 | backend | 커밋 `8705ec5` |
| 2026-08-25 | fix(frontend): 문서 대신 main 만 스크롤하도록 높이 고정 | frontend | 커밋 `f1e44e9` |
| 2026-08-25 | feat(topster): 목록에 검색·정렬, 카드에 실제 앨범 커버 렌더 | frontend | 커밋 `28315a0` |
| 2026-08-25 | feat(topster): 만들기·상세 화면을 topsters.org 구조로 개편 | frontend | 커밋 `eb34fac` |
| 2026-08-25 | feat(music): 앨범 검색에서 싱글·EP 제외 (기본값) | backend | 커밋 `0809b53` |
| 2026-08-25 | feat(frontend): 홈에서 둘러보기 카드를 빼고 최근 월드컵 목록으로 교체 | frontend | 커밋 `a0c463c` |
| 2026-08-25 | docs: 8/22~8/23 세션 기록과 과제 보드 갱신 | docs | 커밋 `9b10424` |
| 2026-08-26 | fix(frontend): 204 응답 파싱 오류와 localStorage 기반 사용자 판정 제거 | frontend | 커밋 `1decff5` |
| 2026-08-26 | feat(comment): 댓글 수정 UI와 edited_at 기반 "(수정됨)" 표시 | backend, frontend | 커밋 `44073b9` |
| 2026-08-26 | feat(like): 앨범·트랙·아티스트 좋아요 버튼과 배치 상태 조회 | backend, frontend | 커밋 `d806a6e` |
| 2026-08-26 | feat(topster): 수정·삭제 화면과 TopsterEditor 추출 | frontend | 커밋 `65a3df0` |
| 2026-08-26 | feat(tournament): 수정 화면, 유저별·내 목록, 프로필에 월드컵 나열 | backend, frontend | 커밋 `df4845f` |
| 2026-08-26 | docs: 8/26 세션 기록과 과제 보드 갱신 | docs | 커밋 `696f382` |
| 2026-08-26 | feat(tournament): 월드컵 상세에 댓글 영역 추가 | frontend | 커밋 `4442220` |
| 2026-08-26 | docs: 월드컵 댓글 영역 반영과 세션 기록 | docs | 커밋 `433b81a` |
| 2026-08-27 | fix: 재생 버튼 색 예산 위반, GET 프리플라이트, 아티스트 앨범 싱글 노이즈 | backend, frontend | 커밋 `07383ba` |
| 2026-08-27 | docs: 완료 3건 과제 보드에서 제거, 8/27 세션 기록 | docs | 커밋 `ff1a39a` |
| 2026-08-27 | docs: 리뷰·감성 태그를 구현 범위에서 제외 | CLAUDE.md, _workspace, docs | 커밋 `8bb3945` |
| 2026-08-27 | docs(design): 색 예산에 선택 상태 폼 컨트롤 예외 명문화 | DESIGN.md | 커밋 `2609251` |
| 2026-08-27 | feat(frontend): 탑스터 목록·월드컵 대시보드 무한 스크롤 | docs, frontend | 커밋 `61e1050` |
| 2026-08-27 | docs(design): 탑스터 레퍼런스와 배경색 예외를 정본에 반영 | DESIGN.md | 커밋 `2013d15` |
| 2026-08-27 | feat(frontend): 프로필 목록도 무한 스크롤, 하단 블록 컴포넌트 추출 | frontend | 커밋 `6588483` |
| 2026-08-27 | feat(tournament): 월드컵 후보 전체 보기 | frontend | 커밋 `0bcc5c8` |
| 2026-08-27 | perf(music): 단건 조회 캐시, 검색 write-through, 만료 행 정리 | backend | 커밋 `4285909` |
| 2026-08-27 | perf(tournament): 랭킹 집계를 파이썬 전수 루프에서 SQL로 | backend | 커밋 `8d45a42` |
| 2026-08-27 | docs: T3 잔여 5건 처리 반영, 세션 기록 | docs | 커밋 `1789587` |
| 2026-08-27 | refactor(music): 캐시 TTL을 item_type 표 하나로 합침 | backend, docs | 커밋 `5be030f` |
| 2026-08-27 | docs: 기능 요청 7건을 T5로 정리 | docs | 커밋 `c2d0acb` |
| 2026-08-27 | docs: T5의 미결 3건 확정 반영 | docs | 커밋 `3866545` |
| 2026-08-27 | feat(frontend): 탑스터·월드컵 상세에 소유자 수정·삭제 버튼 | frontend | 커밋 `7e465a0` |
| 2026-08-27 | feat(tournament): 만들기·수정의 담긴 목록을 카드+썸네일로 | frontend | 커밋 `d0f946c` |
| 2026-08-27 | feat!: 탑스터의 공개/비공개 개념 제거 | backend, frontend | 커밋 `52515f3` |
| 2026-08-27 | feat(frontend): 탑스터·월드컵 공유에 OG 메타데이터와 썸네일 | frontend | 커밋 `e904e81` |
| 2026-08-27 | feat(tournament): 강수 선택을 /tournament/{id}/play 로 분리 | frontend | 커밋 `6fbb716` |
| 2026-08-27 | feat(play): 카드 확대, 배경 대진표, 전체 대진표 전환 | DESIGN.md, frontend | 커밋 `134ae7f` |
| 2026-08-27 | docs: T5 6건 완료 반영, 세션 기록 | docs | 커밋 `ae4b7cc` |
| 2026-08-28 | feat(backend): 조회수 컬럼과 전용 증가 엔드포인트, 목록·상세에 집계 3종 | backend | 커밋 `f00d5a5` |
| 2026-08-28 | refactor(frontend): 컴포넌트를 도메인별로, lib 을 역할별로 재편 + 상세 UI 통일 | frontend | 커밋 `c0a0ee1` |
| 2026-08-28 | docs: 8/27~8/28 세션 기록, 구현 범위·규약 갱신 | .claude, CLAUDE.md, DESIGN.md, docs | 커밋 `f31b9fe` |
| 2026-08-28 | feat(player): 큐 기반 재생기 — 어디서 눌러도 재생목록에 쌓고 이어 재생 | backend, frontend | 커밋 `861f3d7` |
| 2026-08-28 | docs: 재생기 세션 기록, 구현 범위에 '재생' 추가 | docs | 커밋 `9c435a6` |
