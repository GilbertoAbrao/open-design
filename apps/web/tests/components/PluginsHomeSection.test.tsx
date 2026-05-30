// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InstalledPluginRecord } from '@open-design/contracts';
import { PluginsHomeSection } from '../../src/components/PluginsHomeSection';

function plugin(id: string, mode: string): InstalledPluginRecord {
  return {
    id,
    title: id,
    version: '1.0.0',
    sourceKind: 'builtin',
    source: '/tmp',
    trust: 'trusted',
    capabilitiesGranted: [],
    manifest: {
      name: id,
      version: '1.0.0',
      title: id,
      description: id,
      od: { mode },
    },
  } as unknown as InstalledPluginRecord;
}

const baseProps = {
  loading: false,
  activePluginId: null,
  pendingApplyId: null,
  onUse: vi.fn(),
  onOpenDetails: vi.fn(),
};

afterEach(cleanup);

describe('PluginsHomeSection restrictCategory (WXCode embed)', () => {
  it('collapses the category bar to the single restricted kind', () => {
    render(
      <PluginsHomeSection
        {...baseProps}
        plugins={[plugin('proto-a', 'prototype'), plugin('deck-a', 'deck')]}
        restrictCategory="prototype"
        presetSelection={{ category: 'prototype', subcategory: null }}
      />,
    );

    // Only the Prototype pill survives; Saved, All, and other kinds are gone.
    expect(screen.getByTestId('plugins-home-pill-category-prototype')).toBeTruthy();
    expect(screen.queryByTestId('plugins-home-chip-saved')).toBeNull();
    expect(screen.queryByTestId('plugins-home-pill-category-all')).toBeNull();
    expect(screen.queryByTestId('plugins-home-pill-category-deck')).toBeNull();
  });

  it('keeps the full category bar without restrictCategory', () => {
    render(
      <PluginsHomeSection
        {...baseProps}
        plugins={[plugin('proto-a', 'prototype'), plugin('deck-a', 'deck')]}
        presetSelection={{ category: 'prototype', subcategory: null }}
      />,
    );

    expect(screen.getByTestId('plugins-home-chip-saved')).toBeTruthy();
    expect(screen.getByTestId('plugins-home-pill-category-all')).toBeTruthy();
    expect(screen.getByTestId('plugins-home-pill-category-deck')).toBeTruthy();
  });
});
