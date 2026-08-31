# QA 보고 — 2026-08-30

## 1. 프론트–백 경계면 교차 검증

**실행 중인 서버의 `/openapi.json` 과 `frontend/types/social.ts` 를 직접 비교했다**(소스를
눈으로 맞춘 것이 아니다).

| 필드 | 백엔드 | 프론트 |
|---|---|---|
| `author_nickname` | required | `string` |
| `content` / `created_at` / `updated_at` / `id` / `target_id` | required | `string` |
| `target_type` | required | `CommentTargetType` |
| `edited_at` | nullable | `string \| null` |
| `user` | **nullable** | `CommentUser \| null` |
| `is_mine` / `reported_by_me` | 기본값 있음 | `boolean` |
| `report_count` | 기본값 있음 | `number` |

**결과: PASS** — 필드 누락·nullable 불일치 0건.

`is_mine`·`reported_by_me`·`report_count` 는 OpenAPI 상 기본값이 있어 `required` 가 아니지만
`_to_response()` 가 **항상** 채워 보내므로 프론트에서 옵셔널로 둘 필요가 없다.

## 2. 백엔드 실제 호출 검증 (curl)

Docker DB + uvicorn 을 띄우고 실제로 호출했다. 화면이 아니라 응답으로 확인한 것이다.

| 시나리오 | 기대 | 실제 |
|---|---|---|
| 비로그인 작성, 닉네임 생략 | `author_nickname="익명"`, `user=null`, `is_mine=true` | ✅ |
| 비로그인 작성, 닉네임 지정 | 지정한 닉네임 | ✅ |
| 작성자 토큰 없이 작성 | 400 | ✅ `작성자 토큰이 필요합니다` |
| 내용이 공백만 | 400 | ✅ `내용을 입력해 주세요` |
| 남의 댓글 신고 | 204 | ✅ |
| 같은 사람이 재신고 | 409 | ✅ `이미 신고한 댓글입니다` (부분 유니크 인덱스) |
| 자기 댓글 신고 | 400 | ✅ `자신의 댓글은 신고할 수 없습니다` |
| 남의 댓글 삭제 | 403 | ✅ |
| 토큰 없이 삭제 | 403 | ✅ |
| 본인 댓글 삭제 | 204 + 목록에서 사라짐 | ✅ |
| `report_count` 가 보는 사람과 무관한지 | 토큰 유무와 무관하게 같은 값 | ✅ |
| `reported_by_me` 가 신고자에게만 true 인지 | 신고자만 true | ✅ |
| 댓글 삭제 시 신고 행 CASCADE | 같이 사라짐 | ✅ (2→1, 남은 신고는 살아있는 댓글을 가리킴) |
| 레거시 `/api/topsters/{id}/comments` 경로 | 위와 동일하게 동작 | ✅ 전 과정 재현 |

마이그레이션도 실제 DB 에 적용해 `information_schema` 로 확인했다 —
`comments.user_id` nullable, `guest_nickname`/`guest_token_hash` 추가,
`comment_reports` 부분 유니크 인덱스 2개, `comments_author_present` 체크 제약.

**테스트로 만든 댓글·신고는 전부 지웠다**(`guest_token_hash IS NOT NULL` 기준 0건 확인).

## 3. 프론트 정적 검증

`tsc --noEmit` · `pnpm build` · `pnpm lint` 통과.
eslint error 2건은 **이번에 건드리지 않은** `app/search/page.tsx`·`components/layout/Navbar.tsx`
의 기존 것이다(`react-hooks/set-state-in-effect`).

빌드 CSS 에 새 애니메이션이 실제로 생성된 것까지 확인:

```
@keyframes battle-winner{ ... translateX(calc(var(--battle-dir) * (50% + var(--battle-gap) / 2))) scale(1.06) }
--battle-gap: calc(var(--spacing) * {3,4,6,8})   ← 반응형·라운드별 4종 전부
.gap-\(--battle-gap\){ }   .overflow-x-clip{ }
```

`pnpm dev` 로 띄워 `/`, `/topsters/{id}`, `/tournament/{id}` 모두 200.

## 4. 남은 이슈 — 눈으로만 판정되는 것

### 4-1. SSR HTML 로는 댓글 영역을 검증할 수 없다 (기존 구조)

`/topsters/{id}` 의 SSR HTML 에 `댓글` 문자열이 0건이다. 다만 **`좋아요`·`이미지 저장` 도
똑같이 0건**이라 이번 변경 때문이 아니라 상세 본문 전체가 스트리밍 Suspense 슬롯 안에
들어가는 구조 때문이다(응답 끝에 빈 `<div hidden id="S:0">` + `$RC` 스크립트).
즉 **이 화면들은 원래부터 브라우저로만 확인할 수 있다.**

### 4-2. 브라우저에서 봐야 하는 것

- 튕겨내기: 진 카드가 실제로 날아가는지, **320px 에서 가로 스크롤이 안 생기는지**
  (`overflow-x-clip` 이 의도대로 도는지 — BLOCK 사안), 이긴 카드가 정확히 가운데에 서는지
  (`calc(50% + var(--battle-gap)/2)` 계산이 맞는지), 620ms 가 길지 않은지
- 비로그인 댓글 폼이 로그인 상태에서는 닉네임 칸 없이 나오는지
- 신고 드롭다운이 열리고, 신고 후 버튼이 잠기는지
- 우승 화면 댓글이 월드컵 상세와 **같은 목록**을 보여 주는지

### 4-3. 알려진 한계 (설계상 감수)

브라우저 데이터를 지우거나 다른 기기·시크릿 창에서 보면 자기 익명 댓글을 지울 수 없다.
비밀번호 칸을 두지 않기로 한 결과다(요청의 입력란이 닉네임·내용 둘뿐이었다).
