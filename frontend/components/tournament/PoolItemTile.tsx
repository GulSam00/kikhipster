import { Disc3, Music2, Pause, Play } from 'lucide-react';
import Link from 'next/link';

import CoverImage from '@/components/common/CoverImage';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

import type { PoolItem } from '@/lib/domain/pool-item';
import { cn } from '@/lib/utils';

import type { TournamentItemType } from '@/types/tournament';

interface Props {
  item: PoolItem;
  itemType: TournamentItemType;
  className?: string;
  /**
   * 주면 커버 위에 재생 버튼이 얹힌다.
   *
   * **편집기의 '담긴 목록'에서는 주지 않는다** — 거기서는 타일 전체가 `<button>`(빼기)이라
   * 버튼 안에 버튼이 들어가는 무효 마크업이 된다.
   */
  onPlay?: () => void;
  /** 재생 중인 항목인지. 곡 후보에서만 의미가 있다. */
  playing?: boolean;
  /** 앨범 수록곡을 받아 오는 중. */
  loading?: boolean;
  /**
   * 주면 재생 버튼 옆에 앨범으로 가는 버튼이 함께 붙는다(앨범 후보의 `/albums/{id}`).
   *
   * 타일 전체를 링크로 덮지 않는 이유: 후보 그리드는 지금까지 아무 데도 가지 않던
   * 타일이라 보이지 않는 전체 링크가 놀라움이 되고, 편집기의 '담긴 목록' 타일은
   * 그 자체가 `<button>`(빼기)이라 같은 컴포넌트에 링크를 깔 수 없다.
   */
  href?: string;
}

/** 커버 없는 항목의 폴백 아이콘 — 곡이면 음표, 앨범이면 디스크. */
export function ItemFallbackIcon({
  itemType,
  className,
}: {
  itemType: TournamentItemType;
  className?: string;
}) {
  const Icon = itemType === 'album' ? Disc3 : Music2;
  return <Icon className={className} />;
}

/** 풀 목록·참가 목록에 쓰는 정사각 타일. 곡·앨범 공용. */
export default function PoolItemTile({
  item,
  itemType,
  className,
  onPlay,
  playing,
  loading,
  href,
}: Props) {
  return (
    <Card size="sm" className={cn('group relative h-full gap-2', className)}>
      <CardContent className="flex flex-col gap-2">
        <CoverImage
          src={item.coverUrl}
          alt={item.title}
          fallback={<ItemFallbackIcon itemType={itemType} className="size-6" />}
          className="aspect-square rounded-md"
          sizes="(min-width: 1024px) 16vw, (min-width: 640px) 25vw, 45vw"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.title}</p>
          <p className="text-muted-foreground truncate text-xs">{item.subtitle}</p>
        </div>
      </CardContent>

      {(onPlay || href) && (
        /*
          한 화면에 타일이 수십 개라 primary 로 칠하지 않는다(DESIGN.md § Color budget 은
          한 화면 4개 초과를 BLOCK 으로 본다). 커버 위라 대비가 필요해 반투명 secondary.
          hover 가 없는 모바일에서는 늘 보여야 하므로 데스크톱에서만 hover 로 나타난다.
          재생 중인 타일은 hover 여부와 무관하게 계속 보인다.
        */
        <div
          className={cn(
            'absolute top-4 right-4 z-10 flex gap-1 transition-opacity',
            playing
              ? 'opacity-100'
              : 'opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100',
          )}
        >
          {href && (
            <Button
              variant="secondary"
              size="icon"
              className="bg-secondary/90 size-9 rounded-full"
              asChild
            >
              <Link href={href} aria-label={`${item.title} 앨범 보기`}>
                <Disc3 />
              </Link>
            </Button>
          )}
          {onPlay && (
            <Button
              variant="secondary"
              size="icon"
              className="bg-secondary/90 size-9 rounded-full"
              onClick={onPlay}
              disabled={loading}
              aria-label={`${item.title} 재생`}
            >
              {loading ? <Spinner /> : playing ? <Pause /> : <Play />}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
