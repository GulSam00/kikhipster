'use client';

import { type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Disc3,
  Music2,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { TOURNAMENT_MAX_POOL, TOURNAMENT_MIN_POOL } from '@/lib/domain/limits';
import PoolItemTile, { ItemFallbackIcon } from '@/components/tournament/PoolItemTile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { albumToPoolItem, trackToPoolItem, type PoolItem } from '@/lib/domain/pool-item';
import { useTournamentDraft, type SearchMode, type TournamentDraftInitial } from '@/lib/hooks/use-tournament-draft';
import { cn } from '@/lib/utils';
import type { TournamentItemType, TournamentCreateBody } from '@/types/tournament';

export type { TournamentDraftInitial as TournamentEditorInitial };

interface Props {
  /** 없으면 새 월드컵. 있으면 그 값으로 시작하고 종류 선택 단계를 건너뛴다. */
  initial?: TournamentDraftInitial;
  onSubmit: (body: TournamentCreateBody) => Promise<void>;
  /** 첫 단계에서 '이전'을 눌렀을 때 갈 곳. */
  backHref: string;
  /** 마지막 단계 버튼 아래 붙일 동작 — 수정 화면의 '삭제'. */
  extraActions?: ReactNode;
}

/**
 * 월드컵 만들기·수정 공용 위저드.
 *
 * `/tournament/new` 와 `/tournament/[id]/edit` 가 같은 화면을 쓴다. 저장 방식(POST/PUT)만
 * 달라서 `onSubmit` 으로 뺐다.
 *
 * **수정 모드에는 종류(곡/앨범) 선택 단계가 없다.** 백엔드도 `item_type` 은 안 바꾼다 —
 * 이미 치러진 플레이의 대진과 종류가 어긋나기 때문이다. 그래서 단계가 3개가 아니라 2개다.
 *
 * 상태 로직은 `useTournamentDraft` 에 있다 — 이 컴포넌트는 UI 렌더링만 한다.
 */
export default function TournamentEditor({ initial, onSubmit, backHref, extraActions }: Props) {
  const router = useRouter();
  const {
    isEdit,
    totalSteps,
    step,
    setStep,
    selectItemType,
    itemType,
    title,
    setTitle,
    description,
    setDescription,
    searchMode,
    setSearchMode,
    effectiveMode,
    q,
    setQ,
    shownTracks,
    shownAlbums,
    expanded,
    albumTracks,
    expandAlbum,
    pool,
    inPool,
    addItems,
    toggleItem,
    submitting,
    submit,
  } = useTournamentDraft({ initial, onSubmit });

  // ---------------------------------------------------------------- step 1
  if (step === 'type') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <StepHeader
          step={1}
          total={totalSteps}
          title="무엇으로 겨룰까요?"
          onBack={() => router.push(backHref)}
        />

        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { value: 'track', label: '곡', desc: '노래 하나하나로 대결', Icon: Music2 },
              { value: 'album', label: '앨범', desc: '앨범 단위로 대결', Icon: Disc3 },
            ] as const
          ).map(({ value, label, desc, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => selectItemType(value)}
              className="rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="h-full transition-colors hover:bg-accent">
                <CardContent className="flex flex-col gap-1">
                  <Icon className="mb-1 size-6 text-muted-foreground" />
                  <p className="text-lg font-bold">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- step 2
  if (step === 'meta') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <StepHeader
          step={isEdit ? 1 : 2}
          total={totalSteps}
          title={isEdit ? '월드컵 정보 수정' : '월드컵 정보'}
          onBack={() => (isEdit ? router.push(backHref) : setStep('type'))}
        />

        <div className="mb-6 flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="wc-title">이름</Label>
            <Input
              id="wc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={itemType === 'album' ? '내 인생 앨범 월드컵' : '내 최애곡 월드컵'}
              maxLength={100}
              className="h-10"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="wc-desc">설명</Label>
            <Textarea
              id="wc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="어떤 기준으로 모았는지 적어주세요 (선택)"
              maxLength={500}
              rows={4}
            />
            <p className="text-xs text-muted-foreground tabular-nums">{description.length}/500</p>
          </div>
        </div>

        <Button size="lg" className="h-11 w-full" disabled={!title.trim()} onClick={() => setStep('pool')}>
          다음
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------- step 3
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <StepHeader
        step={isEdit ? 2 : 3}
        total={totalSteps}
        title={`${itemType === 'album' ? '앨범' : '곡'} 담기`}
        onBack={() => setStep('meta')}
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground tabular-nums">
          {pool.length}개 담김 · 최소 {TOURNAMENT_MIN_POOL} / 최대 {TOURNAMENT_MAX_POOL}
        </p>
        {itemType === 'track' && (
          <Tabs value={searchMode} onValueChange={(v) => setSearchMode(v as SearchMode)}>
            <TabsList>
              <TabsTrigger value="track">곡 검색</TabsTrigger>
              <TabsTrigger value="album">앨범에서 찾기</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={effectiveMode === 'album' ? '앨범 검색...' : '곡 검색...'}
          className="h-10 pl-9"
        />
      </div>

      {/* 곡 검색 결과 */}
      {effectiveMode === 'track' && shownTracks.length > 0 && (
        <ScrollArea className="mb-4 h-72 rounded-lg border">
          <div className="flex flex-col gap-1 p-1">
            {shownTracks.map((t) => (
              <ResultRow
                key={t.id}
                item={trackToPoolItem(t)}
                itemType="track"
                picked={inPool(t.id)}
                onToggle={() => toggleItem(trackToPoolItem(t))}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* 앨범 검색 결과 — 곡 모드에서는 펼쳐서 수록곡을 담는다 */}
      {effectiveMode === 'album' && shownAlbums.length > 0 && (
        <ScrollArea className="mb-4 h-72 rounded-lg border">
          <div className="flex flex-col gap-1 p-1">
            {shownAlbums.map((a) => {
              const item = albumToPoolItem(a);
              const isOpen = expanded === a.id;
              const tracks = albumTracks[a.id];

              return (
                <div key={a.id}>
                  {itemType === 'album' ? (
                    <ResultRow
                      item={item}
                      itemType="album"
                      picked={inPool(a.id)}
                      onToggle={() => toggleItem(item)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => expandAlbum(a)}
                      aria-expanded={isOpen}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <Cover item={item} itemType="album" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{a.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {a.artist_name} · {a.total_tracks}곡
                        </span>
                      </span>
                      <ChevronDown
                        className={cn(
                          'size-4 shrink-0 text-muted-foreground transition-transform',
                          isOpen && 'rotate-180',
                        )}
                      />
                    </button>
                  )}

                  {itemType === 'track' && isOpen && (
                    <div className="mb-1 ml-4 border-l pl-2">
                      {!tracks ? (
                        <p className="py-3 text-center text-xs text-muted-foreground">
                          수록곡 불러오는 중...
                        </p>
                      ) : (
                        <>
                          <div className="flex justify-end p-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addItems(tracks.map(trackToPoolItem))}
                            >
                              <Plus />
                              {tracks.length}곡 전체 추가
                            </Button>
                          </div>
                          {tracks.map((t) => (
                            <ResultRow
                              key={t.id}
                              item={trackToPoolItem(t)}
                              itemType="track"
                              picked={inPool(t.id)}
                              onToggle={() => toggleItem(trackToPoolItem(t))}
                            />
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {pool.length > 0 && (
        <>
          <Separator className="mb-3" />
          <p className="mb-2 text-sm font-medium tabular-nums">담긴 목록 {pool.length}</p>
          {/* 상세 페이지의 후보 그리드(PoolItemTile)와 같은 모양으로 맞춘다 — 담기 전과 후가
              같아 보여야 무엇이 담겼는지 알아보기 쉽다. 커버는 이미 메모리에 있어 추가 요청이 없다. */}
          <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {pool.map((p) => (
              <PickedTile key={p.id} item={p} itemType={itemType} onRemove={() => toggleItem(p)} />
            ))}
          </div>
        </>
      )}

      <div className="flex gap-2">
        <Button
          size="lg"
          className="h-11 flex-1"
          disabled={pool.length < TOURNAMENT_MIN_POOL || submitting}
          onClick={submit}
        >
          {submitting
            ? isEdit
              ? '저장 중...'
              : '만드는 중...'
            : pool.length < TOURNAMENT_MIN_POOL
              ? `${TOURNAMENT_MIN_POOL - pool.length}개 더 담아주세요`
              : isEdit
                ? `${pool.length}개로 저장`
                : `${pool.length}개로 월드컵 만들기`}
        </Button>
        {extraActions}
      </div>
    </div>
  );
}

function StepHeader({
  step,
  total,
  title,
  onBack,
}: {
  step: number;
  total: number;
  title: string;
  onBack: () => void;
}) {
  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={onBack}>
        <ArrowLeft />
        이전
      </Button>
      <p className="mb-1 text-xs text-muted-foreground tabular-nums">{step} / {total}</p>
      <h1 className="mb-6 font-heading text-2xl font-bold">{title}</h1>
    </>
  );
}

/**
 * 담긴 목록의 타일. **타일 전체가 '빼기' 버튼이고, hover 하면 딤 위에 X 가 뜬다.**
 *
 * 2026-08-28 이전에는 우측 상단에 작은 X 버튼이 얹혀 있었다. 탑스터 편집기의 격자 셀이
 * 이미 "클릭하면 제거, hover 하면 오버레이" 방식이라 같은 화면군에서 두 가지 제거 방법을
 * 쓰고 있던 셈이다. 타일 전체가 과녁이 되므로 작은 X 를 겨냥할 필요도 없어진다.
 *
 * **탑스터 쪽과 달리 `<div onClick>` 이 아니라 `<button>` 이다.** 격자 셀은 키보드로
 * 접근할 수 없는데(DESIGN.md § Component states 위반), 여기서 그걸 따라 할 이유는 없다.
 * `group-focus-visible` 을 같이 걸어 키보드 포커스에서도 오버레이가 뜬다.
 */
function PickedTile({
  item,
  itemType,
  onRemove,
}: {
  item: PoolItem;
  itemType: TournamentItemType;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`${item.title} 빼기`}
      className="group relative block w-full cursor-pointer rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <PoolItemTile item={item} itemType={itemType} />
      {/*
        딤은 커버 이미지 위에 얹히는 것이라 시맨틱 토큰으로 표현할 수 없다 — 탑스터
        격자 셀이 쓰는 `bg-black/60` 과 같은 값을 쓴다. radius 는 `Card` 의 `rounded-xl`.
      */}
      <span className="absolute inset-0 flex items-center justify-center gap-1 rounded-xl bg-black/60 text-sm font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <X className="size-4" />
        빼기
      </span>
    </button>
  );
}

/**
 * 검색 결과 행의 작은 커버.
 *
 * **`components/common/CoverImage` 를 쓰지 않는다** — 이 행은 `<button>` 안이라
 * 콘텐츠 모델이 phrasing content 다. `CoverImage` 는 `<div>` 라 여기에 넣으면
 * 무효 마크업이 된다. 그래서 같은 모양을 `<span>` 으로 따로 그린다.
 */
function Cover({ item, itemType }: { item: PoolItem; itemType: TournamentItemType }) {
  return (
    <span className="relative size-9 shrink-0 overflow-hidden rounded-md bg-muted">
      {item.coverUrl ? (
        <Image src={item.coverUrl} alt="" fill className="object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center text-muted-foreground">
          <ItemFallbackIcon itemType={itemType} className="size-4" />
        </span>
      )}
    </span>
  );
}

function ResultRow({
  item,
  itemType,
  picked,
  onToggle,
}: {
  item: PoolItem;
  itemType: TournamentItemType;
  picked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={picked}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        picked ? 'bg-primary/15 ring-1 ring-primary ring-inset' : 'hover:bg-accent',
      )}
    >
      <Cover item={item} itemType={itemType} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{item.title}</span>
        <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
      </span>
      {picked ? (
        <Check className="size-4 shrink-0 text-primary" />
      ) : (
        <Plus className="size-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}
