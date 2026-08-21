import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Mic2 } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import AlbumCard from '@/components/music/AlbumCard';
import TrackRow from '@/components/music/TrackRow';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { ArtistDetail, TrackItem } from '@/types/music';

async function getArtist(id: string): Promise<ArtistDetail | null> {
  try {
    return await apiFetch<ArtistDetail>(`/api/music/artists/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

async function getTopTracks(id: string): Promise<TrackItem[]> {
  try {
    return await apiFetch<TrackItem[]>(`/api/music/artists/${id}/top-tracks`);
  } catch {
    return [];
  }
}

export default async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [artist, topTracks] = await Promise.all([getArtist(id), getTopTracks(id)]);

  if (!artist) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col items-start gap-6 sm:flex-row sm:items-end">
        <div className="relative size-32 shrink-0 overflow-hidden rounded-full bg-muted">
          {artist.image_url ? (
            <Image src={artist.image_url} alt={artist.name} fill className="object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <Mic2 className="size-10" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="mb-1 text-xs text-muted-foreground">아티스트</p>
          <h1 className="mb-2 font-heading text-3xl font-bold">{artist.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {artist.genres.slice(0, 3).map((g) => (
              <Badge key={g} variant="secondary">{g}</Badge>
            ))}
          </div>
        </div>
      </div>

      <Separator className="mb-6" />

      {topTracks.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-heading text-lg font-bold">인기 트랙</h2>
          <div className="flex flex-col">
            {topTracks.map((t, i) => (
              <TrackRow
                key={t.id}
                track={{ ...t, track_number: i + 1 }}
                artist={artist.name}
                albumCover={artist.image_url}
              />
            ))}
          </div>
        </section>
      )}

      {artist.albums.length > 0 && (
        <section>
          <h2 className="mb-3 font-heading text-lg font-bold">앨범 · 싱글</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {artist.albums.map((a) => (
              <AlbumCard key={a.id} album={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
