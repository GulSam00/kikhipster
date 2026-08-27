# kikhipster DESIGN.md

> 이 문서는 프론트엔드 코드(`frontend/app`, `frontend/components`, `frontend/app/globals.css`)에서
> 실제로 쓰이고 있는 값을 역추출해 토큰화한 것이다. 발명된 스펙이 아니라 현재 구현의 정본.
> 새 화면을 만들 때는 여기 없는 값을 새로 쓰지 말고 이 표에서 고른다.
> 갱신 시점: 2026-08-27 (§ Color budget에 선택 상태 폼 컨트롤 예외 추가)

---

## § Visual reference

토큰(색·radius·spacing)과 별개로, 화면별로 어떤 서비스의 레이아웃·인터랙션을 참고하는지 정한 것. 아래 항목은 "코드에서 역추출한 현재 상태"가 아니라 **앞으로 맞춰갈 방향**이므로, 다른 섹션과 달리 실사용 여부와 무관하게 유지한다.

**출처**: oh-my-design의 검증된 레퍼런스 카탈로그(`references/<id>/DESIGN.md`, Tier-1 공식 URL 라이브니스 확인을 거친 것). 카탈로그 밖 서비스(Letterboxd·RYM·AOTY·PIKU)는 전부 `WebFetch` 403으로 직접 관측에 실패해 후보에서 뺐다 — 이름만 대고 근거 없이 참고하지 않기로 함. `reference-tags.md` 인덱스는 94개뿐이라 실제 카탈로그(440개, 멜론·지니·FLO·왓챠·넷플릭스 등 포함)보다 훨씬 좁으니, 다음에 레퍼런스를 찾을 땐 인덱스가 아니라 `references/` 디렉터리를 직접 뒤질 것.

| 화면 | 레퍼런스 | 검증 상태 | 가져올 것 |
|------|---------|----------|----------|
| 탑스터 (그리드 랭킹) | **topsters.org** (구조), Netflix·Watcha (타일 인터랙션) | topsters.org는 헤드리스 브라우저로 직접 관측, 나머지는 카탈로그 검증됨 | **구조는 topsters.org를 따랐다** — 격자 옆에 `아티스트 – 앨범` 목록을 세로로 두고, 격자 크기·배경색·글자색·간격·넘버링을 사용자가 고르는 편집기 모델. 타일 간격 4~8px 타이트와 hover는 그림자 대신 `scale`+z-index(다크 캔버스에서 그림자는 거의 안 보임)는 Netflix·Watcha에서 |
| 노래 토너먼트 — 기본 화면 | Watcha 평점 배지 패턴 | 카탈로그 검증됨 | 항상 2장 카드 대결만 노출, 결과 확정 시 배지형 피드백(`#F82F62` 류의 작고 굵은 텍스트) |
| 노래 토너먼트 — 대진표 (2026-08-27 개정) | 참고 없음 (자체 설계) | — | 카탈로그에도 카탈로그 밖(PIKU 관측 실패)에도 브래킷 트리 패턴이 없어 자체 설계한다. **방침이 바뀌었다** — 예전엔 "'대진표 보기' 버튼 → `Dialog`(풀스크린) 안 pan/zoom" 이었으나, 이제 **① 대결 화면 배경에 현재 라운드 인근 트리를 상시로 깔고(`sm` 이상) ② 우측 상단 전환 버튼으로 전체 대진표 뷰로 바꾼다.** 배경 트리는 **현재 경기와 그 승자가 올라갈 다음 자리까지만** 그린다 — 128강에서 전체를 깔면 선과 점의 덩어리가 되고, "선택한 쪽이 올라가는" 애니메이션도 이 범위에서 가장 잘 읽힌다 |
| 다크 UI 마감도 (표면 계층 로직) | Netflix, Watcha | 카탈로그 검증됨 | **로직만 차용, 색값은 안 씀** — "캔버스가 검을수록 그림자보다 밝기 단계로 위계를 표현한다"는 원칙. 실제 `--background`/`--card`/`--popover` 값은 zinc 그대로 유지(shadcn 추가 컴포넌트와의 호환을 우선) |
| 색·geometry 토큰 (보조) | Spotify | 카탈로그 검증됨 | pill/circle 버튼 기하, muted 텍스트 대비 수준 — 단, 이미 기존 토큰이 같은 결론이라 보강 확인 정도의 의미 |
| 랭킹 리스트 밀도 (국소) | Melon | 카탈로그 검증됨 | 톤(흰 배경)은 안 맞아 전체 채용 안 함. 토너먼트 결과 랭킹표처럼 "행 밀도를 최대화"해야 하는 표에만 밀도 논리 국소 적용 |

**현재 구현과의 격차** (2026-08-27 갱신): 대진표 데이터 전제는 이미 해결됐다 — 월드컵 재설계로 대진과 라운드별 승자가 서버에 기록되고(`/api/plays/{id}` 가 전체 라운드를 준다) 새로고침에도 남는다. 예전에 여기 적혀 있던 "진행 상태가 `useState`에만 있어 새로고침하면 사라진다"는 더 이상 사실이 아니다.

**§ Mobile responsiveness 예외** (2026-08-27 개정): 기본 화면(2카드)은 가로 스크롤이 원천적으로 없으므로 § Mobile 규칙을 그대로 따른다.

- **배경 트리는 `sm` 미만에서 렌더하지 않는다.** 좁은 화면에서 트리를 넣으면 페이지가 가로로 밀리거나(가로 스크롤 금지 위반) 알아볼 수 없을 만큼 줄여야 한다. 모바일에서는 대결 카드가 화면을 다 쓰고, 대진표는 전환 버튼으로만 본다.
- **전체 대진표 뷰의 내부 스크롤은 이 규칙의 적용 대상이 아니다.** 페이지가 가로로 밀리는 것과 특정 영역이 자기 안에서 스크롤되는 것은 다르다 — 목록의 `overflow-x: auto` 컨테이너와 같은 취급이다.

---

## § Typography

**폰트**: Geist (`next/font/google`, `--font-sans`). 다른 폰트 도입 안 됨.

실제 사용 중인 스케일 (Tailwind 기본 `text-*` 중 이 프로젝트가 쓰는 부분집합):

| 토큰 | 크기 | 용도 (실사용 예) |
|------|------|------|
| `text-3xl` `font-bold` | 30px | 아티스트/앨범 상세 페이지 타이틀 (`app/artists/[id]`, `app/albums/[id]`) |
| `text-2xl` `font-bold` | 24px | 섹션 헤더 (탑스터 목록, 토너먼트, 로그인) |
| `text-xl` `font-bold` | 20px | 프로필 이름, 카드 상세 타이틀 |
| `text-lg` `font-bold`/`font-medium` | 18px | 카드 제목, 서브섹션 헤더, 로고(Navbar) |
| `text-sm` `font-normal`/`font-medium` | 14px | 본문, 리스트 아이템, 버튼 라벨 |
| `text-xs` `font-medium` | 12px | 메타 정보(날짜·장르), 배지, 모바일 하단 탭 라벨 |

**금지**: `text-4xl` 이상, `font-semibold`, `font-light` — 코드베이스 어디에도 없음. 새로 쓰지 말 것.

**계층 규칙**: 한 페이지 안에서 h1급(`text-3xl`/`text-2xl`)은 1개만. 카드 내부 제목은 `text-lg`를 넘지 않는다.

---

## § Color

**베이스**: zinc (shadcn `baseColor: zinc`, `components.json`)
**브랜드 강조색 (saturated)**: amber — `--primary: oklch(0.769 0.188 70.08)` (2026-08-20, 이전 violet에서 교체, 근거 없이 골랐던 값이라 교체함)

### 시맨틱 토큰 (하드코딩 금지 — 반드시 이 이름으로 사용)

| 토큰 | 용도 | 채도 |
|------|------|------|
| `bg-background` | 페이지 배경 | 무채색 |
| `bg-card` | 카드/패널 배경 | 무채색 |
| `bg-primary` / `text-primary` | 브랜드 강조 — CTA, 활성 상태, 로고 | **saturated (amber)** |
| `bg-destructive` / `text-destructive` | 삭제·에러 | **saturated (red-orange)** |
| `text-muted-foreground` | 보조 텍스트 | 무채색 |
| `bg-accent` | hover 배경 (중립, 브랜드색 아님) | 무채색 |
| `bg-secondary` | 보조 배경 | 무채색 |
| `border` | 구분선 | 무채색 (10% 투명 흰색, dark) |

### Color budget 규칙 (Toss 2-saturated 원칙)

**saturated로 카운트되는 토큰은 `primary`(amber)와 `destructive`(red-orange) 둘 뿐이다.** `accent`/`secondary`/`muted`는 채도값이 0.001~0.016 수준으로 사실상 무채색이라 카운트 대상이 아니다.

- 한 화면(viewport)에 `primary` 계열 강조 요소가 2개를 넘으면 WARN, 4개를 넘으면 BLOCK
- `destructive`는 삭제/에러 컨텍스트에서만 — 강조 목적으로 쓰면 WARN
- `primary`와 `destructive`가 같은 화면에서 동시에 두드러지면(둘 다 강조 목적) WARN — 색상환이 가까워(amber↔red-orange) 구분이 흐려짐
- DESIGN.md에 없는 hex/oklch 직접 지정 금지 (`bg-[#f59e0b]` 같은 arbitrary value) — WARN

**예외 — 사용자가 고른 콘텐츠 색 (2026-08-27 명문화):** 탑스터의 배경색·글자색처럼 **사용자가 자기 작품에 지정하는 색**은 위 "arbitrary value 금지"의 적용 대상이 아니다. 그 규칙은 UI 크롬(버튼·배지·패널)이 정본 토큰 밖으로 새어 나가는 걸 막는 것이고, 여기서 hex는 스타일이 아니라 **사용자가 입력한 데이터**다. 백엔드·프론트 모두 형식(`#RGB`/`#RRGGBB`)만 강제하고 값은 제한하지 않는다. 단, 이 예외는 저장되는 사용자 콘텐츠에만 해당한다 — 편집기 자체의 버튼·탭·라벨은 그대로 토큰을 쓴다.

**예외 — 반복 콘텐츠 타일:** 탑스터 그리드 미리보기처럼 데이터 자체를 표현하는 반복 타일(예: `TopsterCard`의 채워진 칸)은 이 카운트에서 제외한다. CTA·배지·아이콘처럼 "사용자 주의를 끌기 위한" 강조 요소와 "콘텐츠 내용을 색으로 인코딩하는" 요소는 목적이 다르다. 단, 이 예외는 (a) 개별 타일 면적이 작고(카드 하나 안에서 나열되는 그리드 셀 수준) (b) 채도를 낮춘 상태(`/40` 등 투명도 적용)일 때만 적용된다. 버튼·배지 크기의 단일 요소를 이 예외로 우회하지 말 것.

**예외 — 선택 상태 폼 컨트롤 (2026-08-27 추가):** `Checkbox`/`Radio`/`Switch`처럼 **사용자의 선택 상태를 채움으로 인코딩하는** 컨트롤의 `primary` 채움은 카운트에서 제외한다. 위 반복 타일 예외와 같은 논리다 — "주의를 끌기 위한 강조"가 아니라 "상태를 색으로 인코딩"하는 요소다. 단 (a) `size-4`~`size-5` 수준의 작은 컨트롤이고 (b) `components/ui/*` shadcn 프리미티브의 기본 스타일(`data-checked:bg-primary`)일 때만 적용된다. 버튼·배지 크기의 토글이나 직접 칠한 `bg-primary`를 이 예외로 우회하지 말 것.

> 이 예외를 넣은 경위: 탑스터 만들기 화면 옵션 탭의 체크박스 4개가 체크 시 `bg-primary`라 저장 버튼까지 한 화면 primary 5개가 되어 BLOCK으로 잡혔다(2026-08-23). 그런데 그 색은 화면이 직접 칠한 게 아니라 `components/ui/checkbox.tsx`의 shadcn 기본값이다. 프리미티브를 고쳐 중립으로 내리는 건 앞으로 생길 모든 체크박스에 영향을 주고 CLAUDE.md의 "shadcn/ui 위에서 조립한다"와도 부딪혀서, 규칙 쪽에 예외를 명문화하는 것으로 정리했다.

다크 테마 고정. `<html>`에 `dark` 클래스 항상 부착, `:root`(라이트) 토큰은 존재하지만 실사용 경로 없음.

---

## § Radius

베이스 `--radius: 0.625rem` (10px), `app/globals.css`의 `@theme inline`에서 파생:

| 토큰 | 값 | 실사용 |
|------|-----|--------|
| `rounded-none` | 0 | 탭 비활성 상태 등 |
| `rounded-md` | 8px (`--radius-md`) | 스켈레톤, 배지, 미니플레이어, 앨범 카드 |
| `rounded-lg` | 10px (`--radius-lg`, 기본) | 버튼, 인풋, 카드 대부분 |
| `rounded-xl` | 14px (`--radius-xl`) | Empty 상태 컨테이너 |
| `rounded-full` | 9999px | 아바타, 아티스트 카드 이미지, 원형 아이콘 버튼 |

**`rounded-sm`/`rounded-2xl`/`rounded-3xl`/`rounded-4xl`은 토큰만 정의돼 있고 실사용 0건** — 새 컴포넌트에 이 값을 쓰면 FYI(의도 확인 필요), 기존 5종(none/md/lg/xl/full) 밖의 임의 값(`rounded-[6px]` 등)은 WARN.

같은 컴포넌트 안에서 radius 두 종류 혼용(예: 카드는 `rounded-xl`인데 내부 배지가 `rounded-lg`) — FYI, 의도적 위계면 허용.

---

## § Component states

`components/ui/*` shadcn 프리미티브(Button, Input, Toggle 등)는 이미 5-state를 기본 제공한다 (`components/ui/button.tsx` 기준):

- default: `bg-primary text-primary-foreground`
- hover: `hover:bg-primary/80`
- focus: `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`
- active: `active:translate-y-px`
- disabled: `disabled:pointer-events-none disabled:opacity-50`

**규칙**: `components/ui/*`를 조립해 쓰는 한 5-state는 자동으로 따라온다. 문제는 **raw `<button>`/`<div onClick>`을 새로 만들 때** — 이 경우 최소한 `hover:`와 `focus-visible:ring-*`이 없으면 BLOCK (a11y 필수). `Navbar.tsx`의 모바일 하단 탭처럼 `<Link>`에 직접 `hover:text-foreground`를 준 패턴은 있으나 `focus-visible:` 링이 빠져 있음 — 이 파일 자체가 이미 위반 사례이니 리뷰 시 참고.

---

## § Spacing

Tailwind 기본 4px 그리드를 그대로 쓴다. arbitrary value(`p-[13px]` 등) 발견 시 WARN — 지금까지 코드베이스에는 0건.

실사용 중인 값:

| 토큰 | px | 용도 |
|------|-----|------|
| `gap-0` / `gap-0.5` | 0 / 2px | 아이콘+라벨 초근접 배치 |
| `gap-1` / `px-1` | 4px | 버튼 내부 아이콘 간격 |
| `gap-2` / `px-2` | 8px | 카드 내부 요소 간격 (가장 빈도 높음) |
| `gap-3` / `px-4` | 12px / 16px | 섹션 내부, 리스트 아이템 간격 |
| `py-8` | 32px | 페이지 상하 여백 (search, tournament) |

**규칙**: 한 카드/섹션 컴포넌트 안에서 같은 축(가로 padding 등)에 다른 값을 섞지 않는다 (예: `px-4`와 `px-5` 혼재) — WARN.

---

## § Mobile responsiveness

- 하단 고정 탭바 (`sm:hidden`, `Navbar.tsx`): `flex-1` 4~5분할, `py-2` + `size-4` 아이콘 + `text-xs` 라벨 → 세로 높이 약 50px로 44px 기준 충족. 가로폭은 화면을 균등분할하므로 320px 기준에서도 안전.
  단, `size-4`(16px) 아이콘 자체의 히트 영역은 `py-2` 패딩 없이 텍스트만 있으면 44px 미달 가능 — 아이콘 단독 버튼(`icon-sm` 등)은 반드시 `size-7`(28px) 이상 + 패딩 조합으로 44px를 채워야 함.
- `main`에 `pb-16 sm:pb-0` — 모바일에서 하단 탭바에 콘텐츠가 가리지 않도록 하는 여백. 새 페이지에서 이 여백을 누락하면 하단 탭에 콘텐츠가 가려짐 — BLOCK.
- 가로 스크롤 발생 금지. `max-w-6xl mx-auto` 컨테이너 패턴을 벗어난 고정폭(`w-[400px]` 등) 사용 시 WARN.
