import Image from 'next/image';
import Link from 'next/link';
import type { AlbumSummary } from '@/types/music';

interface Props {
  album: AlbumSummary;
}

export default function AlbumCard({ album }: Props) {
  const year = album.release_date?.slice(0, 4) ?? '';

  return (
    <Link
      href={`/albums/${album.id}`}
      className="group flex flex-col gap-2 p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 transition-colors"
    >
      <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-zinc-700">
        {album.cover_url ? (
          <Image src={album.cover_url} alt={album.name} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl text-zinc-500">♫</div>
        )}
      </div>
      <div className="w-full">
        <p className="text-sm font-medium text-white truncate">{album.name}</p>
        <p className="text-xs text-zinc-400 truncate">{album.artist_name}</p>
        <p className="text-xs text-zinc-500">{year} · {album.total_tracks}곡</p>
      </div>
    </Link>
  );
}
