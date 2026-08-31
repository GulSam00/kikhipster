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
  /** 비로그인 댓글이면 `null` 이다. */
  user: CommentUser | null;
  /** 화면에 찍을 이름. 로그인·비로그인 어느 쪽이든 항상 채워진다. */
  author_nickname: string;
  /**
   * 내가 쓴 댓글인지. **판정은 서버가 한다.**
   *
   * 예전에는 `c.user.id === me?.id` 로 프론트에서 비교했는데 비로그인 댓글에는 쓸 수 없다 —
   * 게스트의 소유는 작성자 토큰의 해시로만 가려지고, 프론트에는 평문 토큰만 있고 서버에는
   * 해시만 있어서 양쪽 어디서도 그 비교를 프론트가 대신할 수 없다.
   */
  is_mine: boolean;
  /** 내가 이미 신고한 댓글인지. 신고 버튼을 잠그는 데 쓴다. */
  reported_by_me: boolean;
  /** 누적 신고 수. 보는 사람과 무관하다. */
  report_count: number;
}

export interface LikeStatus {
  liked: boolean;
  like_count: number;
}

export type LikeTargetType = 'topster' | 'tournament' | 'album' | 'track' | 'artist' | 'comment';
