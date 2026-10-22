'use client';

import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { useDeleteItem } from '@/lib/hooks/use-delete-item';
import { useMe } from '@/lib/hooks/use-me';

interface Props {
  /** 이 항목을 만든 사람. 지금 로그인한 사용자와 같을 때만 메뉴가 보인다. */
  ownerId: string;
  editHref: string;
  deletePath: string;
  name: string;
  losesOnDelete: string;
  /** 삭제 후 갈 곳. 상세 페이지가 사라지므로 목록으로 보낸다. */
  redirectTo: string;
}

/**
 * 상세 페이지 헤더 우측의 소유자 메뉴(수정·삭제).
 *
 * **예전에는 좋아요·공유와 같은 줄에 `size="lg"` 버튼 두 개로 있었다**(`OwnerActions`).
 * 세 가지 이유로 메뉴 안으로 넣었다 (2026-08-27):
 * - 되돌릴 수 없는 삭제가 좋아요와 같은 크기로 8px 옆에 있었다
 * - 소유자면 버튼이 4~6개, 방문자면 2~3개라 같은 화면의 줄 길이가 사람마다 달랐다
 * - `destructive` 상시 노출이 `primary`(시작하기)와 겹쳐 DESIGN.md § Color budget 의
 *   "primary와 destructive가 동시에 두드러지면 WARN"에 걸렸다
 *
 * 삭제 확인은 그대로 `useDeleteItem` 의 sonner 토스트다 — 메뉴에서 한 번, 토스트에서
 * 한 번, 두 단계가 된다.
 *
 * **월드컵 상세처럼 Server Component 페이지에서도 소유 여부를 판정해야 해서** 이 조각만
 * 클라이언트다. 탑스터 상세는 Client Component지만 같은 컴포넌트를 쓴다.
 */
export default function OwnerMenu({
  ownerId,
  editHref,
  deletePath,
  name,
  losesOnDelete,
  redirectTo,
}: Props) {
  const me = useMe();
  const router = useRouter();

  const onDeleted = useCallback(() => {
    router.push(redirectTo);
    // 목록이 Server Component면 캐시된 응답에 방금 지운 항목이 남는다.
    router.refresh();
  }, [router, redirectTo]);

  const { confirmDelete, deleting } = useDeleteItem({
    deletePath,
    name,
    losesOnDelete,
    onDeleted,
  });

  if (me?.id !== ownerId) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/*
          § Mobile 의 44px 터치 타깃. 버튼 프리미티브는 `icon-lg` 가 36px 로 가장 크므로
          그것만으로는 못 채운다 — 보이는 크기는 36px 그대로 두고 `after:-inset-1`(4px×2)
          로 히트 영역만 44px 로 넓혔다.
        */}
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label={`'${name}' 관리`}
          className="relative shrink-0 after:absolute after:-inset-1 after:content-['']"
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={editHref}>
            <Pencil />
            수정
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={confirmDelete} disabled={deleting}>
          <Trash2 />
          {deleting ? '삭제 중' : '삭제'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
