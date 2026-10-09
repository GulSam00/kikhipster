import { describe, expect, it } from 'vitest';

import { albumTypeLabel, stripAlbumSuffix } from '@/lib/domain/album-title';

describe('stripAlbumSuffix', () => {
  it.each([
    ['Love Poem - EP', 'Love Poem'],
    ['Through the Night - Single', 'Through the Night'],
    ['Through the Night – single', 'Through the Night'], // en dash, 대소문자 무시
    ['Hello — EP', 'Hello'], // em dash
  ])('%s → %s', (input, expected) => {
    expect(stripAlbumSuffix(input)).toBe(expected);
  });

  it.each([
    ["NewJeans 2nd EP 'Get Up'"], // 중간 EP 는 이름의 일부다
    ['Sleep'], // 단어 끝이 EP 인 제목
    ['feelslikeimfallinginlove (Single Version)'], // 괄호 표기
    ['Palette'],
  ])('%s 는 건드리지 않는다', (input) => {
    expect(stripAlbumSuffix(input)).toBe(input);
  });
});

describe('albumTypeLabel', () => {
  it('EP 는 두 글자 모두 대문자(CSS capitalize 로는 Ep 가 된다)', () => {
    expect(albumTypeLabel('ep')).toBe('EP');
    expect(albumTypeLabel('single')).toBe('Single');
    expect(albumTypeLabel('album')).toBe('Album');
  });

  it('모르는 값은 원문을 돌려준다', () => {
    expect(albumTypeLabel('compilation')).toBe('compilation');
  });
});
