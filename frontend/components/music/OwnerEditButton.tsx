'use client';

import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMe } from '@/lib/use-me';

interface Props {
  /** 이 항목을 만든 사람. 지금 로그인한 사용자와 같을 때만 버튼이 보인다. */
  ownerId: string;
  href: string;
  className?: string;
}

/**
 * 소유자에게만 보이는 '수정' 버튼.
 *
 * 월드컵 상세처럼 **Server Component 페이지**에서도 소유 여부를 판정해야 해서
 * 이 조각만 클라이언트로 뺐다. 삭제는 수정 화면 안에 있다.
 */
export default function OwnerEditButton({ ownerId, href, className }: Props) {
  const me = useMe();
  if (me?.id !== ownerId) return null;

  return (
    <Button asChild variant="secondary" size="lg" className={className}>
      <Link href={href}>
        <Pencil />
        수정
      </Link>
    </Button>
  );
}
