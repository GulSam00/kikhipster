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
  user: CommentUser;
}

export interface LikeStatus {
  liked: boolean;
  like_count: number;
}

export type LikeTargetType = 'topster' | 'album' | 'track' | 'artist' | 'comment';
