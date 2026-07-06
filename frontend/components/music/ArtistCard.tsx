import Image from 'next/image';
import Link from 'next/link';
import type { ArtistSummary } from '@/types/music';

interface Props {
  artist: ArtistSummary;
}

export default function ArtistCard({ artist }: Props) {
  return (
    <Link
      href={`/artists/${artist.id}`}
      className="group flex flex-col items-center gap-2 p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 transition-colors"
    >
      <div className="relative w-full aspect-square rounded-full overflow-hidden bg-zinc-700">
        {artist.image_url ? (
          <Image src={artist.image_url} alt={artist.name} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl text-zinc-500">♪</div>
        )}
      </div>
      <div className="text-center w-full">
        <p className="text-sm font-medium text-white truncate">{artist.name}</p>
        {artist.genres[0] && (
          <p className="text-xs text-zinc-400 truncate">{artist.genres[0]}</p>
        )}
        <p className="text-xs text-zinc-500">{artist.followers.toLocaleString()} 팔로워</p>
      </div>
    </Link>
  );
}
