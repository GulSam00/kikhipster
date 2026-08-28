import Link from 'next/link';
import { Disc3 } from 'lucide-react';
import CoverImage from '@/components/common/CoverImage';
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
          <CoverImage
            src={album.cover_url}
            alt={album.title}
            fallback={<Disc3 className="size-8" />}
            className="aspect-square w-full rounded-md"
          />
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
