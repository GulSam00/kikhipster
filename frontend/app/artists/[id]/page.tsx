import Image from 'next/image';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import AlbumCard from '@/components/music/AlbumCard';
import TrackRow from '@/components/music/TrackRow';
import type { ArtistDetail, TrackItem } from '@/types/music';

async function getArtist(id: string): Promise<ArtistDetail | null> {
  try {
    return await apiFetch<ArtistDetail>(`/api/music/artists/${id}`);
  } catch {
    return null;
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
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-end gap-6 mb-8">
        <div className="relative w-32 h-32 rounded-full overflow-hidden bg-zinc-800 shrink-0">
          {artist.image_url ? (
            <Image src={artist.image_url} alt={artist.name} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl text-zinc-500">♪</div>
          )}
        </div>
        <div>
          <p className="text-xs text-zinc-400 mb-1">아티스트</p>
          <h1 className="text-3xl font-bold text-white mb-2">{artist.name}</h1>
          <div className="flex flex-wrap gap-2 text-sm text-zinc-400">
            {artist.genres.slice(0, 3).map((g) => (
              <span key={g} className="px-2 py-0.5 rounded-full bg-zinc-800">{g}</span>
            ))}
            <span>{artist.followers.toLocaleString()} 팔로워</span>
          </div>
        </div>
      </div>

      {topTracks.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-white mb-3">인기 트랙</h2>
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
          <h2 className="text-lg font-bold text-white mb-3">앨범 · 싱글</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {artist.albums.map((a) => (
              <AlbumCard key={a.id} album={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
