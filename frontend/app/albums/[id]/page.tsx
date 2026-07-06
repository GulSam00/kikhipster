import Image from 'next/image';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import TrackRow from '@/components/music/TrackRow';
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
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-end gap-6 mb-8">
        <div className="relative w-36 h-36 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
          {album.cover_url ? (
            <Image src={album.cover_url} alt={album.name} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl text-zinc-500">♫</div>
          )}
        </div>
        <div>
          <p className="text-xs text-zinc-400 mb-1 capitalize">{album.album_type}</p>
          <h1 className="text-3xl font-bold text-white mb-1">{album.name}</h1>
          <p className="text-zinc-300 mb-1">{album.artist_name}</p>
          <p className="text-sm text-zinc-500">{year} · {album.total_tracks}곡</p>
        </div>
      </div>

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
