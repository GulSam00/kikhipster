'use client';

import { useRouter } from 'next/navigation';

import TopsterEditor from '@/components/topster/TopsterEditor';

import { createTopster } from '@/lib/api/topsters';

import type { TopsterCreateBody } from '@/types/topster';

export default function NewTopsterPage() {
  const router = useRouter();

  async function create(body: TopsterCreateBody) {
    const created = await createTopster(body);
    router.push(`/topsters/${created.id}`);
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
