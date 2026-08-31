import { apiFetch } from '@/lib/api/client';
import { getGuestToken } from '@/lib/guest-token';

import type { Comment, CommentTargetType } from '@/types/social';

/**
 * 댓글 엔드포인트. 대상은 `(target_type, target_id)` 범용 구조라 탑스터·월드컵이 같은 경로를 쓴다.
 * `/api/comments` 문자열은 이 파일에만 있다.
 *
 * **비로그인 작성자 토큰(`lib/guest-token.ts`)을 보내는 방법이 요청 종류마다 다르다.**
 * 목록(GET)은 **쿼리 파라미터**, 나머지는 `X-Guest-Token` **헤더**다. `lib/api/client.ts` 가
 * GET 에 `Content-Type` 조차 일부러 안 붙이는 이유와 같다 — 커스텀 헤더가 하나라도 붙으면
 * 단순 요청 조건이 깨져 URL 마다 CORS 프리플라이트(OPTIONS)가 한 번씩 더 나간다(2026-08-27).
 * POST/PUT/DELETE 는 어차피 프리플라이트가 나가므로 헤더로 둬도 손해가 없다.
 */
const base = (type: CommentTargetType, id: string) => `/api/comments/${type}/${id}`;

const guestHeader = () => ({ 'X-Guest-Token': getGuestToken() });

export const listComments = (type: CommentTargetType, id: string) =>
  apiFetch<Comment[]>(`${base(type, id)}/?guest_token=${encodeURIComponent(getGuestToken())}`);

export const createComment = (
  type: CommentTargetType,
  id: string,
  content: string,
  nickname?: string,
) =>
  apiFetch<Comment>(`${base(type, id)}/`, {
    method: 'POST',
    headers: guestHeader(),
    body: JSON.stringify({ content, nickname }),
  });

export const updateComment = (
  type: CommentTargetType,
  id: string,
  commentId: string,
  content: string,
) =>
  apiFetch<Comment>(`${base(type, id)}/${commentId}`, {
    method: 'PUT',
    headers: guestHeader(),
    body: JSON.stringify({ content }),
  });

export const deleteComment = (type: CommentTargetType, id: string, commentId: string) =>
  apiFetch<void>(`${base(type, id)}/${commentId}`, {
    method: 'DELETE',
    headers: guestHeader(),
  });

/** 신고 사유. 관리 화면이 아직 없어 서버는 값을 강제하지 않는다. */
export const REPORT_REASONS = [
  { value: 'spam', label: '스팸·광고' },
  { value: 'abuse', label: '욕설·혐오' },
  { value: 'sexual', label: '음란물' },
  { value: 'etc', label: '기타' },
] as const;

export const reportComment = (
  type: CommentTargetType,
  id: string,
  commentId: string,
  reason: string,
) =>
  apiFetch<void>(`${base(type, id)}/${commentId}/report`, {
    method: 'POST',
    headers: guestHeader(),
    body: JSON.stringify({ reason }),
  });
