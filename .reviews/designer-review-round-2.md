# Designer review — round 2

**Date:** 2026-08-20T00:00:00+09:00
**Artifact:** `frontend/app/page.tsx` (+ 렌더 트리: `components/music/TopsterCard.tsx`, `components/ui/card.tsx`)
**DESIGN.md:** `DESIGN.md` (read at review time, round 1 이후 § Color 예외 조항 추가된 버전)
**Viewport:** both
**Prior report:** `.reviews/designer-review-round-1.md`

## Summary

- BLOCK: 0
- WARN: 4 (전부 UNRESOLVED, 이월)
- FYI: 1 (UNRESOLVED, 이월)

## Round 1 대비 상태

### [RESOLVED] 탑스터 카드 focus 상태 없음
- **Location:** `frontend/components/music/TopsterCard.tsx:25-28`
- **확인:** `<Link href={...} className="group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">` — Card의 `rounded-xl`과 radius를 맞춘 focus-visible 링 추가됨. § Component states 규칙 충족.

### [RESOLVED] 둘러보기 숏컷 카드 focus 상태 없음
- **Location:** `frontend/app/page.tsx:66-70`
- **확인:** 동일한 `focus-visible:ring-3 focus-visible:ring-ring/50` 패턴 적용됨.

### [RESOLVED] 탑스터 그리드 셀의 컬러 예산 초과
- **Location:** `frontend/components/music/TopsterCard.tsx:42`, `DESIGN.md:58`
- **확인:** 코드는 그대로 `bg-primary/40`이지만, DESIGN.md § Color budget에 "반복 콘텐츠 타일" 예외 조항이 추가됨. 이 셀은 예외 조건 (a) 카드 내부의 작은 그리드 셀, (b) `/40` 투명도 적용 — 둘 다 충족하므로 규칙상 더 이상 위반이 아님.

### [UNRESOLVED] 섹션 헤더 타이포그래피가 다른 페이지와 어긋남 — WARN
- **Location:** `frontend/app/page.tsx:32`, `frontend/app/page.tsx:63`
- **Rule:** § Typography — "섹션 헤더"는 `text-2xl font-bold`
- **Evidence:** `text-lg font-bold` 그대로 유지됨. 이번 라운드에서 손대지 않은 것으로 보임(범위가 BLOCK 한정이었음).
- **Fix suggestion:** round 1과 동일 — `text-2xl`로 맞추거나 DESIGN.md에 "홈 미리보기 섹션 헤더" 별도 토큰 추가.

### [UNRESOLVED] 임의 radius 값 — WARN
- **Location:** `frontend/components/music/TopsterCard.tsx:41`
- **Rule:** § Radius
- **Evidence:** `rounded-[2px]` 그대로.
- **Fix suggestion:** round 1과 동일 — `rounded-sm`(6px) 또는 `rounded-none`으로 교체.

### [UNRESOLVED] 임의 폰트 크기(배지) — WARN
- **Location:** `frontend/components/music/TopsterCard.tsx:53`
- **Rule:** § Typography
- **Evidence:** `text-[10px]` 그대로.
- **Fix suggestion:** round 1과 동일 — `text-xs`(12px)로 올리거나 DESIGN.md에 극소 배지 티어 추가.

### [UNRESOLVED] 컬러 예산 경계 — WARN
- **Location:** `frontend/app/page.tsx:73` (4회), `frontend/app/page.tsx:33-35`
- **Rule:** § Color
- **Evidence:** 숏컷 아이콘 4개 `text-primary` + "전체 보기" 링크, 스크롤 폴드 여부 미확인 상태 그대로.
- **Fix suggestion:** round 1과 동일 — 스크린샷으로 폴드 확인 후 필요시 아이콘 1개 이상 `text-muted-foreground`로 완화.

### [UNRESOLVED] `text-base` DESIGN.md 누락 — FYI
- **Location:** `frontend/components/ui/card.tsx:41`
- **Rule:** § Typography
- **Evidence:** DESIGN.md § Typography 표에 `text-base` 행 여전히 없음.
- **Fix suggestion:** round 1과 동일 — 문서에 행 추가.

## New issues

없음. 이번 라운드에서 새로 발견된 위반 없음. focus-visible 추가로 인한 부작용(예: 잘못된 radius, 새 컬러 사용)도 없음.

## Verdict

- **REVISION** (BLOCK=0, WARN=4 > 3) — 출간은 가능하나 WARN 4건이 임계(3)를 넘어 권장 수정 대상. BLOCK은 모두 해소되어 escalation 불필요.
