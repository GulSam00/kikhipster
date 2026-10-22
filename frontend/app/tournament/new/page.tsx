'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import TournamentEditor from '@/components/tournament/TournamentEditor';

import { createTournament } from '@/lib/api/tournaments';

import type { TournamentCreateBody } from '@/types/tournament';

export default function NewTournamentPage() {
  const router = useRouter();

  async function create(body: TournamentCreateBody) {
    const created = await createTournament(body);
    toast.success('월드컵을 만들었습니다');
    router.push(`/tournament/${created.id}`);
  }

  return <TournamentEditor onSubmit={create} backHref="/tournament" />;
}
