import type { ReactNode } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface Props {
  /** 없거나 빈 문자열이면 `fallback` 을 그린다. iTunes 에서 사라진 항목이 실제로 그렇다. */
  src?: string | null;
  alt: string;
  /** 커버가 없을 때 가운데 놓을 아이콘. 크기는 호출부가 정한다. */
  fallback: ReactNode;
  /** 크기·모양. `size-10 rounded-md`, `aspect-square w-full rounded-full` 처럼 준다. */
  className?: string;
  /**
   * `next/image` 의 `sizes`. 실제 표시 크기가 작은 자리(카드 그리드 셀 등)에서 꼭 넘긴다 —
   * 빠뜨리면 원본(600px)을 받아 한 화면에 수십 장이 뜬다.
   */
  sizes?: string;
}

/**
 * 커버 이미지 + 폴백 아이콘. 앨범·아티스트·곡 카드가 모두 같은 뼈대를 쓴다.
 *
 * 뽑아내기 전에는 `relative overflow-hidden bg-muted` + `Image fill object-cover` +
 * "없으면 가운데 아이콘" 세 줄이 아홉 파일에 흩어져 있었다. 모양(정사각/원형)과 크기만
 * 다르고 구조는 같아서 `className` 으로 그 둘만 받는다.
 *
 * **탑스터 격자 셀은 이걸 쓰지 않는다** — 거기서는 커버가 없을 때 아이콘이 아니라
 * 색 블록으로 칸을 표시하고, 배경도 사용자가 고른 색이라 전제가 다르다.
 */
export default function CoverImage({ src, alt, fallback, className, sizes }: Props) {
  return (
    <div className={cn('relative overflow-hidden bg-muted', className)}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          {fallback}
        </div>
      )}
    </div>
  );
}
