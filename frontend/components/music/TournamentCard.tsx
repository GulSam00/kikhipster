'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { BarChart3, Play } from 'lucide-react';
import ShareButton from '@/components/music/ShareButton';
import { ItemFallbackIcon } from '@/components/music/PoolItemTile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { fetchPoolItems, ITEM_TYPE_LABEL, type PoolItem } from '@/lib/pool-item';
import { formatDate } from '@/lib/utils';
import type { TournamentSummary } from '@/types/tournament';

interface Props {
  tournament: TournamentSummary;
  /** 카드 아래에 붙일 동작 — 내 프로필의 수정·삭제 버튼. */
  actions?: ReactNode;
}

/**
 * 대시보드 월드컵 카드. 썸네일 2×2는 `preview_item_ids`를 배치 조회해 채운다.
 *
 * 세 버튼 모두 중립 variant다 — 카드가 여러 장 깔리는 화면이라 primary를 쓰면
 * DESIGN.md § Color budget의 강조 요소 상한을 그대로 넘긴다.
 */
export default function TournamentCard({ tournament, actions }: Props) {
  const [previews, setPreviews] = useState<PoolItem[]>([]);
  const href = `/tournament/${tournament.id}`;

  useEffect(() => {
    if (tournament.preview_item_ids.length === 0) return;
    let alive = true;
    fetchPoolItems(tournament.item_type, tournament.preview_item_ids)
      .then((items) => {
        if (alive) setPreviews(items);
      })
      // 썸네일은 부가 정보라 실패해도 카드 자체는 그대로 보여준다.
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [tournament.item_type, tournament.preview_item_ids]);

  return (
    <Card size="sm" className="h-full gap-3">
      <CardContent className="flex flex-col gap-3">
        <Link
          href={href}
          className="flex items-start gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <div className="grid size-16 shrink-0 grid-cols-2 gap-0.5 overflow-hidden rounded-md bg-muted p-0.5">
            {Array.from({ length: 4 }).map((_, i) => {
              const item = previews[i];
              return (
                <div key={i} className="relative overflow-hidden rounded-[2px] bg-foreground/5">
                  {item?.coverUrl && (
                    <Image src={item.coverUrl} alt="" fill className="object-cover" />
                  )}
                  {!item?.coverUrl && (
                    <div className="flex size-full items-center justify-center text-muted-foreground">
                      <ItemFallbackIcon itemType={tournament.item_type} className="size-2.5" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-1.5">
              <Badge variant="secondary" className="px-1.5 text-[10px]">
                {ITEM_TYPE_LABEL[tournament.item_type]} {tournament.item_count}
              </Badge>
              <Badge variant="outline" className="px-1.5 text-[10px]">
                플레이 {tournament.play_count}
              </Badge>
            </div>
            <p className="truncate text-sm font-medium">{tournament.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {tournament.user.nickname} · {formatDate(tournament.created_at)}
            </p>
          </div>
        </Link>

        <div className="flex gap-2">
          <Button asChild variant="secondary" size="lg" className="flex-1">
            <Link href={href}>
              <Play />
              시작하기
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="flex-1">
            <Link href={`${href}/ranking`}>
              <BarChart3 />
              랭킹보기
            </Link>
          </Button>
          <ShareButton path={href} />
        </div>

        {actions}
      </CardContent>
    </Card>
  );
}
