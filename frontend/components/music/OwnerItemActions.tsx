'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface Props {
  /** 수정 화면 경로. */
  editHref: string;
  /** `DELETE` 를 보낼 API 경로. 확인 토스트의 id로도 쓴다(항목마다 하나만 뜨도록). */
  deletePath: string;
  /** 확인 문구에 들어갈 대상 이름. */
  name: string;
  /** 같이 사라지는 것들에 대한 안내. */
  losesOnDelete: string;
  /** 삭제 성공 시 목록에서 빼기 위한 콜백. */
  onDeleted: () => void;
}

/**
 * 내가 만든 항목(탑스터·월드컵) 카드에 붙는 수정·삭제 버튼 쌍.
 *
 * 카드가 격자로 깔리는 자리라 두 버튼 모두 중립/파괴 variant다 — primary를 쓰면
 * DESIGN.md § Color budget 상한을 카드 수만큼 넘긴다.
 */
export default function OwnerItemActions({
  editHref,
  deletePath,
  name,
  losesOnDelete,
  onDeleted,
}: Props) {
  const [deleting, setDeleting] = useState(false);

  async function doDelete() {
    setDeleting(true);
    try {
      await apiFetch(deletePath, { method: 'DELETE' });
      toast.success(`'${name}' 을(를) 삭제했습니다`);
      onDeleted();
    } catch {
      toast.error('삭제에 실패했습니다');
      setDeleting(false);
    }
  }

  function confirmDelete() {
    // 토스트는 저절로 사라지므로 방치하면 '취소'와 같은 결과가 된다 — 안전한 쪽이 기본값이다.
    toast.warning(`'${name}' 을(를) 삭제할까요?`, {
      id: deletePath,
      description: `${losesOnDelete} 되돌릴 수 없습니다.`,
      duration: 10000,
      action: { label: '삭제', onClick: () => void doDelete() },
      cancel: { label: '취소', onClick: () => toast.dismiss(deletePath) },
    });
  }

  return (
    <div className="flex gap-1">
      <Button asChild variant="outline" size="sm" className="flex-1">
        <Link href={editHref}>
          <Pencil />
          수정
        </Link>
      </Button>
      <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={deleting}>
        <Trash2 />
        {deleting ? '삭제 중' : '삭제'}
      </Button>
    </div>
  );
}
