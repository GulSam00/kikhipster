'use client';

import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import TopsterEditor from '@/components/music/TopsterEditor';
import type { TopsterCreateBody } from '@/types/topster';

export default function NewTopsterPage() {
  const router = useRouter();

  async function create(body: TopsterCreateBody) {
    const res = await apiFetch<{ id: string }>('/api/topsters/', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    router.push(`/topsters/${res.id}`);
  }

  return (
    <TopsterEditor
      heading="새 탑스터"
      submitLabel="탑스터 저장"
      savingLabel="저장 중..."
      onSubmit={create}
    />
  );
}
