import { Disc3, Music2, Pause, Play } from 'lucide-react';
import CoverImage from '@/components/common/CoverImage';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { PoolItem } from '@/lib/domain/pool-item';
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
}

/** 커버 없는 항목의 폴백 아이콘 — 곡이면 음표, 앨범이면 디스크. */
export function ItemFallbackIcon({ itemType, className }: { itemType: TournamentItemType; className?: string }) {
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
          <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
        </div>
      </CardContent>

      {onPlay && (
        /*
          한 화면에 타일이 수십 개라 primary 로 칠하지 않는다(DESIGN.md § Color budget 은
          한 화면 4개 초과를 BLOCK 으로 본다). 커버 위라 대비가 필요해 반투명 secondary.
          재생 중인 타일은 hover 여부와 무관하게 계속 보인다.
        */
        <Button
          variant="secondary"
          size="icon"
          className={cn(
            'absolute top-4 right-4 z-10 size-9 rounded-full bg-secondary/90 transition-opacity',
            playing
              ? 'opacity-100'
              : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100',
          )}
          onClick={onPlay}
          disabled={loading}
          aria-label={`${item.title} 재생`}
        >
          {loading ? <Spinner /> : playing ? <Pause /> : <Play />}
        </Button>
      )}
    </Card>
  );
}
