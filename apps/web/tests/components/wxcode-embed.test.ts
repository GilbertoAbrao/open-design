// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import { isWxcodeEmbedHost } from '../../src/components/wxcode-embed';

// The WXCode Design iframe loads Open Design with embed query params
// (`?source=wxcode&shell=wxcode&wxcodeDesign=1&embed=1&...`). In that sandboxed
// cross-origin iframe the pre-hydration theme script can abort before it sets
// `data-od-host` (a `localStorage` SecurityError throws first), so embed
// detection must also recognize the URL params it was launched with.

afterEach(() => {
  document.documentElement.removeAttribute('data-od-host');
  window.history.replaceState(null, '', '/');
});

describe('isWxcodeEmbedHost', () => {
  it('is true when data-od-host=wxcode is set, with no URL params', () => {
    document.documentElement.setAttribute('data-od-host', 'wxcode');
    expect(isWxcodeEmbedHost()).toBe(true);
  });

  it('is true when the URL carries source=wxcode and no attribute is set', () => {
    window.history.replaceState(null, '', '/?source=wxcode');
    expect(isWxcodeEmbedHost()).toBe(true);
  });

  it('is true when the URL carries shell=wxcode and no attribute is set', () => {
    window.history.replaceState(null, '', '/?shell=wxcode');
    expect(isWxcodeEmbedHost()).toBe(true);
  });

  it('is true when the URL carries embed=1 and no attribute is set', () => {
    window.history.replaceState(null, '', '/?embed=1');
    expect(isWxcodeEmbedHost()).toBe(true);
  });

  it('is true when the URL carries wxcodeDesign=1 and no attribute is set', () => {
    window.history.replaceState(null, '', '/?wxcodeDesign=1');
    expect(isWxcodeEmbedHost()).toBe(true);
  });

  it('is false with no attribute and no embed params', () => {
    window.history.replaceState(null, '', '/?foo=bar');
    expect(isWxcodeEmbedHost()).toBe(false);
  });

  it('is false with no attribute and an empty query string', () => {
    expect(isWxcodeEmbedHost()).toBe(false);
  });
});
