// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { InstalledPluginRecord } from '@open-design/contracts';

import { HomeHero } from '../../src/components/HomeHero';

// The `prototype` chip yields four built-in prompt examples and no example
// plugins, so `home-hero-prompt-examples` renders in the non-embed host.
function renderHeroWithPromptExamples() {
  return render(
    <HomeHero
      prompt=""
      onPromptChange={() => undefined}
      onSubmit={() => undefined}
      activePluginTitle={null}
      activeChipId="prototype"
      onClearActivePlugin={() => undefined}
      pluginOptions={[]}
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

describe('HomeHero example prompts in the WXCode embed', () => {
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute('data-od-host');
  });

  it('renders the example-prompts section outside the WXCode embed', () => {
    renderHeroWithPromptExamples();
    expect(screen.queryByTestId('home-hero-prompt-examples')).not.toBeNull();
  });

  it('hides the example-prompts section inside the WXCode embed', () => {
    document.documentElement.setAttribute('data-od-host', 'wxcode');
    renderHeroWithPromptExamples();
    expect(screen.queryByTestId('home-hero-prompt-examples')).toBeNull();
  });
});

// A wxcode-plugin-tagged plugin that matches the `prototype` chip (od.mode →
// 'prototype' slug) and carries a useCase query, so the example-PLUGIN presets
// branch (`home-hero-plugin-presets`) renders outside the embed and survives
// the embed's wxcode-plugin tag filter.
function wxcodePresetPlugin(): InstalledPluginRecord {
  return {
    id: 'wxcode-test-proto',
    title: 'Test Proto Admin',
    version: '1.0.0',
    sourceKind: 'github',
    source: 'github:test',
    trust: 'trusted',
    capabilitiesGranted: [],
    manifest: {
      name: 'wxcode-test-proto',
      version: '1.0.0',
      title: 'Test Proto Admin',
      description: 'Test prototype admin plugin.',
      tags: ['wxcode-plugin'],
      od: { mode: 'prototype', useCase: { query: 'Build a prototype admin dashboard.' } },
    },
  } as unknown as InstalledPluginRecord;
}

function renderHeroWithPluginPresets() {
  return render(
    <HomeHero
      prompt=""
      onPromptChange={() => undefined}
      onSubmit={() => undefined}
      activePluginTitle={null}
      activeChipId="prototype"
      onClearActivePlugin={() => undefined}
      pluginOptions={[wxcodePresetPlugin()]}
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

describe('HomeHero example plugin presets in the WXCode embed', () => {
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute('data-od-host');
  });

  it('renders the plugin-presets section outside the WXCode embed', () => {
    renderHeroWithPluginPresets();
    expect(screen.queryByTestId('home-hero-plugin-presets')).not.toBeNull();
  });

  it('hides the plugin-presets section inside the WXCode embed', () => {
    document.documentElement.setAttribute('data-od-host', 'wxcode');
    renderHeroWithPluginPresets();
    expect(screen.queryByTestId('home-hero-plugin-presets')).toBeNull();
  });
});
