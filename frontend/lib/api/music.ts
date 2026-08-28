import { apiFetch } from '@/lib/api/client';
import type {
  AlbumSummary,
  AlbumWithTracks,
  ArtistDetail,
  ArtistSummary,
  TrackSearchItem,
} from '@/types/music';

/**
 * iTunes 를 감싸는 백엔드 음악 엔드포인트. `/api/music` 문자열은 이 파일에만 있다.
 *
 * 검색 응답이 `{ items: [...] }` 로 한 겹 싸여 있는 것도 여기서 벗겨 준다 —
 * 호출부가 매번 `res.items` 를 꺼내던 것을 없앴다.
 */
const BASE = '/api/music';

const SEARCH_LIMIT = 20;

export const searchArtists = (q: string, limit = SEARCH_LIMIT) =>
  apiFetch<{ items: ArtistSummary[] }>(
    `${BASE}/search/artists?q=${encodeURIComponent(q)}&limit=${limit}`,
  ).then((r) => r.items);

export const searchAlbums = (q: string, limit = SEARCH_LIMIT) =>
  apiFetch<{ items: AlbumSummary[] }>(
    `${BASE}/search/albums?q=${encodeURIComponent(q)}&limit=${limit}`,
  ).then((r) => r.items);

export const searchTracks = (q: string, limit = SEARCH_LIMIT) =>
  apiFetch<{ items: TrackSearchItem[] }>(
    `${BASE}/search/tracks?q=${encodeURIComponent(q)}&limit=${limit}`,
  ).then((r) => r.items);

export const getArtist = (id: string) => apiFetch<ArtistDetail>(`${BASE}/artists/${id}`);

export const getArtistTopTracks = (id: string) =>
  apiFetch<TrackSearchItem[]>(`${BASE}/artists/${id}/top-tracks`);

export const getArtistAlbums = (id: string) =>
  apiFetch<AlbumSummary[]>(`${BASE}/artists/${id}/albums`);

export const getAlbumWithTracks = (id: string) =>
  apiFetch<AlbumWithTracks>(`${BASE}/albums/${id}/tracks`);

/**
 * ID 배치 조회. 백엔드가 150개씩 청크로 쪼개 iTunes 를 부르므로 한 번에 넘겨도 되지만,
 * URL 길이 때문에 512개를 넘기지는 않는다(백엔드도 512에서 400을 준다).
 */
export const getTracksByIds = (ids: string[]) =>
  apiFetch<TrackSearchItem[]>(`${BASE}/tracks?ids=${ids.join(',')}`);

export const getAlbumsByIds = (ids: string[]) =>
  apiFetch<AlbumSummary[]>(`${BASE}/albums?ids=${ids.join(',')}`);
