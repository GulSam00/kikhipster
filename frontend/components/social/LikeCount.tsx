'use client';

import { useLikeStatus } from '@/lib/hooks/use-like-status';

import type { LikeTargetType } from '@/types/social';

interface Props {
  targetType: LikeTargetType;
  targetId: string;
  /** 조회 전에 보여줄 값. 상세 응답에 실려 온 서버 시점의 수다. */
  fallback: number;
}

/**
 * 좋아요 **수만** 그리는 조각. 헤더 `ItemStats` 의 하트 자리에 들어간다.
 *
 * 왜 필요한가: 2026-09-08에 상세의 좋아요 버튼을 아이콘 전용으로 줄이면서 버튼에서
 * 숫자가 사라졌다. 그러면 헤더의 `♡ 12` 가 화면에 남은 유일한 수치인데, 그 값은
 * 상세 응답에 실려 온 **서버 시점의 수**라 좋아요를 눌러도 그대로였다.
 *
 * `useLikeStatus` 는 모듈 레벨 `Map` 하나를 공유하고 바뀔 때마다 등록된 리스너를 전부
 * 깨운다. 그래서 이 컴포넌트가 같은 `(type, id)` 로 훅을 한 번 더 부르면 **버튼과 같은
 * 값을 보고 같이 다시 그려진다** — 별도의 상태 전달이나 요청 추가가 없다.
 */
export default function LikeCount({ targetType, targetId, fallback }: Props) {
  const { status } = useLikeStatus(targetType, targetId);
  return <>{status ? status.like_count : fallback}</>;
}
