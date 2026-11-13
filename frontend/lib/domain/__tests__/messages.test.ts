import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';

import en from '@/messages/en.json';
import ja from '@/messages/ja.json';
import ko from '@/messages/ko.json';

/**
 * `ko.json` 이 기준 스키마다. en·ja 가 같은 키 집합을 갖고, 같은 키의 ICU 인자 이름이
 * 같은지 본다. (en·ja 의 **누락** 키는 `i18n/messages.ts` 의 타입이 `tsc` 에서도 잡는다 —
 * 여기서는 반대 방향인 **여분** 키와 인자 이름 차이까지 잡는다.)
 */
type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      out.set(path, value);
    } else {
      for (const [k, v] of flatten(value, path)) out.set(k, v);
    }
  }
  return out;
}

/**
 * 메시지의 ICU 인자 이름. `{count, plural, one {...} other {...}}` 의 가지 안쪽 텍스트는
 * 인자가 아니므로 중괄호 깊이 1 에서 시작하는 이름만 센다(`#` 는 인자가 아니다).
 */
function argNames(message: string): string[] {
  const names = new Set<string>();
  let depth = 0;
  for (let i = 0; i < message.length; i++) {
    const ch = message[i];
    if (ch === '{') {
      depth++;
      // 깊이 1 은 최상위 인자, 깊이 3 은 plural/select 가지 안의 중첩 인자.
      if (depth % 2 === 1) {
        const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)/.exec(message.slice(i + 1));
        if (m) names.add(m[1]);
      }
    } else if (ch === '}') {
      depth--;
    }
  }
  return [...names].sort();
}

const base = flatten(ko);

describe.each([
  ['ko', ko],
  ['en', en],
  ['ja', ja],
] as const)('%s 메시지', (_, messages) => {
  const target = flatten(messages);

  it('ko 와 키 집합이 같다', () => {
    const missing = [...base.keys()].filter((k) => !target.has(k));
    const extra = [...target.keys()].filter((k) => !base.has(k));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it('빈 문자열이 없다', () => {
    const empty = [...target].filter(([, v]) => v.trim() === '').map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it('모든 메시지가 ICU 로 포맷되고 인자가 빠짐없이 채워진다', () => {
    // `'{name}'` 처럼 작은따옴표를 홑으로 쓰면 ICU 가 중괄호를 문자 그대로 내보낸다 —
    // 그런 메시지는 `{` 가 남는다. 작은따옴표 자체를 보이려면 `''` 로 쓴다.
    const broken: string[] = [];
    for (const [key, message] of target) {
      const values = Object.fromEntries(argNames(message).map((n) => [n, 1]));
      const t = createTranslator({
        locale: 'en',
        messages: { m: message },
        // 기본 onError 는 콘솔에만 찍고 대체 문자열을 돌려줘서 깨진 메시지가 통과한다.
        onError: (error) => {
          throw error;
        },
      });
      let out: string;
      try {
        out = t('m', values);
      } catch {
        broken.push(key);
        continue;
      }
      if (out.includes('{') || out.includes('}')) broken.push(key);
    }
    expect(broken).toEqual([]);
  });

  it('같은 키의 ICU 인자 이름이 ko 와 같다', () => {
    const diff = [...base]
      .filter(([k]) => target.has(k))
      .filter(([k, v]) => argNames(v).join() !== argNames(target.get(k) ?? '').join())
      .map(([k]) => k);
    expect(diff).toEqual([]);
  });
});
