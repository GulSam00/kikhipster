'use client';

import { TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlert />
          </EmptyMedia>
          <EmptyTitle>불러오지 못했습니다</EmptyTitle>
          <EmptyDescription>일시적인 오류일 수 있습니다. 다시 시도해주세요.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={reset}>다시 시도</Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
