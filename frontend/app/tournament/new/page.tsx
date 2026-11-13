'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import TournamentEditor from '@/components/tournament/TournamentEditor';

import { createTournament } from '@/lib/api/tournaments';

import type { TournamentCreateBody } from '@/types/tournament';

export default function NewTournamentPage() {
  const t = useTranslations('TournamentDetail');
  const router = useRouter();

  async function create(body: TournamentCreateBody) {
    const created = await createTournament(body);
    toast.success(t('created'));
    router.push(`/tournament/${created.id}`);
  }

  return <TournamentEditor onSubmit={create} backHref="/tournament" />;
}
