import Link from 'next/link';
import { Heart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Topster } from '@/types/topster';

interface Props {
  topster: Topster;
  /** 작성자 닉네임 노출 여부 (내 프로필에서는 불필요) */
  showAuthor?: boolean;
  /** 공개/비공개 배지 노출 여부 (내 프로필에서만 의미 있음) */
  showVisibility?: boolean;
}

/**
 * 탑스터 목록용 미리보기 카드.
 * TopsterItem에는 cover_url이 없어 앨범이 채워진 칸만 색으로 구분한다.
 * TODO: [OpenAPI] 목록 응답에 커버 URL이 추가되면 실제 이미지로 교체
 */
export default function TopsterCard({ topster, showAuthor = true, showVisibility = false }: Props) {
  const cellCount = topster.grid_size * topster.grid_size;

  return (
    <Link href={`/topsters/${topster.id}`} className="group block">
      <Card size="sm" className="h-full gap-2 transition-colors group-hover:bg-accent">
        <CardContent className="flex flex-col gap-2">
          <div
            className="grid aspect-square gap-0.5 overflow-hidden rounded-md bg-muted p-0.5"
            style={{ gridTemplateColumns: `repeat(${topster.grid_size}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: cellCount }).map((_, i) => {
              const filled = topster.items.some((it) => it.position === i);
              return (
                <div
                  key={i}
                  className={cn(
                    'aspect-square rounded-[2px]',
                    filled ? 'bg-primary/40' : 'bg-foreground/5',
                  )}
                />
              );
            })}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{topster.title}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {showVisibility && (
                <Badge variant="outline" className="px-1.5 text-[10px]">
                  {topster.is_public ? '공개' : '비공개'}
                </Badge>
              )}
              {showAuthor && <span className="truncate">{topster.user.nickname}</span>}
              <span className="flex shrink-0 items-center gap-0.5">
                <Heart className="size-3" />
                {topster.like_count}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
