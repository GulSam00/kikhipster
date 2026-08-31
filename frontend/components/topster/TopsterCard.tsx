'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';

import ItemStats from '@/components/common/ItemStats';
import { Card, CardContent } from '@/components/ui/card';

import { useAlbumItems } from '@/lib/hooks/use-album-covers';

import { cn } from '@/lib/utils';

import type { Topster } from '@/types/topster';

interface Props {
  topster: Topster;
  /** 작성자 닉네임 노출 여부 (내 프로필에서는 불필요) */
  showAuthor?: boolean;
  /**
   * 카드 아래에 붙일 동작 — 내 프로필의 수정·삭제 버튼.
   * 카드 전체를 `<Link>` 로 감싸지 않는 이유가 이것이다: 앵커 안에 버튼을 넣으면
   * 마크업이 무효고 클릭도 링크에 먹힌다. 그래서 링크는 미리보기·제목까지만 감싼다.
   */
  actions?: ReactNode;
}

/**
 * 탑스터 목록용 미리보기 카드.
 *
 * 목록 응답에는 커버 URL이 없고 앨범 ID만 있다. 그래서 카드가 필요한 ID를
 * `useAlbumCovers` 에 등록하면 같은 화면의 모든 카드 몫이 한 번의 요청으로 합쳐진다.
 * 커버를 아직 못 받았거나 없는 칸은 예전처럼 색으로만 구분한다.
 */
export default function TopsterCard({ topster, showAuthor = true, actions }: Props) {
  const cellCount = topster.width * topster.height;
  const albumIds = useMemo(() => topster.items.map((it) => it.album_spotify_id), [topster.items]);
  const albums = useAlbumItems(albumIds);

  // 링크가 카드 전체가 아니게 되면서 group-hover 를 못 쓴다 — 안쪽 앵커에 hover 가
  // 걸렸을 때 카드를 틴트하는 has-* 로 같은 피드백을 유지한다.
  return (
    <Card size="sm" className="has-[a:hover]:bg-accent h-full gap-2 transition-colors">
      <CardContent className="flex flex-col gap-2">
        <Link
          href={`/topsters/${topster.id}`}
          className="group focus-visible:ring-ring/50 flex flex-col gap-2 rounded-lg outline-none focus-visible:ring-3"
        >
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
            {/*
              작성자와 집계를 한 줄에 두지 않는다 — 메인 화면의 카드는 6열까지 좁아져서
              닉네임 옆에 숫자 3종을 붙이면 둘 다 잘린다.
            */}
            {showAuthor && (
              <p className="text-muted-foreground truncate text-xs">{topster.user.nickname}</p>
            )}
            <ItemStats
              viewCount={topster.view_count}
              likeCount={topster.like_count}
              commentCount={topster.comment_count}
            />
          </div>
        </Link>

        {actions}
      </CardContent>
    </Card>
  );
}
