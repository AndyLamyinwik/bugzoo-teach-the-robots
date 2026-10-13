import { describe, expect, it } from 'vitest';
import { pageMetadata } from './pageMetadata';

describe('bilingual public page metadata', () => {
  it('names all implemented pages in both languages without changing routing', () => {
    const routes = [
      '',
      '#fractionfox',
      '#discountpanda',
      '#minusmole',
      '#chancecrow',
      '#progress',
      '#passport',
    ];
    for (const hash of routes) {
      expect(pageMetadata('en', hash).title).toContain('BugZoo');
      expect(pageMetadata('zh-TW', hash).title).toContain('BugZoo');
      expect(pageMetadata('en', hash).title).not.toBe(pageMetadata('zh-TW', hash).title);
    }
    expect(pageMetadata('en', '#passport').title).toBe('Learning Passport | BugZoo');
    expect(pageMetadata('zh-TW', '#progress').title).toBe('學習進度 | BugZoo');
  });
  it('uses the existing home fallback and content-fragment routes', () => {
    expect(pageMetadata('en', '#unknown')).toEqual(pageMetadata('en', ''));
    expect(pageMetadata('zh-TW', '#fractionfox-content')).toEqual(
      pageMetadata('zh-TW', '#fractionfox'),
    );
  });
  it('describes actual local-only learning and declares both Open Graph languages', () => {
    expect(pageMetadata('en', '').description).toContain('saved only in your browser');
    expect(pageMetadata('zh-TW', '').description).toContain('只保存在你的瀏覽器');
    expect(pageMetadata('en', '').ogLocale).toBe('en_US');
    expect(pageMetadata('en', '').alternateLocale).toBe('zh_TW');
    expect(pageMetadata('zh-TW', '').ogLocale).toBe('zh_TW');
  });
});
