import { apiFetch } from '@/lib/api/client';

import type { Topster, TopsterCreateBody, TopsterSort, TopsterUpdateBody } from '@/types/topster';

/**
 * 탑스터 엔드포인트. **`/api/topsters` 문자열은 이 파일에만 있다.**
 *
 * 뽑아내기 전에는 같은 경로가 일곱 군데에 흩어져 있어서, 주소가 바뀌면 grep 으로 찾아야 했다.
 *
 * 목록류는 함수가 아니라 **경로 빌더**를 내보낸다 — `useInfiniteList` 가 경로 문자열을 받아
 * offset 을 붙여가며 부르는 구조라, 여기서 데이터를 반환해 버리면 그 훅을 못 쓴다.
 */
const BASE = '/api/topsters';

/** `useInfiniteList` 가 `{ limit, offset }` 을 주고 경로를 받아 간다. */
export interface PageParams {
  limit: number;
  offset: number;
}

export const topsterListPath = (
  { limit, offset }: PageParams,
  filter: { q?: string; sort?: TopsterSort } = {},
) => {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (filter.sort) params.set('sort', filter.sort);
  if (filter.q) params.set('q', filter.q);
  return `${BASE}/?${params}`;
};

export const myTopstersPath = ({ limit, offset }: PageParams) =>
  `${BASE}/me/list?limit=${limit}&offset=${offset}`;

export const userTopstersPath = (userId: string, { limit, offset }: PageParams) =>
  `${BASE}/user/${userId}?limit=${limit}&offset=${offset}`;
export const topsterPath = (id: string) => `${BASE}/${id}`;

export const listTopsters = (limit: number, offset = 0) =>
  apiFetch<Topster[]>(`${BASE}/?limit=${limit}&offset=${offset}`);

export const getTopster = (id: string) => apiFetch<Topster>(`${BASE}/${id}`);

export const createTopster = (body: TopsterCreateBody) =>
  apiFetch<Topster>(`${BASE}/`, { method: 'POST', body: JSON.stringify(body) });

export const updateTopster = (id: string, body: TopsterUpdateBody) =>
  apiFetch<Topster>(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(body) });

/** 상세를 열어 본 것을 기록한다. 상세 GET 이 아니라 이 경로에서만 조회수가 오른다. */
export const markTopsterViewed = (id: string) =>
  apiFetch<void>(`${BASE}/${id}/view`, { method: 'POST' });
