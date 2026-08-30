# 백엔드 구현 결과 (2026-08-30)

| 파일 | 내용 |
|---|---|
| `models/comment.py` | `Comment.user_id` nullable, `guest_nickname`·`guest_token_hash` 추가, `author_nickname` 프로퍼티, `comments_author_present` 체크 제약. **`CommentReport` 모델 신규** |
| `models/__init__.py` | `CommentReport` 등록 |
| `alembic/versions/6b9f4a3c25de_guest_comments_and_reports.py` | 신규 (down_revision `4e8b1c60d92a`). **실제 DB 에 적용 완료** |
| `schemas/comment.py` | `CommentCreate.nickname`, `CommentReportCreate`, `CommentResponse` 에 `author_nickname`·`is_mine`·`reported_by_me`·`report_count`, `user` nullable |
| `routers/comment.py` | 인증을 `get_current_user` → `get_optional_user`. `hash_guest_token`·`_is_mine`·`_to_response`·`_report_state` 추가. `POST .../{comment_id}/report` 신규 (범용·레거시 두 경로) |

손대지 않은 것: `comment_counts()` · `purge_comments()` 시그니처 그대로 →
`routers/topster.py` · `routers/tournament.py` 무영향.
