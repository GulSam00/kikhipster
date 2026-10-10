import { Disc3 } from 'lucide-react';
import Image from 'next/image';
import { notFound } from 'next/navigation';

import AlbumPlayButton from '@/components/music/AlbumPlayButton';
import AlbumTypeBadge from '@/components/music/AlbumTypeBadge';
import TrackRow from '@/components/music/TrackRow';
import LikeButton from '@/components/social/LikeButton';
import { Separator } from '@/components/ui/separator';

import { ApiError } from '@/lib/api/client';
import { getAlbumWithTracks } from '@/lib/api/music';
import { albumTrackToQueue } from '@/lib/domain/playable';

import type { AlbumWithTracks } from '@/types/music';
import type { QueueTrack } from '@/types/player';

async function getAlbum(id: string): Promise<AlbumWithTracks | null> {
  try {
    return await getAlbumWithTracks(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getAlbum(id);

  if (!data) notFound();

  // 응답은 { album, tracks } 로 중첩돼 있다. 예전엔 평평하다고 가정해
  // 헤더의 제목·커버·아티스트가 전부 undefined 로 비어 있었다.
  const { album, tracks } = data;
  const year = album.release_date?.slice(0, 4) ?? '';
  // 수록곡이 이미 여기 있으므로 재생 버튼이 같은 요청을 다시 하지 않게 넘겨 준다.
  const queue = tracks
    .map((t) => albumTrackToQueue(t, album))
    .filter((t): t is QueueTrack => t !== null);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col items-start gap-6 sm:flex-row sm:items-end">
        <div className="bg-muted relative size-36 shrink-0 overflow-hidden rounded-lg">
          {album.cover_url ? (
            <Image src={album.cover_url} alt={album.title} fill className="object-cover" />
          ) : (
            <div className="text-muted-foreground flex size-full items-center justify-center">
              <Disc3 className="size-10" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <AlbumTypeBadge type={album.album_type} className="mb-2" />
          <h1 className="font-heading mb-1 text-3xl font-bold">{album.title}</h1>
          <p className="text-foreground/80 mb-1">{album.artist_name}</p>
          <p className="text-muted-foreground mb-3 text-sm">
            {year} · {album.total_tracks}곡
          </p>
          <div className="flex items-center gap-2">
            {queue.length > 0 && (
              <AlbumPlayButton
                albumId={album.id}
                albumTitle={album.title}
                tracks={queue}
                label="전체 재생"
              />
            )}
            <LikeButton targetType="album" targetId={album.id} name={album.title} />
          </div>
        </div>
      </div>

      <Separator className="mb-4" />

      <div className="flex flex-col">
        {tracks.map((t) => (
          <TrackRow
            key={t.id}
            track={{ ...t, explicit: false }}
            artist={t.artists[0] ?? album.artist_name}
            albumCover={album.cover_url}
          />
        ))}
      </div>
    </div>
  );
}
