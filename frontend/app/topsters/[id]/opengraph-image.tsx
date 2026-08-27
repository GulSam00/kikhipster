import { ImageResponse } from 'next/og';
import { apiFetch } from '@/lib/api';
import { OG_CONTENT_TYPE, OG_SIZE, OgShell } from '@/lib/og';
import type { AlbumSummary } from '@/types/music';
import type { Topster } from '@/types/topster';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = '탑스터 미리보기';

/** 썸네일 모자이크가 3×3까지라 그 이상은 의미가 없다. */
const COVER_COUNT = 9;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let title = '탑스터';
  let subtitle: string | undefined;
  let covers: string[] = [];

  try {
    const t = await apiFetch<Topster>(`/api/topsters/${id}`);
    title = t.title;
    subtitle = t.description || `${t.user.nickname} 님의 ${t.width}×${t.height} 앨범 탑스터`;

    // 격자 순서대로 앞에서부터 채운다 — 사용자가 위에 둔 앨범이 먼저 보이는 게 맞다.
    const ids = [...t.items]
      .sort((a, b) => a.position - b.position)
      .map((it) => it.album_spotify_id)
      .slice(0, COVER_COUNT);

    if (ids.length > 0) {
      const albums = await apiFetch<AlbumSummary[]>(`/api/music/albums?ids=${ids.join(',')}`);
      covers = albums.map((a) => a.cover_url).filter((u): u is string => !!u);
    }
  } catch {
    // 크롤러에게 500을 주느니 제목만 든 카드라도 돌려준다.
  }

  return new ImageResponse(
    <OgShell kind="앨범 탑스터" title={title} subtitle={subtitle} covers={covers} />,
    size,
  );
}
