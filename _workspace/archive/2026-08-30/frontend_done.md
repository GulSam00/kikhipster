# 프론트엔드 구현 결과 (2026-08-30)

| 파일 | 내용 |
|---|---|
| `lib/guest-token.ts` | **신규.** 비로그인 작성자 토큰(localStorage, `randomUUID` 폴백 포함) |
| `types/social.ts` | `Comment.user` nullable, `author_nickname`·`is_mine`·`reported_by_me`·`report_count` 추가 |
| `lib/api/comments.ts` | 토큰 전달(GET=쿼리, 그 외=헤더), `createComment` 에 nickname, `reportComment`·`REPORT_REASONS` 추가 |
| `components/social/CommentSection.tsx` | 비로그인 폼(닉네임+내용), 소유 판정을 `is_mine` 으로 교체, 신고 드롭다운 |
| `app/play/[playId]/page.tsx` | 튕겨내기 애니메이션(`--battle-dir`/`--battle-gap`), `overflow-x-clip` 래퍼, 대기 450→680ms, 우승 화면에 `CommentSection` |
| `app/globals.css` | `battle-winner`/`battle-loser` keyframes |
