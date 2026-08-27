'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDeleteItem } from '@/lib/use-delete-item';
import { useMe } from '@/lib/use-me';

interface Props {
  /** 이 항목을 만든 사람. 지금 로그인한 사용자와 같을 때만 버튼이 보인다. */
  ownerId: string;
  editHref: string;
  deletePath: string;
  name: string;
  losesOnDelete: string;
  /** 삭제 후 갈 곳. 상세 페이지가 사라지므로 목록으로 보낸다. */
  redirectTo: string;
  /** 두 버튼에 함께 붙는다. 탑스터 상세처럼 그 줄이 `rounded-full` 로 통일된 곳에서 쓴다. */
  buttonClassName?: string;
}

/**
 * 상세 페이지에서 소유자에게만 보이는 수정·삭제 버튼.
 *
 * **월드컵 상세처럼 Server Component 페이지에서도 소유 여부를 판정해야 해서** 이 조각만
 * 클라이언트로 뺐다. 탑스터 상세는 Client Component지만 같은 컴포넌트를 쓴다 —
 * 두 화면의 동작이 갈리지 않게 하는 편이 낫다.
 *
 * 두 버튼 모두 중립/파괴 variant다. 상세 페이지에는 이미 '플레이 시작'·'랭킹보기' 같은
 * 다른 강조 요소가 있어 primary를 더하면 DESIGN.md § Color budget 상한에 걸린다.
 */
export default function OwnerActions({
  ownerId,
  editHref,
  deletePath,
  name,
  losesOnDelete,
  redirectTo,
  buttonClassName,
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
    <>
      <Button asChild variant="secondary" size="lg" className={buttonClassName}>
        <Link href={editHref}>
          <Pencil />
          수정
        </Link>
      </Button>
      <Button
        variant="destructive"
        size="lg"
        className={buttonClassName}
        onClick={confirmDelete}
        disabled={deleting}
      >
        <Trash2 />
        {deleting ? '삭제 중' : '삭제'}
      </Button>
    </>
  );
}
