import { Disc3, Music2 } from 'lucide-react';
import CoverImage from '@/components/common/CoverImage';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PoolItem } from '@/lib/domain/pool-item';
import type { TournamentItemType } from '@/types/tournament';

interface Props {
  item: PoolItem;
  itemType: TournamentItemType;
  className?: string;
}

/** 커버 없는 항목의 폴백 아이콘 — 곡이면 음표, 앨범이면 디스크. */
export function ItemFallbackIcon({ itemType, className }: { itemType: TournamentItemType; className?: string }) {
  const Icon = itemType === 'album' ? Disc3 : Music2;
  return <Icon className={className} />;
}

/** 풀 목록·참가 목록에 쓰는 정사각 타일. 곡·앨범 공용. */
export default function PoolItemTile({ item, itemType, className }: Props) {
  return (
    <Card size="sm" className={cn('h-full gap-2', className)}>
      <CardContent className="flex flex-col gap-2">
        <CoverImage
          src={item.coverUrl}
          alt={item.title}
          fallback={<ItemFallbackIcon itemType={itemType} className="size-6" />}
          className="aspect-square rounded-md"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.title}</p>
          <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}
