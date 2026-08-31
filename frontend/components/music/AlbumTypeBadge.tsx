import { Badge } from '@/components/ui/badge';
import { albumTypeLabel } from '@/lib/domain/album-title';
import { cn } from '@/lib/utils';

/**
 * 앨범이 정규 앨범인지 EP 인지 싱글인지 보여 주는 배지.
 *
 * iTunes 는 종류를 필드로 주지 않고 제목 표기로만 알려 준다. 그 표기는 화면에서 떼기
 * 때문에(`lib/domain/album-title.ts`) **종류를 말하는 자리가 이 배지뿐이다.**
 *
 * ## 색을 고른 근거 (DESIGN.md § Color)
 *
 * **amber(`primary`) 는 일부러 쓰지 않는다.** 검색 결과는 카드가 20개 깔리는 화면이라
 * primary 배지를 달면 "한 화면에 primary 강조 2개 초과 WARN / 4개 초과 BLOCK"에 바로
 * 걸린다. primary 는 CTA 자리로 남겨 둔다.
 *
 * 대신 `--album-ep`(보라) · `--album-single`(청색) 두 토큰을 새로 뒀고, 배경 15% ·
 * 테두리 30% 로 채도를 낮춰 커버 아트를 이기지 않게 했다. `album` 은 가장 흔하고
 * 기본값이므로 **무채색**이다 — 셋 다 물들이면 그리드가 시끄러워진다.
 */

/**
 * `variant="outline"` 위에 덮는다. outline 이 주는 `border-border text-foreground` 를
 * 같은 속성으로 다시 써서 지운다 — **variant 를 바꾸면 안 된다.** `cn()` 은 twMerge 라
 * variant 가 다르면 다른 그룹으로 보고 둘 다 남기고, 그러면 기본값이 이긴다
 * (CLAUDE.md 에 기록된 `SelectTrigger` 사례).
 */
const TYPE_CLASS: Record<string, string> = {
  ep: 'border-album-ep/30 bg-album-ep/15 text-album-ep',
  single: 'border-album-single/30 bg-album-single/15 text-album-single',
  album: 'border-border bg-secondary text-muted-foreground',
};

interface Props {
  type: string;
  className?: string;
}

export default function AlbumTypeBadge({ type, className }: Props) {
  return (
    <Badge
      variant="outline"
      /* 모르는 종류가 와도 배지는 뜬다 — 무채색으로 떨어진다. */
      className={cn(TYPE_CLASS[type] ?? TYPE_CLASS.album, className)}
    >
      {albumTypeLabel(type)}
    </Badge>
  );
}
