export type TournamentItemType = 'track' | 'album';

export interface TournamentUser {
  id: string;
  nickname: string;
}

/** 대시보드 카드용. 풀 전체 대신 개수와 미리보기 id만 온다. */
export interface TournamentSummary {
  id: string;
  title: string;
  description: string;
  item_type: TournamentItemType;
  item_count: number;
  play_count: number;
  /** 상세를 연 횟수. 플레이 수와 다르다 — 들어와 보기만 해도 오른다. */
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
  user: TournamentUser;
  preview_item_ids: string[];
}

export interface TournamentDetail {
  id: string;
  title: string;
  description: string;
  item_type: TournamentItemType;
  item_ids: string[];
  item_count: number;
  play_count: number;
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
  user: TournamentUser;
  /** 풀 크기 이하인 강수만 온다. 풀이 5개면 [4]. */
  available_sizes: number[];
}

export interface TournamentCreateBody {
  title: string;
  description: string;
  item_type: TournamentItemType;
  item_ids: string[];
}

/** 수정. 백엔드는 `item_type` 을 바꾸지 않는다 — 이미 치러진 플레이와 종류가 어긋나기 때문. */
export interface TournamentUpdateBody {
  title?: string;
  description?: string;
  item_ids?: string[];
}

export interface PlayRound {
  id: string;
  round_num: number;
  match_num: number;
  item_a_id: string;
  item_b_id: string;
  winner_id: string | null;
}

export interface Play {
  id: string;
  tournament_id: string;
  tournament_title: string;
  item_type: TournamentItemType;
  size: number;
  status: 'in_progress' | 'completed';
  winner_item_id: string | null;
  created_at: string;
  rounds: PlayRound[];
}

export interface TournamentRankingItem {
  rank: number;
  item_id: string;
  play_count: number;
  championship_count: number;
  championship_rate: number;
  match_count: number;
  match_win_count: number;
  match_win_rate: number;
  previous_rank: number | null;
  rank_delta: number | null;
}

export interface TournamentRanking {
  tournament_id: string;
  title: string;
  item_type: TournamentItemType;
  total_plays: number;
  trend_days: number;
  items: TournamentRankingItem[];
}

/** 대시보드 정렬 옵션. 백엔드 `sort` 파라미터와 1:1. */
export type TournamentSort = 'recent' | 'popular_all' | 'popular_year' | 'popular_month';
