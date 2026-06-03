// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  InstalledPluginRecord,
  PluginSourceKind,
  TrustTier,
} from '@open-design/contracts';

import { HomeHero } from '../../src/components/HomeHero';

// A `prototype`-chip example plugin. `pluginMatchesExampleChip` keys on the
// `prototype` slug (here carried via the `prototype` tag) and the welcome preset
// filter requires a non-empty `od.useCase.query`, so this fixture surfaces as a
// welcome plugin preset card in the non-embed host. `extraTags` lets a test add
// the curated `wxcode-plugin` tag (or withhold it) while keeping the chip match.
function makePrototypePlugin(
  id: string,
  extraTags: string[],
  sourceKind: PluginSourceKind = 'bundled',
  trust: TrustTier = 'bundled',
): InstalledPluginRecord {
  return {
    id,
    title: id,
    version: '1.0.0',
    sourceKind,
    source: '/tmp',
    trust,
    capabilitiesGranted: ['prompt:inject'],
    manifest: {
      name: id,
      version: '1.0.0',
      title: id,
      description: 'A prototype plugin fixture',
      tags: ['prototype', ...extraTags],
      od: {
        useCase: {
          query: 'Build a landing page prototype',
        },
      },
    },
    fsPath: '/tmp',
    installedAt: 0,
    updatedAt: 0,
  };
}

function renderHeroWithPlugins(plugins: InstalledPluginRecord[]) {
  return render(
    <HomeHero
      prompt=""
      onPromptChange={() => undefined}
      onSubmit={() => undefined}
      activePluginTitle={null}
      activeChipId="prototype"
      onClearActivePlugin={() => undefined}
      pluginOptions={plugins}
      pluginsLoading={false}
      pendingPluginId={null}
      pendingChipId={null}
      onPickPlugin={() => undefined}
      onPickChip={() => undefined}
      contextItemCount={0}
      error={null}
    />,
  );
}

function renderedPresetPluginIds(): string[] {
  return screen
    .queryAllByTestId('home-hero-plugin-preset')
    .map((node) => node.getAttribute('data-plugin-id') ?? '')
    .filter(Boolean);
}

describe('HomeHero welcome plugin filter in the WXCode embed', () => {
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute('data-od-host');
  });

  it('lists only wxcode-plugin-tagged plugins inside the WXCode embed', () => {
    document.documentElement.setAttribute('data-od-host', 'wxcode');
    renderHeroWithPlugins([
      makePrototypePlugin('prototype-curated', ['wxcode-plugin']),
      makePrototypePlugin('prototype-upstream', ['fixture']),
    ]);

    const ids = renderedPresetPluginIds();
    expect(ids).toContain('prototype-curated');
    expect(ids).not.toContain('prototype-upstream');
  });

  it('lists all matching plugins outside the WXCode embed', () => {
    renderHeroWithPlugins([
      makePrototypePlugin('prototype-curated', ['wxcode-plugin']),
      makePrototypePlugin('prototype-upstream', ['fixture']),
    ]);

    const ids = renderedPresetPluginIds();
    expect(ids).toContain('prototype-curated');
    expect(ids).toContain('prototype-upstream');
  });
});
