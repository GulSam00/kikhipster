import { apiFetch } from '@/lib/api/client';
import type { Comment, CommentTargetType } from '@/types/social';

/**
 * 댓글 엔드포인트. 대상은 `(target_type, target_id)` 범용 구조라 탑스터·월드컵이 같은 경로를 쓴다.
 * `/api/comments` 문자열은 이 파일에만 있다.
 */
const base = (type: CommentTargetType, id: string) => `/api/comments/${type}/${id}`;

export const listComments = (type: CommentTargetType, id: string) =>
  apiFetch<Comment[]>(`${base(type, id)}/`);

export const createComment = (type: CommentTargetType, id: string, content: string) =>
  apiFetch<Comment>(`${base(type, id)}/`, { method: 'POST', body: JSON.stringify({ content }) });

export const updateComment = (
  type: CommentTargetType,
  id: string,
  commentId: string,
  content: string,
) =>
  apiFetch<Comment>(`${base(type, id)}/${commentId}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });

export const deleteComment = (type: CommentTargetType, id: string, commentId: string) =>
  apiFetch<void>(`${base(type, id)}/${commentId}`, { method: 'DELETE' });
