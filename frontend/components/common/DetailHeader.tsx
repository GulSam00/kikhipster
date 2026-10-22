import Link from 'next/link';
import type { ReactNode } from 'react';

import ItemStats from '@/components/common/ItemStats';
import LikeCount from '@/components/social/LikeCount';

import { formatDate } from '@/lib/utils';

import type { LikeTargetType } from '@/types/social';

interface Props {
  title: string;
  authorId: string;
  authorNickname: string;
  createdAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  description?: string;
  /**
   * 주면 집계 줄의 좋아요 수가 `LikeCount` 로 바뀌어 **액션 줄의 버튼과 함께 움직인다.**
   * 없으면 `likeCount` 를 그대로 그린다 (서버 시점의 수).
   */
  likeTarget?: { type: LikeTargetType; id: string };
  /** 소유자에게만 보이는 `OwnerMenu`. 방문자에게는 아무것도 그리지 않는다. */
  ownerMenu?: ReactNode;
}

/**
 * 탑스터 상세와 월드컵 상세가 공유하는 헤더.
 *
 * 두 화면이 제각각이던 것을 한 골격으로 모았다 (2026-08-27). 이전에는 탑스터가
 * `제목 → 설명 → by 닉네임`(날짜 없음, 집계 없음)이고 월드컵이
 * `배지 → 제목 → 닉네임·날짜 → 설명`이라, 같은 서비스의 두 상세가 다른 화면처럼 보였다.
 *
 * 순서는 **무엇 → 누가·언제 → 얼마나 → 무슨 내용**이다. **맨 위 배지 줄은 2026-09-08에
 * 뺐다** — 탑스터의 격자 크기(`3×3`)도 월드컵의 종류(`앨범 월드컵`)도 제목보다 먼저
 * 읽힐 만한 정보가 아니었고, 제목 위 한 줄이 상세의 첫인상을 어수선하게 만들었다. 설명이 맨 아래인 이유는
 * 길이가 사용자마다 달라서, 위에 두면 그 아래 정보의 위치가 항목마다 흔들리기 때문이다.
 */
export default function DetailHeader({
  title,
  authorId,
  authorNickname,
  createdAt,
  viewCount,
  likeCount,
  commentCount,
  description,
  likeTarget,
  ownerMenu,
}: Props) {
  return (
    <header className="mb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-2xl font-bold">{title}</h1>
          <p className="text-muted-foreground mt-1 text-xs">
            <Link
              href={`/profile/${authorId}`}
              className="hover:text-primary focus-visible:ring-ring/50 transition-colors outline-none focus-visible:ring-3"
            >
              {authorNickname}
            </Link>
            {' · '}
            {formatDate(createdAt)}
          </p>
        </div>
        {/* 관리 동작은 제목 높이에 맞춰 오른쪽 끝에. 방문자에게는 이 자리가 비어 있다. */}
        {ownerMenu}
      </div>

      <ItemStats
        className="mt-2"
        viewCount={viewCount}
        likeCount={
          likeTarget ? (
            <LikeCount targetType={likeTarget.type} targetId={likeTarget.id} fallback={likeCount} />
          ) : (
            likeCount
          )
        }
        commentCount={commentCount}
      />

      {description && <p className="mt-3 text-sm whitespace-pre-wrap">{description}</p>}
    </header>
  );
}
