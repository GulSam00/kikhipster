import type { Metadata } from 'next';
import { getTopster } from '@/lib/api/topsters';
import TopsterDetail from './TopsterDetail';

/**
 * 이 페이지는 **메타데이터 때문에만** Server Component다.
 * `generateMetadata` 는 서버에서만 돌아서, 본문이 `'use client'` 인 채로는 붙일 수 없다.
 * 화면은 그대로 `TopsterDetail`(클라이언트)이 그린다.
 *
 * 썸네일은 같은 폴더의 `opengraph-image.tsx` 가 그린다 — Next가 파일 이름만으로
 * `og:image` 를 붙여주므로 여기서 images를 지정하지 않는다.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const t = await getTopster(id);
    const summary =
      t.description || `${t.user.nickname} 님의 ${t.width}×${t.height} 앨범 탑스터`;
    return {
      title: t.title,
      description: summary,
      openGraph: { title: t.title, description: summary, type: 'article' },
    };
  } catch {
    // 없는 탑스터면 본문이 "찾을 수 없습니다"를 그린다 — 메타에서 터뜨리지 않는다.
    return { title: '탑스터' };
  }
}

export default async function TopsterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TopsterDetail id={id} />;
}
