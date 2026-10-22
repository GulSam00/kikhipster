import { getAlbumWithTracks } from '@/lib/api/music';
import type { PoolItem } from '@/lib/domain/pool-item';

import type { AlbumSummary, TrackItem, TrackSearchItem } from '@/types/music';
import type { QueueTrack } from '@/types/player';

/**
 * 화면마다 모양이 다른 "재생할 수 있는 것"을 재생 큐의 한 곡으로 정규화한다.
 *
 * `pool-item.ts` 와 같은 자리(domain)에 있는 이유도 같다 — 엔드포인트는 `lib/api` 가 알고,
 * 여기서는 **응답 모양을 맞추는 일만** 한다.
 *
 * 공통 규칙: **`preview_url` 이 없는 항목은 큐에 넣지 않는다.** 넣어 두면 자동 재생이
 * 그 자리에서 멈추는데, 화면에는 다음 곡이 이어질 것처럼 보인다.
 */

export function trackSearchItemToQueue(t: TrackSearchItem): QueueTrack | null {
  if (!t.preview_url) return null;
  return {
    id: t.id,
    name: t.name,
    artist: t.artists[0] ?? '',
    albumCover: t.album.cover_url,
    previewUrl: t.preview_url,
  };
}

/** 앨범 상세의 수록곡. 이 응답에는 커버가 없어서 앨범 커버를 물려준다. */
export function albumTrackToQueue(t: TrackItem, album: AlbumSummary): QueueTrack | null {
  if (!t.preview_url) return null;
  return {
    id: t.id,
    name: t.name,
    artist: t.artists[0] ?? album.artist_name,
    albumCover: album.cover_url,
    previewUrl: t.preview_url,
  };
}

/** 월드컵 후보(곡). 앨범 후보는 `previewUrl` 이 없으므로 여기서 걸러진다. */
export function poolItemToQueue(item: PoolItem): QueueTrack | null {
  if (!item.previewUrl) return null;
  return {
    id: item.id,
    name: item.title,
    artist: item.subtitle,
    albumCover: item.coverUrl,
    previewUrl: item.previewUrl,
  };
}

/**
 * 앨범 하나를 수록곡 전체로 펼친다. 앨범에는 미리듣기가 없으므로(앨범 단위 재생이라는 건
 * 결국 수록곡을 차례로 트는 것이다) 트랙 목록을 받아 와서 큐에 붙인다.
 *
 * 수록곡 조회는 백엔드가 30일 캐시하므로 같은 앨범을 여러 번 눌러도 iTunes 를 다시 치지 않는다.
 */
export async function albumQueueTracks(albumId: string): Promise<QueueTrack[]> {
  const { album, tracks } = await getAlbumWithTracks(albumId);
  return tracks.map((t) => albumTrackToQueue(t, album)).filter((t): t is QueueTrack => t !== null);
}
