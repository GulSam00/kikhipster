export interface TournamentRound {
  id: string;
  round_num: number;
  match_num: number;
  track_a_id: string;
  track_b_id: string;
  winner_id: string | null;
}

export interface Tournament {
  id: string;
  size: number;
  status: 'in_progress' | 'completed';
  winner_track_id: string | null;
  created_at: string;
  rounds: TournamentRound[];
}

export interface TournamentCreateBody {
  track_ids: string[];
}

export interface TournamentVoteBody {
  winner_id: string;
}
