'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { apiFetch } from '@/lib/api/client';

interface Options {
  /** `DELETE` 를 보낼 API 경로. 확인 토스트의 id로도 쓴다(대상마다 하나만 뜨도록). */
  deletePath: string;
  /** 확인 문구에 들어갈 대상 이름. */
  name: string;
  /** 같이 사라지는 것들에 대한 안내. */
  losesOnDelete: string;
  /** 삭제 성공 후 처리 — 목록에서 빼거나, 상세라면 목록으로 보내거나. */
  onDeleted: () => void;
}

/**
 * 삭제 확인 → `DELETE` → 후처리.
 *
 * 삭제 진입점이 상세와 프로필 카드 두 곳이라 확인 문구·동작이 갈리지 않도록 여기 모았다.
 * (2026-08-27 이전에는 카드용과 수정 화면용이 따로 구현돼 있었다. 수정 화면의 삭제는
 * 상세로 옮기면서 없앴다.)
 */
export function useDeleteItem({ deletePath, name, losesOnDelete, onDeleted }: Options) {
  const t = useTranslations('Owner');
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = useCallback(() => {
    async function doDelete() {
      setDeleting(true);
      try {
        await apiFetch(deletePath, { method: 'DELETE' });
        toast.success(t('deleted', { name }));
        onDeleted();
      } catch {
        toast.error(t('deleteFailed'));
        setDeleting(false);
      }
    }

    // 토스트는 저절로 사라지므로 방치하면 '취소'와 같은 결과가 된다 — 안전한 쪽이 기본값이다.
    toast.warning(t('confirmDelete', { name }), {
      id: deletePath,
      description: t('irreversible', { losesOnDelete }),
      duration: 10000,
      action: { label: t('delete'), onClick: () => void doDelete() },
      cancel: { label: t('cancel'), onClick: () => toast.dismiss(deletePath) },
    });
  }, [deletePath, name, losesOnDelete, onDeleted, t]);

  return { confirmDelete, deleting };
}
