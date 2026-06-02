import { describe, it, expect } from 'vitest';
import { resolveEmbedKbContext } from '../../src/components/embed-kb-context';

describe('resolveEmbedKbContext', () => {
  it('decodes the kbContext digest from the search string', () => {
    const digest = 'KB: project Foo uses snake_case & 2-space indent';
    const search = `?kbContext=${encodeURIComponent(digest)}`;
    expect(resolveEmbedKbContext(search)).toBe(digest);
  });

  it('returns null when the param is absent', () => {
    expect(resolveEmbedKbContext('?other=1')).toBeNull();
    expect(resolveEmbedKbContext('')).toBeNull();
  });

  it('treats an empty / whitespace-only digest as absent', () => {
    expect(resolveEmbedKbContext('?kbContext=')).toBeNull();
    expect(resolveEmbedKbContext(`?kbContext=${encodeURIComponent('   ')}`)).toBeNull();
  });

  it('trims surrounding whitespace from the digest', () => {
    const search = `?kbContext=${encodeURIComponent('  trimmed  ')}`;
    expect(resolveEmbedKbContext(search)).toBe('trimmed');
  });

  it('returns null when parsing the search string throws', () => {
    // URLSearchParams throws when the input cannot be coerced to a string
    // (e.g. a Symbol). The parse is wrapped in try/catch and must yield null.
    expect(resolveEmbedKbContext(Symbol('bad') as unknown as string)).toBeNull();
  });
});
