import Link from 'next/link';
import { Disc3 } from 'lucide-react';
import AlbumPlayButton from '@/components/music/AlbumPlayButton';
import CoverImage from '@/components/common/CoverImage';
import { Card, CardContent } from '@/components/ui/card';
import type { AlbumSummary } from '@/types/music';

interface Props {
  album: AlbumSummary;
}

export default function AlbumCard({ album }: Props) {
  const year = album.release_date?.slice(0, 4) ?? '';

  return (
    /*
      카드를 `<Link>` 로 감싸는 대신 **링크를 카드 위에 덮는다**. 재생 버튼이 카드 안에
      들어오면서 링크 안에 버튼이 놓이는 모양이 되는데, 그건 무효 마크업이고 브라우저마다
      클릭 처리도 다르다. 링크를 형제로 두고 `absolute inset-0` 으로 덮으면 카드 전체가
      여전히 클릭 대상이면서 버튼은 그 위(z-10)에 남는다.
    */
    <Card size="sm" className="group relative h-full gap-2 transition-colors hover:bg-accent">
      <CardContent className="flex flex-col gap-2">
        <CoverImage
          src={album.cover_url}
          alt={album.title}
          fallback={<Disc3 className="size-8" />}
          className="aspect-square w-full rounded-md"
          sizes="(min-width: 1024px) 16vw, (min-width: 640px) 25vw, 45vw"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{album.title}</p>
          <p className="truncate text-xs text-muted-foreground">{album.artist_name}</p>
          <p className="text-xs text-muted-foreground">
            {year} · {album.total_tracks}곡
          </p>
        </div>
      </CardContent>

      <Link
        href={`/albums/${album.id}`}
        aria-label={album.title}
        className="absolute inset-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />

      {/*
        마우스가 없는 기기에서는 hover 가 없으므로 항상 보인다. 데스크톱에서만 hover·
        포커스로 나타나게 해서 커버를 가리지 않는다.
      */}
      <AlbumPlayButton
        albumId={album.id}
        albumTitle={album.title}
        variant="secondary"
        className="absolute top-4 right-4 z-10 bg-secondary/90 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
      />
    </Card>
  );
}
