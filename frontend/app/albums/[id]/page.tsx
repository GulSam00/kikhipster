import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Disc3 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import TrackRow from '@/components/music/TrackRow';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { AlbumWithTracks } from '@/types/music';

async function getAlbum(id: string): Promise<AlbumWithTracks | null> {
  try {
    return await apiFetch<AlbumWithTracks>(`/api/music/albums/${id}/tracks`);
  } catch {
    return null;
  }
}

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const album = await getAlbum(id);

  if (!album) notFound();

  const year = album.release_date?.slice(0, 4) ?? '';

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col items-start gap-6 sm:flex-row sm:items-end">
        <div className="relative size-36 shrink-0 overflow-hidden rounded-lg bg-muted">
          {album.cover_url ? (
            <Image src={album.cover_url} alt={album.name} fill className="object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <Disc3 className="size-10" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <Badge variant="outline" className="mb-2 capitalize">{album.album_type}</Badge>
          <h1 className="mb-1 font-heading text-3xl font-bold">{album.name}</h1>
          <p className="mb-1 text-foreground/80">{album.artist_name}</p>
          <p className="text-sm text-muted-foreground">
            {year} · {album.total_tracks}곡
          </p>
        </div>
      </div>

      <Separator className="mb-4" />

      <div className="flex flex-col">
        {album.tracks.map((t) => (
          <TrackRow
            key={t.id}
            track={t}
            artist={album.artist_name}
            albumCover={album.cover_url}
          />
        ))}
      </div>
    </div>
  );
}
