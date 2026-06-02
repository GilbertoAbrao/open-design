import { describe, it, expect } from 'vitest';
import { resolveEmbedKbContext } from '../../src/components/embed-kb-context';

describe('resolveEmbedKbContext', () => {
  it('decodes the kbContext digest inside the WXCode embed', () => {
    const digest = 'KB: project Foo uses snake_case & 2-space indent';
    const search = `?kbContext=${encodeURIComponent(digest)}`;
    expect(resolveEmbedKbContext(search, { embed: true })).toBe(digest);
  });

  it('ignores kbContext outside the embed', () => {
    const search = `?kbContext=${encodeURIComponent('KB digest')}`;
    expect(resolveEmbedKbContext(search, { embed: false })).toBeNull();
  });

  it('returns null when the param is absent', () => {
    expect(resolveEmbedKbContext('?other=1', { embed: true })).toBeNull();
    expect(resolveEmbedKbContext('', { embed: true })).toBeNull();
  });

  it('treats an empty / whitespace-only digest as absent', () => {
    expect(resolveEmbedKbContext('?kbContext=', { embed: true })).toBeNull();
    expect(
      resolveEmbedKbContext(`?kbContext=${encodeURIComponent('   ')}`, { embed: true }),
    ).toBeNull();
  });

  it('trims surrounding whitespace from the digest', () => {
    const search = `?kbContext=${encodeURIComponent('  trimmed  ')}`;
    expect(resolveEmbedKbContext(search, { embed: true })).toBe('trimmed');
  });
});
