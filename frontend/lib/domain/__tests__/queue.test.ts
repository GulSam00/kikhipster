import { describe, expect, it } from 'vitest';

import { albumTrackToQueue, poolItemToQueue, trackSearchItemToQueue } from '@/lib/domain/playable';
import { albumToPoolItem, trackToPoolItem } from '@/lib/domain/pool-item';

import type { AlbumSummary, TrackItem, TrackSearchItem } from '@/types/music';

const album: AlbumSummary = {
  id: '10',
  title: 'OK Computer',
  artist_name: 'Radiohead',
  cover_url: 'cover.jpg',
  release_date: '1997-05-21',
  total_tracks: 12,
  album_type: 'album',
};

const track = (preview: string | null): TrackSearchItem =>
  ({
    id: '1',
    name: 'Karma Police',
    duration_ms: 1000,
    preview_url: preview,
    explicit: false,
    artists: ['Radiohead'],
    album: { id: '10', title: 'OK Computer', cover_url: 'cover.jpg' },
  }) as unknown as TrackSearchItem;

describe('미리듣기가 없는 항목은 큐에 넣지 않는다', () => {
  it('검색 곡', () => {
    expect(trackSearchItemToQueue(track(null))).toBeNull();
    expect(trackSearchItemToQueue(track('p.m4a'))?.previewUrl).toBe('p.m4a');
  });

  it('앨범 수록곡은 앨범 커버를 물려받는다', () => {
    const t = { id: '2', name: 'x', artists: [], preview_url: 'p.m4a' } as unknown as TrackItem;
    expect(albumTrackToQueue(t, album)).toMatchObject({
      albumCover: 'cover.jpg',
      artist: 'Radiohead', // 곡에 아티스트가 없으면 앨범의 것
    });
    expect(albumTrackToQueue({ ...t, preview_url: null }, album)).toBeNull();
  });

  it('월드컵 후보: 곡은 들어가고 앨범은 걸러진다', () => {
    expect(poolItemToQueue(trackToPoolItem(track('p.m4a')))?.name).toBe('Karma Police');
    expect(poolItemToQueue(albumToPoolItem(album))).toBeNull();
  });
});

describe('PoolItem 정규화', () => {
  it('곡과 앨범이 같은 모양(제목·부제·커버)이 된다', () => {
    expect(trackToPoolItem(track('p'))).toMatchObject({
      title: 'Karma Police',
      subtitle: 'Radiohead',
      coverUrl: 'cover.jpg',
    });
    expect(albumToPoolItem(album)).toMatchObject({
      title: 'OK Computer',
      subtitle: 'Radiohead',
      coverUrl: 'cover.jpg',
    });
  });
});
