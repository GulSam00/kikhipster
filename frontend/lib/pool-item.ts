import { apiFetch } from '@/lib/api';
import type { AlbumSummary, TrackSearchItem } from '@/types/music';
import type { TournamentItemType } from '@/types/tournament';

/**
 * 곡과 앨범을 같은 모양으로 다루기 위한 정규화 타입.
 * 월드컵은 풀·대진·랭킹 어디서든 "커버 + 제목 + 부제"만 있으면 되는데,
 * 곡(TrackSearchItem)과 앨범(AlbumSummary)은 필드 이름이 전혀 다르다.
 */
export interface PoolItem {
  id: string;
  title: string;
  subtitle: string;
  coverUrl: string | null;
  /** 앨범에는 없다. 곡일 때만 채워진다. */
  previewUrl?: string | null;
  durationMs?: number;
  explicit?: boolean;
}

export function trackToPoolItem(t: TrackSearchItem): PoolItem {
  return {
    id: t.id,
    title: t.name,
    subtitle: t.artists[0] ?? '',
    coverUrl: t.album.cover_url,
    previewUrl: t.preview_url,
    durationMs: t.duration_ms,
    explicit: t.explicit,
  };
}

export function albumToPoolItem(a: AlbumSummary): PoolItem {
  return {
    id: a.id,
    title: a.title,
    subtitle: a.artist_name,
    coverUrl: a.cover_url,
  };
}

/**
 * item_id 목록을 PoolItem 목록으로 채운다.
 *
 * 백엔드가 150개씩 청크로 쪼개 iTunes를 부르므로 여기서는 한 번에 넘겨도 된다.
 * 다만 URL 길이 때문에 512개를 넘기지는 않는다(백엔드도 512에서 400을 준다).
 */
export async function fetchPoolItems(
  itemType: TournamentItemType,
  ids: string[],
): Promise<PoolItem[]> {
  if (ids.length === 0) return [];

  const query = `ids=${ids.join(',')}`;
  if (itemType === 'track') {
    const items = await apiFetch<TrackSearchItem[]>(`/api/music/tracks?${query}`);
    return items.map(trackToPoolItem);
  }
  const items = await apiFetch<AlbumSummary[]>(`/api/music/albums?${query}`);
  return items.map(albumToPoolItem);
}

export const ITEM_TYPE_LABEL: Record<TournamentItemType, string> = {
  track: '곡',
  album: '앨범',
};
