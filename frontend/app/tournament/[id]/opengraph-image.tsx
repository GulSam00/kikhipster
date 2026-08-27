import { ImageResponse } from 'next/og';
import { apiFetch } from '@/lib/api';
import { fetchPoolItems, ITEM_TYPE_LABEL } from '@/lib/pool-item';
import { OG_CONTENT_TYPE, OG_SIZE, OgShell } from '@/lib/og';
import type { TournamentDetail } from '@/types/tournament';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = '월드컵 미리보기';

/** 썸네일에 깔 커버 수. 모자이크가 3×3까지라 그 이상은 의미가 없다. */
const COVER_COUNT = 9;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let title = '음악 월드컵';
  let subtitle: string | undefined;
  let covers: string[] = [];

  try {
    const t = await apiFetch<TournamentDetail>(`/api/tournaments/${id}`);
    title = t.title;
    subtitle =
      t.description ||
      `${ITEM_TYPE_LABEL[t.item_type]} ${t.item_count}개 · 플레이 ${t.play_count}회`;

    const items = await fetchPoolItems(t.item_type, t.item_ids.slice(0, COVER_COUNT));
    covers = items.map((i) => i.coverUrl).filter((u): u is string => !!u);
  } catch {
    // 크롤러에게 500을 주느니 제목만 든 카드라도 돌려준다.
  }

  return new ImageResponse(
    <OgShell kind="음악 월드컵" title={title} subtitle={subtitle} covers={covers} />,
    size,
  );
}
