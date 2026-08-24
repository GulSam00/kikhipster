'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Music2 } from 'lucide-react';
import TopsterAlbumList from '@/components/music/TopsterAlbumList';
import type { PoolItem } from '@/lib/pool-item';
import { computeCell, gridOffsetTop, topsterGridStyle, useBoxSize } from '@/lib/topster-grid';
import { cn } from '@/lib/utils';
import type { TopsterItem, TopsterOptions } from '@/types/topster';

interface Props {
  options: TopsterOptions;
  title: string;
  items: Pick<TopsterItem, 'album_spotify_id' | 'position'>[];
  albums: Map<string, PoolItem | null>;
  className?: string;
}

/**
 * 탑스터 본체 — 배경 패널 + (옵션) 제목 + 격자 + (옵션) 아티스트–앨범 목록.
 *
 * topsters.org를 헤드리스 브라우저로 띄워 확인한 구조를 따른다(2026-08-23):
 * 캔버스 안에 격자가 있고 그 오른쪽에 목록이 줄(row) 단위로 묶여 나온다.
 *
 * 셀 크기를 여기서 계산해 격자와 목록이 **같은 값을 공유**한다 — 목록이 격자 행에
 * 세로로 정렬되려면 둘이 같은 행 높이를 알아야 한다.
 */
export default function TopsterCanvas({ options, title, items, albums, className }: Props) {
  const {
    width,
    height,
    background_color,
    text_color,
    cell_gap,
    show_title,
    show_album_info,
    show_numbering,
  } = options;

  const [boxRef, box] = useBoxSize<HTMLDivElement>();
  const cell = computeCell(width, height, cell_gap, box);
  const offsetTop = gridOffsetTop(height, cell_gap, cell, box);

  return (
    // 배경색·글자색은 사용자 지정이라 토큰이 아닌 인라인 스타일로 들어간다 — 앨범 커버와
    // 같은 '사용자 콘텐츠' 층위다(DESIGN.md의 임의 색상값 금지는 UI 크롬 규칙).
    <div
      className={cn('rounded-xl p-3 sm:p-4', className)}
      style={{ backgroundColor: background_color, color: text_color }}
    >
      {show_title && title.trim() !== '' && (
        <p className="mb-3 truncate text-center text-lg font-bold">{title}</p>
      )}

      {/*
        탑스터가 차지하는 영역은 칸 수와 무관하게 고정이다 — 화면을 벗어나지 않는 선에서
        최대한 크게 잡는다. 높이를 **행 자체**에 걸어야 목록이 길어져도 패널이 안 늘어난다.
      */}
      <div className="flex h-[min(70vh,560px)] min-w-0 flex-col gap-4 lg:flex-row">
        <div ref={boxRef} className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
          <div style={topsterGridStyle(width, height, cell_gap, cell)}>
            {Array.from({ length: width * height }).map((_, i) => {
              const item = items.find((it) => it.position === i);
              const album = item ? albums.get(item.album_spotify_id) : undefined;
              if (!item) return <div key={i} className="bg-white/5" />;

              const label = album ? `${album.subtitle} – ${album.title}` : '앨범';
              return (
                <Link
                  key={i}
                  href={`/albums/${item.album_spotify_id}`}
                  aria-label={label}
                  title={label}
                  className="relative flex items-center justify-center overflow-hidden bg-white/5 outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {album?.coverUrl ? (
                    <Image
                      src={album.coverUrl}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 33vw, 160px"
                      className="object-cover"
                    />
                  ) : (
                    <Music2 className="size-5 opacity-40" />
                  )}
                  {show_numbering && (
                    <span className="absolute top-0 left-0 bg-black/70 px-1 text-[10px] font-medium text-white tabular-nums">
                      {i + 1}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {show_album_info && (
          <TopsterAlbumList
            width={width}
            height={height}
            items={items}
            albums={albums}
            cell={cell}
            gap={cell_gap}
            color={text_color}
            offsetTop={offsetTop}
            showNumbering={show_numbering}
          />
        )}
      </div>
    </div>
  );
}
