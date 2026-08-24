'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAlbumItems } from '@/lib/album-covers';
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
 *
 * 목록 응답에는 커버 URL이 없고 앨범 ID만 있다. 그래서 카드가 필요한 ID를
 * `useAlbumCovers` 에 등록하면 같은 화면의 모든 카드 몫이 한 번의 요청으로 합쳐진다.
 * 커버를 아직 못 받았거나 없는 칸은 예전처럼 색으로만 구분한다.
 */
export default function TopsterCard({ topster, showAuthor = true, showVisibility = false }: Props) {
  const cellCount = topster.width * topster.height;
  const albumIds = useMemo(
    () => topster.items.map((it) => it.album_spotify_id),
    [topster.items],
  );
  const albums = useAlbumItems(albumIds);

  return (
    <Link
      href={`/topsters/${topster.id}`}
      className="group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card size="sm" className="h-full gap-2 transition-colors group-hover:bg-accent">
        <CardContent className="flex flex-col gap-2">
          {/*
            배경색은 탑스터마다 다르므로 카드 미리보기도 그 색을 쓴다 — 목록에서
            상세로 들어갔을 때 다른 물건처럼 보이지 않게.
            비정방형(1x5 등)이 가능해져 카드도 aspect-square 를 강제하지 않는다.
          */}
          <div
            className="grid gap-0.5 overflow-hidden rounded-md p-0.5"
            style={{
              backgroundColor: topster.background_color,
              gridTemplateColumns: `repeat(${topster.width}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: cellCount }).map((_, i) => {
              const item = topster.items.find((it) => it.position === i);
              const cover = item ? albums.get(item.album_spotify_id)?.coverUrl : null;
              return (
                <div
                  key={i}
                  className={cn(
                    'relative aspect-square overflow-hidden rounded-[2px]',
                    item && !cover ? 'bg-white/25' : 'bg-white/5',
                  )}
                >
                  {cover && (
                    <Image
                      src={cover}
                      alt=""
                      fill
                      // 카드 안 그리드 셀이라 실제 표시 크기는 수십 px다. 원본(600px)을
                      // 그대로 받으면 한 화면에 수백 장이 뜨므로 힌트를 작게 준다.
                      sizes="64px"
                      className="object-cover"
                    />
                  )}
                </div>
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
