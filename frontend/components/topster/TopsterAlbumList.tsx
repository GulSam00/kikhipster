'use client';

import Link from 'next/link';

import type { PoolItem } from '@/lib/domain/pool-item';
import { cn } from '@/lib/utils';

import type { TopsterItem } from '@/types/topster';

interface Props {
  width: number;
  height: number;
  items: Pick<TopsterItem, 'album_spotify_id' | 'position'>[];
  albums: Map<string, PoolItem | null>;
  /** 격자 셀 한 변(px). 목록의 각 줄 묶음을 같은 높이로 맞추는 데 쓴다. */
  cell: number;
  /** 격자의 칸 간격(px). 줄 묶음 사이 간격을 격자와 맞춘다. */
  gap: number;
  /** 글자색. 배경색과 함께 사용자가 고른다. */
  color: string;
  /** 격자가 가운데 정렬되며 생긴 위쪽 여백(px). 첫 행에 줄을 맞추는 데 쓴다. */
  offsetTop?: number;
  /** 항목을 앨범 상세로 링크할지. 만들기 화면 미리보기에서는 끈다. */
  linkItems?: boolean;
  /** 격자와 같은 번호를 목록에도 붙인다. */
  showNumbering?: boolean;
}

/**
 * 격자 오른쪽 "아티스트 – 앨범" 목록.
 *
 * **격자의 행과 세로로 정렬된다.** 목록 전체를 격자와 같은 행 높이(cell)·간격(gap)의
 * 그리드로 깔고, 각 줄 묶음이 대응하는 격자 행과 같은 띠 안에 들어간다. 5x5면 첫 행의
 * 앨범 5개 정보가 첫 행 높이 안에 표시된다 — 목록의 어느 줄이 어느 칸인지 눈으로 바로 짚힌다.
 *
 * 항목은 **자기 높이만 차지하고 위에서부터 쌓인다** — 띠 높이를 균등 분할하지 않는다.
 * 그래서 행 아래쪽에 빈 자리가 남을 수 있는데, 그게 정상이다. 글자는 잘라내지 않고
 * 줄바꿈하므로 긴 제목도 다 보인다.
 */
export default function TopsterAlbumList({
  width,
  height,
  items,
  albums,
  cell,
  gap,
  color,
  offsetTop = 0,
  linkItems = true,
  showNumbering = false,
}: Props) {
  // 빈 행도 자리를 지켜야 격자와 줄이 어긋나지 않는다.
  const rows = Array.from({ length: height }, (_, row) =>
    Array.from({ length: width }, (_, col) =>
      items.find((it) => it.position === row * width + col),
    ).filter((it): it is NonNullable<typeof it> => Boolean(it)),
  );

  if (items.length === 0) return null;

  // 항목 높이가 자유로워졌으므로 글자 크기는 셀 크기에만 완만하게 연동한다.
  const fontSize = Math.max(10, Math.min(13, Math.round(cell * 0.1)));

  return (
    // 격자가 가운데 정렬돼 생긴 위쪽 여백만큼 내려서 시작한다 — 첫 줄이 격자 첫 행과 맞는다.
    <div
      className="min-h-0 w-full min-w-0 shrink-0 overflow-y-auto lg:w-44"
      style={{ color, paddingTop: `${offsetTop}px` }}
    >
      {/*
        행 높이는 최소 cell 이되 내용이 넘치면 늘어난다(minmax). 고정하면 줄바꿈된 글자가
        다음 행을 덮어써서 서로 겹친다 — 실측으로 27px 침범을 확인했다. 넘칠 때는
        아래 행들이 밀려 격자와의 정렬이 어긋나지만, 글자가 겹치는 것보다 낫다.
      */}
      <div
        className="w-full"
        style={{
          display: 'grid',
          gridTemplateRows: `repeat(${height}, minmax(${cell}px, max-content))`,
          gap: `${gap}px`,
        }}
      >
        {rows.map((row, i) => (
          // 위에서부터 쌓는다(justify-center 아님). 남는 아래쪽 여백은 그대로 둔다.
          <ul key={i} className="flex flex-col">
            {row.map((item) => {
              const album = albums.get(item.album_spotify_id);
              // 아티스트와 제목을 같은 색으로 둔다 — 색으로 나누는 대신 구분자만 쓴다.
              const text = album
                ? `${album.subtitle} – ${album.title}`
                : album === null
                  ? '정보 없음'
                  : '불러오는 중...';

              const inner = (
                <>
                  {showNumbering && (
                    <span className="tabular-nums opacity-60">{item.position + 1}. </span>
                  )}
                  {text}
                </>
              );
              // 잘라내지 않는다 — 긴 제목은 줄바꿈해서 전부 보여준다.
              const base =
                'block rounded-sm px-1 leading-snug break-words outline-none transition-colors';

              return (
                <li key={item.position} style={{ fontSize: `${fontSize}px` }} title={text}>
                  {linkItems ? (
                    <Link
                      href={`/albums/${item.album_spotify_id}`}
                      className={cn(
                        base,
                        'focus-visible:ring-ring/50 hover:bg-white/10 focus-visible:ring-3',
                      )}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <span className={base}>{inner}</span>
                  )}
                </li>
              );
            })}
          </ul>
        ))}
      </div>
    </div>
  );
}
