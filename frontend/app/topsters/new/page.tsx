'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import TopsterEditor from '@/components/topster/TopsterEditor';

import { createTopster } from '@/lib/api/topsters';

import type { TopsterCreateBody } from '@/types/topster';

export default function NewTopsterPage() {
  const t = useTranslations('TopsterDetail');
  const router = useRouter();

  async function create(body: TopsterCreateBody) {
    const created = await createTopster(body);
    router.push(`/topsters/${created.id}`);
  }

  return (
    <TopsterEditor
      heading={t('newHeading')}
      submitLabel={t('newSubmit')}
      savingLabel={t('saving')}
      onSubmit={create}
    />
  );
}
