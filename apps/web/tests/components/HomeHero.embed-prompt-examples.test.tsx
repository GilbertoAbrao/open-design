// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

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
