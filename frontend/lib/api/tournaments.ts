import { apiFetch } from '@/lib/api/client';
import type {
  Play,
  TournamentCreateBody,
  TournamentDetail,
  TournamentRanking,
  TournamentSort,
  TournamentSummary,
  TournamentUpdateBody,
} from '@/types/tournament';

/** 월드컵 엔드포인트. `/api/tournaments` 문자열은 이 파일에만 있다. */
const BASE = '/api/tournaments';

import type { PageParams } from '@/lib/api/topsters';

export const tournamentListPath = (
  { limit, offset }: PageParams,
  filter: { q?: string; sort?: TournamentSort } = {},
) => {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (filter.sort) params.set('sort', filter.sort);
  if (filter.q) params.set('q', filter.q);
  return `${BASE}/?${params}`;
};

export const myTournamentsPath = ({ limit, offset }: PageParams) =>
  `${BASE}/me/list?limit=${limit}&offset=${offset}`;

export const userTournamentsPath = (userId: string, { limit, offset }: PageParams) =>
  `${BASE}/user/${userId}?limit=${limit}&offset=${offset}`;
export const tournamentPath = (id: string) => `${BASE}/${id}`;

export const listTournaments = (sort: TournamentSort, limit: number, offset = 0) =>
  apiFetch<TournamentSummary[]>(`${BASE}/?sort=${sort}&limit=${limit}&offset=${offset}`);

export const getTournament = (id: string) => apiFetch<TournamentDetail>(`${BASE}/${id}`);

export const createTournament = (body: TournamentCreateBody) =>
  apiFetch<TournamentDetail>(`${BASE}/`, { method: 'POST', body: JSON.stringify(body) });

export const updateTournament = (id: string, body: TournamentUpdateBody) =>
  apiFetch<TournamentDetail>(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(body) });

export const getRanking = (id: string) => apiFetch<TournamentRanking>(`${BASE}/${id}/ranking`);

/** 풀에서 `size` 개를 무작위로 뽑아 새 판을 만든다. 비로그인도 된다. */
export const createPlay = (id: string, size: number) =>
  apiFetch<Play>(`${BASE}/${id}/plays`, { method: 'POST', body: JSON.stringify({ size }) });

export const markTournamentViewed = (id: string) =>
  apiFetch<void>(`${BASE}/${id}/view`, { method: 'POST' });
