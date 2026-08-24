import Image from 'next/image';
import Link from 'next/link';
import { Disc3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { AlbumSummary } from '@/types/music';

interface Props {
  album: AlbumSummary;
}

export default function AlbumCard({ album }: Props) {
  const year = album.release_date?.slice(0, 4) ?? '';

  return (
    <Link href={`/albums/${album.id}`} className="group block">
      <Card size="sm" className="h-full gap-2 transition-colors group-hover:bg-accent">
        <CardContent className="flex flex-col gap-2">
          <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
            {album.cover_url ? (
              <Image src={album.cover_url} alt={album.title} fill className="object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <Disc3 className="size-8" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{album.title}</p>
            <p className="truncate text-xs text-muted-foreground">{album.artist_name}</p>
            <p className="text-xs text-muted-foreground">
              {year} · {album.total_tracks}곡
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
