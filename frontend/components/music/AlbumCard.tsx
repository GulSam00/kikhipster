import { Disc3 } from 'lucide-react';
import Link from 'next/link';

import CoverImage from '@/components/common/CoverImage';
import AlbumPlayButton from '@/components/music/AlbumPlayButton';
import AlbumTypeBadge from '@/components/music/AlbumTypeBadge';
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
    /*
      `size="sm"`(--card-spacing 12px) 대신 기본값(16px)을 쓰고 `gap-2` 로 덮지 않는다 —
      패딩과 세로 간격이 모두 `--card-spacing` 하나에서 나오므로 이 한 곳만 바꾸면
      카드 안이 고르게 넓어진다. 열 수를 줄여 카드 자체가 커진 것과 짝이다.
    */
    <Card className="group hover:bg-accent relative h-full transition-colors">
      <CardContent className="flex flex-col gap-3">
        <CoverImage
          src={album.cover_url}
          alt={album.title}
          fallback={<Disc3 className="size-8" />}
          className="aspect-square w-full rounded-md"
          sizes="(min-width: 1024px) 16vw, (min-width: 640px) 25vw, 45vw"
        />
        <div className="min-w-0">
          {/*
            배지를 제목 **아래** 메타 줄에 둔다. 제목 옆에 붙이면 모바일 2열(카드 폭 150px
            남짓)에서 제목이 배지에 밀려 두세 글자만 남는다 — 종류보다 제목이 먼저다.
          */}
          <p className="truncate text-sm font-medium">{album.title}</p>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">{album.artist_name}</p>
          <div className="mt-2 flex items-center gap-1.5">
            <AlbumTypeBadge type={album.album_type} />
            <p className="text-muted-foreground truncate text-xs">
              {year} · {album.total_tracks}곡
            </p>
          </div>
        </div>
      </CardContent>

      <Link
        href={`/albums/${album.id}`}
        aria-label={album.title}
        className="focus-visible:ring-ring/50 absolute inset-0 rounded-xl outline-none focus-visible:ring-3"
      />

      {/*
        마우스가 없는 기기에서는 hover 가 없으므로 항상 보인다. 데스크톱에서만 hover·
        포커스로 나타나게 해서 커버를 가리지 않는다.
      */}
      <AlbumPlayButton
        albumId={album.id}
        albumTitle={album.title}
        variant="secondary"
        className="bg-secondary/90 absolute top-4 right-4 z-10 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
      />
    </Card>
  );
}
