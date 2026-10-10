import { Mic2 } from 'lucide-react';
import Link from 'next/link';

import CoverImage from '@/components/common/CoverImage';
import { Card, CardContent } from '@/components/ui/card';

import type { ArtistSummary } from '@/types/music';

interface Props {
  artist: ArtistSummary;
}

export default function ArtistCard({ artist }: Props) {
  return (
    <Link href={`/artists/${artist.id}`} className="group block">
      {/* 여백 기준은 AlbumCard 와 같다 — 검색에서 두 카드가 같은 자리에 교체 렌더된다. */}
      <Card className="group-hover:bg-accent h-full transition-colors">
        <CardContent className="flex flex-col items-center gap-3">
          <CoverImage
            src={artist.image_url}
            alt={artist.name}
            fallback={<Mic2 className="size-8" />}
            className="aspect-square w-full rounded-full"
          />
          <div className="w-full min-w-0 text-center">
            <p className="truncate text-sm font-medium">{artist.name}</p>
            {artist.genres[0] && (
              <p className="text-muted-foreground mt-0.5 truncate text-xs">{artist.genres[0]}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
