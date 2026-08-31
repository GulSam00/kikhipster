import { apiFetch } from '@/lib/api/client';
import { stripAlbumSuffix } from '@/lib/domain/album-title';
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
 *
 * **앨범 제목의 ` - Single` / ` - EP` 꼬리도 여기서 뗀다.** 이 파일이 앨범 데이터가
 * 프론트로 들어오는 유일한 문이라, 여기 한 곳만 거치면 검색·아티스트 상세·앨범 상세는
 * 물론 탑스터 격자와 PNG, 월드컵 후보·대결·랭킹까지 전부 정리된 제목을 받는다.
 * 화면마다 떼면 반드시 빠뜨리는 곳이 생긴다.
 */
const BASE = '/api/music';

const SEARCH_LIMIT = 20;

/** 앨범 응답 하나의 제목을 정리한다. `album_type` 은 백엔드가 원문으로 판정하므로 그대로 둔다. */
const cleanAlbum = <T extends { title: string }>(a: T): T => ({
  ...a,
  title: stripAlbumSuffix(a.title),
});

/** 곡 응답이 물고 있는 앨범 이름(`album.name`)에도 같은 꼬리가 붙는다. */
const cleanTrack = (t: TrackSearchItem): TrackSearchItem => ({
  ...t,
  album: { ...t.album, name: stripAlbumSuffix(t.album.name) },
});

export const searchArtists = (q: string, limit = SEARCH_LIMIT) =>
  apiFetch<{ items: ArtistSummary[] }>(
    `${BASE}/search/artists?q=${encodeURIComponent(q)}&limit=${limit}`,
  ).then((r) => r.items);

export const searchAlbums = (q: string, limit = SEARCH_LIMIT) =>
  apiFetch<{ items: AlbumSummary[] }>(
    `${BASE}/search/albums?q=${encodeURIComponent(q)}&limit=${limit}`,
  ).then((r) => r.items.map(cleanAlbum));

export const searchTracks = (q: string, limit = SEARCH_LIMIT) =>
  apiFetch<{ items: TrackSearchItem[] }>(
    `${BASE}/search/tracks?q=${encodeURIComponent(q)}&limit=${limit}`,
  ).then((r) => r.items.map(cleanTrack));

export const getArtist = (id: string) => apiFetch<ArtistDetail>(`${BASE}/artists/${id}`);

export const getArtistTopTracks = (id: string) =>
  apiFetch<TrackSearchItem[]>(`${BASE}/artists/${id}/top-tracks`).then((r) => r.map(cleanTrack));

export const getArtistAlbums = (id: string) =>
  apiFetch<AlbumSummary[]>(`${BASE}/artists/${id}/albums`).then((r) => r.map(cleanAlbum));

export const getAlbumWithTracks = (id: string) =>
  apiFetch<AlbumWithTracks>(`${BASE}/albums/${id}/tracks`).then((r) => ({
    ...r,
    album: cleanAlbum(r.album),
  }));

/**
 * ID 배치 조회. 백엔드가 150개씩 청크로 쪼개 iTunes 를 부르므로 한 번에 넘겨도 되지만,
 * URL 길이 때문에 512개를 넘기지는 않는다(백엔드도 512에서 400을 준다).
 */
export const getTracksByIds = (ids: string[]) =>
  apiFetch<TrackSearchItem[]>(`${BASE}/tracks?ids=${ids.join(',')}`).then((r) => r.map(cleanTrack));

export const getAlbumsByIds = (ids: string[]) =>
  apiFetch<AlbumSummary[]>(`${BASE}/albums?ids=${ids.join(',')}`).then((r) => r.map(cleanAlbum));
