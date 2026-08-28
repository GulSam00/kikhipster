import Link from 'next/link';
import { Mic2 } from 'lucide-react';
import CoverImage from '@/components/common/CoverImage';
import { Card, CardContent } from '@/components/ui/card';
import type { ArtistSummary } from '@/types/music';

interface Props {
  artist: ArtistSummary;
}

export default function ArtistCard({ artist }: Props) {
  return (
    <Link href={`/artists/${artist.id}`} className="group block">
      <Card size="sm" className="h-full gap-2 transition-colors group-hover:bg-accent">
        <CardContent className="flex flex-col items-center gap-2">
          <CoverImage
            src={artist.image_url}
            alt={artist.name}
            fallback={<Mic2 className="size-8" />}
            className="aspect-square w-full rounded-full"
          />
          <div className="w-full min-w-0 text-center">
            <p className="truncate text-sm font-medium">{artist.name}</p>
            {artist.genres[0] && (
              <p className="truncate text-xs text-muted-foreground">{artist.genres[0]}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
