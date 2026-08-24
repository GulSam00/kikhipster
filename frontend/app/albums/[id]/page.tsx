import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Disc3 } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import TrackRow from '@/components/music/TrackRow';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { AlbumWithTracks } from '@/types/music';

async function getAlbum(id: string): Promise<AlbumWithTracks | null> {
  try {
    return await apiFetch<AlbumWithTracks>(`/api/music/albums/${id}/tracks`);
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

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col items-start gap-6 sm:flex-row sm:items-end">
        <div className="relative size-36 shrink-0 overflow-hidden rounded-lg bg-muted">
          {album.cover_url ? (
            <Image src={album.cover_url} alt={album.title} fill className="object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <Disc3 className="size-10" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <Badge variant="outline" className="mb-2 capitalize">{album.album_type}</Badge>
          <h1 className="mb-1 font-heading text-3xl font-bold">{album.title}</h1>
          <p className="mb-1 text-foreground/80">{album.artist_name}</p>
          <p className="text-sm text-muted-foreground">
            {year} · {album.total_tracks}곡
          </p>
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
