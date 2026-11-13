import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOCALE,
  isLocale,
  matchAcceptLanguage,
  resolveLocale,
  withLocaleParam,
} from '@/lib/domain/locale';

describe('isLocale', () => {
  it('ko/en/ja 만 받는다', () => {
    expect(isLocale('ko')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('ja')).toBe(true);
    expect(isLocale('zh')).toBe(false);
    expect(isLocale('en-US')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe('matchAcceptLanguage', () => {
  it('지역 태그를 떼고 맞춘다', () => {
    expect(matchAcceptLanguage('en-US,en;q=0.9')).toBe('en');
    expect(matchAcceptLanguage('ja-JP')).toBe('ja');
  });

  it('지원하지 않는 언어는 건너뛰고 다음 후보를 본다', () => {
    expect(matchAcceptLanguage('zh-CN,zh;q=0.9,ja;q=0.8,en;q=0.7')).toBe('ja');
  });

  it('q 값 순서를 따른다(헤더 순서가 아니라)', () => {
    expect(matchAcceptLanguage('en;q=0.5,ko;q=0.9')).toBe('ko');
  });

  it('q 가 같으면 헤더에 적힌 순서', () => {
    expect(matchAcceptLanguage('ja,en')).toBe('ja');
  });

  it('q=0 은 원하지 않는다는 뜻이라 쓰지 않는다', () => {
    expect(matchAcceptLanguage('en;q=0,fr')).toBeNull();
  });

  it('맞는 게 없거나 헤더가 없으면 null', () => {
    expect(matchAcceptLanguage('fr-FR,de')).toBeNull();
    expect(matchAcceptLanguage('')).toBeNull();
    expect(matchAcceptLanguage(null)).toBeNull();
    expect(matchAcceptLanguage('*')).toBeNull();
  });
});

describe('resolveLocale', () => {
  it('쿠키가 먼저다', () => {
    expect(resolveLocale('ja', 'en-US')).toBe('ja');
  });

  it('쿠키가 없거나 지원 밖이면 Accept-Language', () => {
    expect(resolveLocale(undefined, 'en-US')).toBe('en');
    expect(resolveLocale('zh', 'en-US')).toBe('en');
  });

  it('둘 다 없으면 ko', () => {
    expect(resolveLocale(undefined, null)).toBe(DEFAULT_LOCALE);
    expect(DEFAULT_LOCALE).toBe('ko');
    expect(resolveLocale(undefined, 'fr')).toBe('ko');
  });
});

describe('withLocaleParam', () => {
  it('쿼리가 없으면 ? 로 붙인다', () => {
    expect(withLocaleParam('/api/music/artists/1', 'en')).toBe('/api/music/artists/1?locale=en');
  });

  it('쿼리가 있으면 & 로 붙인다', () => {
    expect(withLocaleParam('/api/music/search/albums?q=iu&limit=20', 'ja')).toBe(
      '/api/music/search/albums?q=iu&limit=20&locale=ja',
    );
  });

  it('이미 locale 이 있으면 그대로 둔다', () => {
    expect(withLocaleParam('/api/music/tracks?ids=1&locale=ko', 'en')).toBe(
      '/api/music/tracks?ids=1&locale=ko',
    );
  });
});
