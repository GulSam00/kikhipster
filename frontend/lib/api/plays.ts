import { apiFetch } from '@/lib/api/client';
import type { Play } from '@/types/tournament';

/** 진행 중인 판. 대진과 라운드별 승자가 서버에 있어 새로고침에도 남는다. */
export const getPlay = (playId: string) => apiFetch<Play>(`/api/plays/${playId}`);

export const voteRound = (playId: string, roundId: string, winnerId: string) =>
  apiFetch<Play>(`/api/plays/${playId}/rounds/${roundId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ winner_id: winnerId }),
  });
