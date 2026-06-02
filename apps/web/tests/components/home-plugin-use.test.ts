import { describe, it, expect } from 'vitest';
import { resolvePluginUseMode } from '../../src/components/home-plugin-use';

describe('resolvePluginUseMode', () => {
  it('pins as active in the WXCode embed', () => {
    expect(resolvePluginUseMode({ embed: true })).toBe('pin');
  });
  it('adds as context outside the embed', () => {
    expect(resolvePluginUseMode({ embed: false })).toBe('context');
  });
});
