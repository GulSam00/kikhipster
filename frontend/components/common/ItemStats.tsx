import { Eye, Heart, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  viewCount: number;
  likeCount: number;
  commentCount: number;
  className?: string;
}

/**
 * 조회·좋아요·댓글 수 한 줄. 탑스터 카드와 월드컵 카드가 같은 모양을 쓴다.
 *
 * 아이콘만으로는 무슨 숫자인지 소리로 전달되지 않아서, 아이콘은 `aria-hidden` 으로
 * 감추고 낱말을 `sr-only` 로 붙였다. 숫자는 `tabular-nums` 라 카드가 여러 장 깔려도
 * 자릿수에 따라 좌우로 흔들리지 않는다.
 */
export default function ItemStats({ viewCount, likeCount, commentCount, className }: Props) {
  const stats = [
    { icon: Eye, label: '조회', value: viewCount },
    { icon: Heart, label: '좋아요', value: likeCount },
    { icon: MessageCircle, label: '댓글', value: commentCount },
  ];

  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      {stats.map(({ icon: Icon, label, value }) => (
        <span key={label} className="flex shrink-0 items-center gap-0.5">
          <Icon className="size-3" aria-hidden />
          <span className="sr-only">{label}</span>
          <span className="tabular-nums">{value}</span>
        </span>
      ))}
    </div>
  );
}
