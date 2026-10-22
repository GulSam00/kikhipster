'use client';

/**
 * React Bits `SplitFlapText` (https://reactbits.dev/r/SplitFlapText-TS-TW.json) 를 고쳐 씀.
 * 의존성 없음 — `react` 만 쓴다.
 *
 * **원본에서 고친 것**
 * 1. **`text` 하나만 줘도 값이 바뀌면 넘어가게 했다.** 원본은 `words` 배열을 타이머로
 *    순환하는 것만 할 줄 알아서, 문구가 하나면 조기 반환하고 타일을 그냥 갈아 끼웠다
 *    — 즉 **값을 바꿔도 아무것도 안 넘어간다.** 자세한 건 아래 구동부 주석에.
 * 2. **effect 본문의 동기 `setTiles` 를 없앴다.** 이 프로젝트는
 *    `react-hooks/set-state-in-effect` 가 error 라 원본 그대로는 `pnpm lint` 가 깨진다
 *    (실제로 확인함). 확정 경로를 `settleTo` 로 묶어 프레임 하나 뒤로 미뤘다.
 * 3. **색 기본값을 토큰으로.** `#111827` / `#f8fafc` 하드코딩 → `var(--secondary)` /
 *    `var(--foreground)`. § Color 의 하드코딩 금지 + 다크 테마 대응.
 * 4. **폰트를 상속으로.** 원본은 전용 monospace 스택을 강제하는데 DESIGN.md § Typography
 *    는 Geist 하나만 쓴다("다른 폰트 도입 안 됨"). Geist 도 `tabular-nums` 가 있어 자릿수는
 *    안 흔들리고, 기계 느낌은 폰트가 아니라 타일의 베벨·이음매·그림자가 낸다.
 *    `font-weight:760` 도 § Typography 에 없는 값이라 `700`(= `font-bold`)으로 내렸다.
 * 5. `role="text"` → `role="img"`. 전자는 Safari 전용이었고 ARIA 명세에 없는 값이다.
 *
 * **손대지 않은 것**: 타일의 베벨·이음매·그림자에 쓰인 흰색/검정 알파값. 이건 브랜드 색이
 * 아니라 재질 음영이라 `--border`(`oklch(1 0 0 / 10%)`)와 같은 성격으로 본다.
 */
import { CSSProperties, HTMLAttributes, useEffect, useMemo, useRef, useState } from 'react';

type TileState = {
  current: string;
  next: string;
  flipping: boolean;
  tick: number;
};

type AnimationPlan = {
  index: number;
  from: string;
  target: string;
  sequence: string[];
  start: number;
  step: number;
  done: boolean;
};

type TileUpdate = {
  index: number;
  current: string;
  next: string;
  done: boolean;
};

export interface SplitFlapTextProps extends HTMLAttributes<HTMLDivElement> {
  words?: string[];
  text?: string;
  flipDuration?: number;
  stagger?: number;
  cycleDelay?: number;
  charset?: 'alpha' | 'alphanumeric' | 'numeric' | (string & {});
  flipsPerChar?: number;
  tileColor?: string;
  textColor?: string;
  tileRadius?: number | string;
  gap?: number | string;
  fontSize?: number | string;
  loop?: boolean;
  padTo?: number;
}

const DEFAULT_WORDS = ['LAUNCH READY', 'SYNC ONLINE', 'SIGNAL LIVE'];

const CHARSETS: Record<string, string> = {
  alpha: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  numeric: '0123456789',
};

const styles = `
.split-flap-text{font-family:inherit;font-size:var(--split-flap-font-size,52px);font-weight:700;line-height:1;letter-spacing:.035em;font-variant-numeric:tabular-nums}
.split-flap-text__tile{position:relative;width:.78em;height:1.08em;overflow:hidden;border-radius:var(--split-flap-radius,8px);background:radial-gradient(circle at 50% 0%,rgba(255,255,255,.16),transparent 44%),linear-gradient(180deg,color-mix(in srgb,var(--split-flap-tile-color,var(--secondary)) 82%,white),var(--split-flap-tile-color,var(--secondary)));box-shadow:0 .035em .08em rgba(255,255,255,.08) inset,0 -.05em .1em rgba(0,0,0,.38) inset,0 .16em .38em rgba(0,0,0,.28);perspective:520px;transform-style:preserve-3d;isolation:isolate}
.split-flap-text__tile:before{content:'';position:absolute;z-index:8;top:calc(50% - .5px);left:0;width:100%;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.18) 18%,rgba(0,0,0,.64) 50%,rgba(255,255,255,.14) 82%,transparent);box-shadow:0 -1px 0 rgba(255,255,255,.08),0 1px 0 rgba(0,0,0,.5);pointer-events:none}
.split-flap-text__tile:after{content:'';position:absolute;inset:0;z-index:9;border:1px solid rgba(255,255,255,.08);border-radius:inherit;box-shadow:0 0 0 1px rgba(0,0,0,.2) inset;pointer-events:none}
.split-flap-text__half,.split-flap-text__flap{position:absolute;left:0;width:100%;height:50%;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.07),transparent 34%),var(--split-flap-tile-color,var(--secondary));backface-visibility:hidden}
.split-flap-text__half--top,.split-flap-text__flap--front{top:0}
.split-flap-text__half--bottom,.split-flap-text__flap--back{bottom:0;background:linear-gradient(0deg,rgba(255,255,255,.06),transparent 38%),color-mix(in srgb,var(--split-flap-tile-color,var(--secondary)) 92%,black)}
.split-flap-text__char{position:absolute;left:0;width:100%;height:200%;display:flex;align-items:center;justify-content:center;color:var(--split-flap-text-color,var(--foreground));text-shadow:0 .025em 0 rgba(255,255,255,.16),0 .09em .16em rgba(0,0,0,.42)}
.split-flap-text__half--top .split-flap-text__char,.split-flap-text__flap--front .split-flap-text__char{top:0}
.split-flap-text__half--bottom .split-flap-text__char,.split-flap-text__flap--back .split-flap-text__char{bottom:0}
.split-flap-text__flap{z-index:6;will-change:transform,filter;transform-style:preserve-3d}
.split-flap-text__flap--front{transform-origin:center bottom;animation:split-flap-front var(--split-flap-flip-duration,.12s) cubic-bezier(.23,1,.32,1) both}
.split-flap-text__flap--back{transform-origin:center top;transform:rotateX(90deg);animation:split-flap-back var(--split-flap-flip-duration,.12s) cubic-bezier(.23,1,.32,1) both}
@keyframes split-flap-front{0%{transform:rotateX(0deg);filter:brightness(1.08)}100%{transform:rotateX(-90deg);filter:brightness(.52)}}
@keyframes split-flap-back{0%,45%{transform:rotateX(90deg);filter:brightness(.58)}100%{transform:rotateX(0deg);filter:brightness(1)}}
@media (prefers-reduced-motion:reduce){.split-flap-text__flap{animation:none!important}}
`;

const toCssUnit = (value: number | string) => (typeof value === 'number' ? `${value}px` : value);

const resolveCharset = (charset: SplitFlapTextProps['charset']) => {
  if (charset && CHARSETS[charset]) return CHARSETS[charset];
  return typeof charset === 'string' && charset.length > 0 ? charset : CHARSETS.alphanumeric;
};

const normalizePhrase = (phrase: string, width: number) => {
  const safe = String(phrase ?? '');
  return safe.padEnd(width, ' ').slice(0, width);
};

const createTiles = (phrase: string): TileState[] =>
  phrase.split('').map((char) => ({
    current: char,
    next: char,
    flipping: false,
    tick: 0,
  }));

const sampleChar = (charset: string) =>
  charset.charAt(Math.floor(Math.random() * charset.length)) || ' ';

const buildSequence = (target: string, flips: number, charset: string) => {
  const steps: string[] = [];
  for (let i = 0; i < flips; i += 1) {
    steps.push(sampleChar(charset));
  }
  steps.push(target);
  return steps;
};

const usePrefersReducedMotion = () => {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setPrefersReduced(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReduced;
};

const SplitFlapText = ({
  words = ['LAUNCH READY', 'SYNC ONLINE', 'SIGNAL LIVE'],
  text,
  flipDuration = 0.12,
  stagger = 0.06,
  cycleDelay = 2400,
  charset = 'alphanumeric',
  flipsPerChar = 8,
  tileColor = 'var(--secondary)',
  textColor = 'var(--foreground)',
  tileRadius = 8,
  gap = 6,
  fontSize = 52,
  loop = true,
  padTo = 12,
  className = '',
  style = {},
  ...props
}: SplitFlapTextProps) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const rafRef = useRef<number | null>(null);
  const cycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTextRef = useRef('');

  const sourceWords = Array.isArray(words) && words.length > 0 ? words : DEFAULT_WORDS;
  const phrasesKey =
    typeof text === 'string' ? text : sourceWords.map((word) => String(word ?? '')).join('\u001f');
  const phrases = useMemo(() => phrasesKey.split('\u001f'), [phrasesKey]);

  const width = useMemo(() => {
    const longest = phrases.reduce((max, phrase) => Math.max(max, phrase.length), 1);
    return Math.max(1, Math.ceil(Number(padTo) || 0), longest);
  }, [padTo, phrases]);

  const normalizedPhrases = useMemo(
    () => phrases.map((phrase) => normalizePhrase(phrase, width)),
    [phrases, width],
  );

  const [tiles, setTiles] = useState<TileState[]>(() => createTiles(normalizedPhrases[0] || ''));

  useEffect(() => {
    const clearAnimation = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      if (cycleTimerRef.current) {
        clearTimeout(cycleTimerRef.current);
        cycleTimerRef.current = null;
      }
    };

    clearAnimation();

    if (typeof window === 'undefined') {
      return clearAnimation;
    }

    let phraseIndex = 0;
    let cancelled = false;

    const safeFlipMs = Math.max(40, (Number(flipDuration) || 0.12) * 1000);
    const safeStaggerMs = Math.max(0, (Number(stagger) || 0) * 1000);
    const safeCycleDelay = Math.max(400, Number(cycleDelay) || 2400);
    const safeFlips = Math.max(0, Math.floor(Number(flipsPerChar) || 0));
    const activeCharset = resolveCharset(charset);

    /*
      애니메이션 없이 값만 확정하는 경로.

      `setTiles` 를 effect 본문에서 곧바로 부르면 이 프로젝트의
      `react-hooks/set-state-in-effect`(error) 에 걸린다. 프레임 하나 뒤로 미뤄
      콜백 안에서 부르면 규칙이 말하는 "외부 시스템 구독의 콜백" 형태가 되고,
      아래 `tick` 이 이미 같은 방식으로 갱신하고 있어 결도 맞는다.
    */
    const settleTo = (targetPhrase: string) => {
      currentTextRef.current = targetPhrase;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (!cancelled) setTiles(createTiles(targetPhrase));
      });
    };

    const animateTo = (targetPhrase: string) => {
      if (prefersReducedMotion) {
        settleTo(targetPhrase);
        return 0;
      }

      const fromPhrase = normalizePhrase(currentTextRef.current, width);
      const targetChars = targetPhrase.split('');

      const plans = targetChars
        .map<AnimationPlan | null>((targetChar, index) => {
          const fromChar = fromPhrase[index] || ' ';
          if (fromChar === targetChar) return null;

          return {
            index,
            from: fromChar,
            target: targetChar,
            sequence: buildSequence(targetChar, safeFlips, activeCharset),
            start: index * safeStaggerMs,
            step: -1,
            done: false,
          };
        })
        .filter((plan): plan is AnimationPlan => plan !== null);

      if (!plans.length) {
        settleTo(targetPhrase);
        return 0;
      }

      const totalDuration = plans.reduce(
        (max, plan) => Math.max(max, plan.start + plan.sequence.length * safeFlipMs),
        0,
      );
      const startedAt = performance.now();

      const updateTiles = (updates: TileUpdate[]) => {
        setTiles((previous) => {
          const nextTiles = [...previous];
          updates.forEach((update) => {
            const tile = nextTiles[update.index];
            if (!tile) return;

            nextTiles[update.index] = {
              current: update.current,
              next: update.next,
              flipping: !update.done,
              tick: tile.tick + 1,
            };
          });
          return nextTiles;
        });
      };

      const tick = (now: number) => {
        if (cancelled) return;

        const elapsed = now - startedAt;
        const updates: TileUpdate[] = [];
        let shouldContinue = false;

        plans.forEach((plan) => {
          const localElapsed = elapsed - plan.start;

          if (localElapsed < 0) {
            shouldContinue = true;
            return;
          }

          const step = Math.floor(localElapsed / safeFlipMs);

          if (step < plan.sequence.length) {
            shouldContinue = true;

            if (step !== plan.step) {
              plan.step = step;
              updates.push({
                index: plan.index,
                current: step === 0 ? plan.from : plan.sequence[step - 1],
                next: plan.sequence[step],
                done: false,
              });
            }
          } else if (!plan.done) {
            plan.done = true;
            updates.push({
              index: plan.index,
              current: plan.target,
              next: plan.target,
              done: true,
            });
          }
        });

        if (updates.length > 0) updateTiles(updates);

        if (shouldContinue) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          currentTextRef.current = targetPhrase;
          rafRef.current = null;
        }
      };

      rafRef.current = requestAnimationFrame(tick);
      return totalDuration;
    };

    const scheduleNext = (delay: number) => {
      /*
        원본은 `window.setTimeout` 이라 `number` 를 돌려주는데 `cycleTimerRef` 는
        `ReturnType<typeof setTimeout>` 이다. `@types/node` 가 들어 있는 프로젝트에서는
        그게 `Timeout` 이라 타입이 안 맞는다(`tsc` 로 확인함). 전역 `setTimeout` 을 쓰면
        ref 타입과 같은 것으로 풀린다.
      */
      cycleTimerRef.current = setTimeout(() => {
        if (cancelled) return;

        const nextIndex = phraseIndex + 1;

        if (nextIndex >= normalizedPhrases.length && !loop) return;

        phraseIndex = nextIndex % normalizedPhrases.length;
        const animationDuration = animateTo(normalizedPhrases[phraseIndex]);
        scheduleNext(safeCycleDelay + animationDuration);
      }, delay);
    };

    /*
      **원본에서 가장 크게 고친 곳.**

      원본은 `words` 배열을 타이머로 순환하는 것만 할 줄 알아서, `text` 하나만 주면
      `normalizedPhrases.length <= 1` 로 조기 반환하고 **아무것도 넘어가지 않는다**
      (값을 바꿔도 타일이 그냥 갈아 끼워진다). 여기서 필요한 건 문구 순환이 아니라
      **값이 바뀔 때 그 자리에서 한 번 넘어가는 계기판**이라, 문구가 하나뿐이면
      지금 걸려 있는 값에서 새 값으로 `animateTo` 를 한 번 돌리도록 바꿨다.

      `animateTo` 는 글자별로 비교해 **달라진 자리만** 넘긴다(`fromChar === targetChar`
      면 계획에서 빠진다). 그래서 `2/4` → `3/4` 는 앞 숫자 한 장만 움직이고 `/` 와
      분모는 걸린 채로 있는다 — 판 전체가 같은 타일이면서 바뀌는 건 하나뿐이다.
    */
    if (normalizedPhrases.length <= 1) {
      animateTo(normalizedPhrases[0] || '');
      return () => {
        cancelled = true;
        clearAnimation();
      };
    }

    scheduleNext(safeCycleDelay);

    return () => {
      cancelled = true;
      clearAnimation();
    };
  }, [
    normalizedPhrases,
    width,
    loop,
    cycleDelay,
    flipDuration,
    stagger,
    flipsPerChar,
    charset,
    prefersReducedMotion,
  ]);

  const settledText = tiles
    .map((tile) => tile.current)
    .join('')
    .trimEnd();
  const componentStyle: CSSProperties & Record<string, string | number | undefined> = {
    '--split-flap-tile-color': tileColor,
    '--split-flap-text-color': textColor,
    '--split-flap-radius': toCssUnit(tileRadius),
    '--split-flap-gap': toCssUnit(gap),
    '--split-flap-font-size': toCssUnit(fontSize),
    '--split-flap-flip-duration': `${Math.max(0.04, Number(flipDuration) || 0.12)}s`,
    ...style,
  };

  return (
    <>
      <style>{styles}</style>
      <div
        className={`split-flap-text inline-flex items-center whitespace-pre select-none ${className}`.trim()}
        style={componentStyle}
        role="img"
        aria-label={settledText || undefined}
        {...props}
      >
        {tiles.map((tile, index) => (
          <span
            className="split-flap-text__tile"
            aria-hidden="true"
            key={`${index}-${tiles.length}`}
          >
            <span className="split-flap-text__half split-flap-text__half--top">
              <span className="split-flap-text__char">
                {tile.current === ' ' ? '\u00A0' : tile.current}
              </span>
            </span>
            <span className="split-flap-text__half split-flap-text__half--bottom">
              <span className="split-flap-text__char">
                {tile.flipping ? tile.next : tile.current}
              </span>
            </span>

            {tile.flipping && (
              <>
                <span
                  className="split-flap-text__flap split-flap-text__flap--front"
                  key={`front-${index}-${tile.tick}`}
                >
                  <span className="split-flap-text__char">
                    {tile.current === ' ' ? '\u00A0' : tile.current}
                  </span>
                </span>
                <span
                  className="split-flap-text__flap split-flap-text__flap--back"
                  key={`back-${index}-${tile.tick}`}
                >
                  <span className="split-flap-text__char">
                    {tile.next === ' ' ? '\u00A0' : tile.next}
                  </span>
                </span>
              </>
            )}
          </span>
        ))}
      </div>
    </>
  );
};

export default SplitFlapText;
