import { describe, expect, it } from 'vitest';
import { resolveBasePath } from './basePath';

describe('static deployment base path', () => {
  it('defaults local development and owner sites to the root', () => {
    expect(resolveBasePath(undefined)).toBe('/');
    expect(resolveBasePath('/')).toBe('/');
  });
  it('preserves actual repository and nested deployment paths', () => {
    expect(resolveBasePath('/bugzoo-teach-the-robots/')).toBe(
      '/bugzoo-teach-the-robots/',
    );
    expect(resolveBasePath('/Education/BugZoo.v1/')).toBe('/Education/BugZoo.v1/');
  });
  it('rejects incomplete or ambiguous paths instead of silently breaking assets', () => {
    for (const value of ['', 'repo', '/repo', '//repo/', '/repo//child/', '/repo name/'])
      expect(() => resolveBasePath(value)).toThrow();
  });
  it('rejects traversal and URL or encoded separators', () => {
    for (const value of [
      '/../',
      '/repo/./',
      '/repo/../',
      '/%2f/',
      '/repo\\child/',
      'https://example.com/',
    ])
      expect(() => resolveBasePath(value)).toThrow();
  });
  it('rejects query, fragment, and markup characters', () => {
    for (const value of ['/repo/?x=1', '/repo/#hash', '/<script>/'])
      expect(() => resolveBasePath(value)).toThrow();
  });
});
