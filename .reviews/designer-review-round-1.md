# Designer review — round 1

**Date:** 2026-08-20T00:00:00+09:00
**Artifact:** `frontend/app/page.tsx` (+ 렌더 트리: `components/music/TopsterCard.tsx`, `components/ui/card.tsx`)
**DESIGN.md:** `DESIGN.md` (read at review time, 2026-08-20 작성분)
**Viewport:** both

## Summary

- BLOCK: 3
- WARN: 4
- FYI: 1

## Issues

### [BLOCK] 탑스터 카드 전체가 클릭 영역인데 focus 상태 없음
- **Location:** `frontend/components/music/TopsterCard.tsx:25`
- **Rule:** § Component states — raw 인터랙티브 요소는 최소 `hover:`/`focus-visible:ring-*` 필수
- **Evidence:** `<Link href={...} className="group block">`로 카드 전체를 감싸는데, 이 Link 자체에는 아무 상태 클래스가 없다. hover는 자식 `<Card>`의 `group-hover:bg-accent`로 흉내 내지만 `focus-visible:` 링이 어디에도 없어 키보드 탐색 시 어떤 카드가 포커스됐는지 보이지 않는다. 홈페이지에 최대 12장까지 렌더링되므로 영향 범위가 크다.
- **Fix suggestion:** Link에 `focus-visible:ring-3 focus-visible:ring-ring/50 rounded-lg outline-none` 추가 (Card의 radius인 `rounded-xl`과 맞춰 링도 같은 radius로).

### [BLOCK] 둘러보기 숏컷 카드도 동일한 focus 누락
- **Location:** `frontend/app/page.tsx:66`
- **Rule:** § Component states
- **Evidence:** `<Link key={href} href={href} className="group block">`도 위와 동일한 패턴. 4개 숏컷 카드 전부 focus-visible 없음.
- **Fix suggestion:** 위와 동일한 처리. 반복되는 패턴이므로 `<Link>` 래핑을 공용 `InteractiveCard` 같은 작은 컴포넌트로 뽑아 한 곳에서 고치는 걸 권장 (TopsterCard와 이 파일 두 군데에서 같은 버그가 독립적으로 발생했다는 것 자체가 공용화 필요 신호).

### [BLOCK] 탑스터 그리드 셀의 `bg-primary` 반복 사용이 컬러 예산을 크게 초과
- **Location:** `frontend/components/music/TopsterCard.tsx:39`
- **Rule:** § Color — saturated(`primary`) 요소 4개 초과 시 BLOCK
- **Evidence:** `filled ? 'bg-primary/40' : 'bg-foreground/5'` — 채워진 칸마다 amber가 칠해진다. grid_size가 3~5이므로 카드 하나에 최대 25칸, 홈페이지에 카드가 최대 12장 렌더링되면 화면 하나에 수십~수백 개의 `bg-primary` 요소가 동시에 보인다. DESIGN.md의 "2개 초과 WARN / 4개 초과 BLOCK" 규칙을 문자 그대로 적용하면 이 페이지는 항상 BLOCK이다.
- **Fix suggestion:** 코드를 고치라는 뜻이 아니다 — **DESIGN.md § Color budget 규칙에 예외 조항이 빠져 있다.** 콘텐츠 그리드(탑스터 미리보기처럼 데이터 자체를 표현하는 반복 타일)는 CTA/배지 같은 "주의를 끄는 강조 요소"와 성격이 다르고, `/40` 투명도로 채도 체감도 낮췄다. DESIGN.md에 "반복되는 콘텐츠 타일(그리드 미리보기 등)은 색상 예산 카운트에서 제외한다" 같은 조항을 추가하고 재리뷰할 것을 권장.

### [WARN] 섹션 헤더 타이포그래피가 다른 페이지와 어긋남
- **Location:** `frontend/app/page.tsx:32`, `frontend/app/page.tsx:63`
- **Rule:** § Typography — "섹션 헤더"는 `text-2xl font-bold`
- **Evidence:** `<h2 className="font-heading text-lg font-bold">최근 탑스터</h2>` / `<h2 className="mb-4 font-heading text-lg font-bold">둘러보기</h2>` — 둘 다 `text-lg`(18px)를 쓴다. DESIGN.md는 탑스터 목록·토너먼트·로그인 페이지의 섹션 헤더를 근거로 `text-2xl`(24px)을 "섹션 헤더" 토큰으로 지정했는데, 홈페이지만 다른 크기를 쓰고 있다.
- **Fix suggestion:** 홈페이지 h2를 `text-2xl font-bold`로 맞추거나, 홈페이지의 "카드 미리보기 섹션"은 다른 페이지의 전체 리스트 헤더보다 위계가 낮다는 의도라면 DESIGN.md에 "홈 미리보기 섹션 헤더"라는 별도 토큰(`text-lg`)을 명시적으로 추가할 것. 지금처럼 문서에 없는 크기가 조용히 쓰이는 상태가 문제.

### [WARN] 임의 radius 값 사용
- **Location:** `frontend/components/music/TopsterCard.tsx:38`
- **Rule:** § Radius — 문서화된 5종(`none/md/lg/xl/full`) 밖의 임의 값은 WARN
- **Evidence:** `'aspect-square rounded-[2px]'` — 그리드 셀 하나하나에 `rounded-[2px]`라는 arbitrary value를 직접 지정. DESIGN.md 어떤 토큰과도 매칭되지 않음.
- **Fix suggestion:** 셀이 8px 안팎으로 매우 작으므로 `rounded-sm`(정의는 돼 있으나 실사용 0건이던 토큰, 6px)으로 교체하거나, 이 정도로 작은 그리드 셀에는 radius가 거의 안 보이니 `rounded-none`으로 통일. 둘 중 하나로 정하고 DESIGN.md의 "실사용 0건" 각주를 갱신.

### [WARN] 배지 텍스트가 문서화된 최소 크기보다 작음
- **Location:** `frontend/components/music/TopsterCard.tsx:50`
- **Rule:** § Typography — 문서화된 최소 토큰은 `text-xs`(12px)
- **Evidence:** `<Badge variant="outline" className="px-1.5 text-[10px]">` — arbitrary value로 10px까지 내려감. DESIGN.md 스케일에 없음.
- **Fix suggestion:** `text-xs`(12px)로 올리거나, 이렇게 작은 배지가 실제로 필요하면 DESIGN.md에 "극소 배지" 티어로 10px을 공식 추가.

### [WARN] 컬러 예산 — 아이콘 4개가 임계값에 걸쳐 있음
- **Location:** `frontend/app/page.tsx:69` (4회 반복), `frontend/app/page.tsx:33-35`
- **Rule:** § Color — saturated 2개 초과 WARN, 4개 초과 BLOCK
- **Evidence:** `<Icon className="mb-1 size-5 text-primary" />`가 숏컷 카드 4개에 각각 렌더링되어 `text-primary` 사용이 정확히 4회. 여기에 상단 "전체 보기" 링크(`variant="link"`은 버튼 내부적으로 `text-primary`)까지 스크롤 없이 같은 화면에 들어오면 5회로 BLOCK 임계값을 넘는다. 두 섹션이 실제로 한 화면(뷰포트) 안에 동시에 보이는지는 화면 높이에 따라 달라 이번 리뷰에서는 스크린샷 없이 정적 분석만 했다.
- **Fix suggestion:** 데스크톱 1280px / 모바일 375px 스크린샷을 떠서 두 섹션이 폴드 안에 동시에 들어오는지 확인. 동시에 보인다면 숏컷 아이콘 중 일부(예: 로그인)를 `text-muted-foreground`로 낮춰 3개 이하로 줄이는 걸 권장.

### [FYI] `text-base`가 실사용되는데 DESIGN.md 스케일에서 누락
- **Location:** `frontend/components/ui/card.tsx:41` (CardTitle 기본), `frontend/app/page.tsx:70`
- **Rule:** § Typography
- **Evidence:** `CardTitle`의 기본(`size=default`) 스타일이 `text-base`(16px)인데, 홈페이지 숏컷 카드는 `size` prop을 안 줘서 기본값으로 렌더링된다. DESIGN.md § Typography 표에는 `text-base` 행이 없다 — 표를 작성할 때 `app/`·`components/`만 훑고 shadcn 프리미티브 기본값을 놓친 것으로 보인다.
- **Fix suggestion:** 코드는 정상 동작이라 고칠 필요 없음. DESIGN.md § Typography 표에 `text-base` / 16px / "카드 기본 타이틀(size=default)" 행을 추가해 문서를 코드와 맞출 것.

## Verdict

- **BLOCK** (BLOCK=3) — 출간 불가, writer revision round 시작 필요. 그 중 1건(컬러 예산 BLOCK)은 코드가 아니라 DESIGN.md 규칙 자체의 예외 조항 누락이 원인이므로, revision은 (a) 두 곳의 focus-visible 수정 + (b) DESIGN.md § Color에 콘텐츠 타일 예외 조항 추가, 두 트랙으로 진행 권장.
