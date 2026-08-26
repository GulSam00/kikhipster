'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import TournamentEditor from '@/components/music/TournamentEditor';
import type { TournamentCreateBody, TournamentDetail } from '@/types/tournament';

export default function NewTournamentPage() {
  const router = useRouter();

  async function create(body: TournamentCreateBody) {
    const created = await apiFetch<TournamentDetail>('/api/tournaments/', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    toast.success('월드컵을 만들었습니다');
    router.push(`/tournament/${created.id}`);
  }

  return <TournamentEditor onSubmit={create} backHref="/tournament" />;
}
