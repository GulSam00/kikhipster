export interface CommentUser {
  id: string;
  nickname: string;
}

export type CommentTargetType = 'topster' | 'tournament';

export interface Comment {
  id: string;
  target_type: CommentTargetType;
  target_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  /**
   * 본문이 실제로 바뀐 시각. `null` 이면 한 번도 수정되지 않은 댓글이다.
   * `updated_at` 으로는 판정할 수 없다 — 백엔드에서 생성 시점에도 두 값이 미세하게 어긋난다.
   */
  edited_at: string | null;
  user: CommentUser;
}

export interface LikeStatus {
  liked: boolean;
  like_count: number;
}

export type LikeTargetType =
  | 'topster'
  | 'tournament'
  | 'album'
  | 'track'
  | 'artist'
  | 'comment';
