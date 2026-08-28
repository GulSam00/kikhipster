import { getAlbumsByIds, getTracksByIds } from '@/lib/api/music';
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
 * 엔드포인트는 `lib/api/music` 이 알고, 여기서는 **곡/앨범 응답을 같은 모양으로
 * 정규화하는 일**만 한다 — 이 파일이 `domain` 에 있는 이유다.
 */
export async function fetchPoolItems(
  itemType: TournamentItemType,
  ids: string[],
): Promise<PoolItem[]> {
  if (ids.length === 0) return [];
  if (itemType === 'track') {
    return (await getTracksByIds(ids)).map(trackToPoolItem);
  }
  return (await getAlbumsByIds(ids)).map(albumToPoolItem);
}

export const ITEM_TYPE_LABEL: Record<TournamentItemType, string> = {
  track: '곡',
  album: '앨범',
};
