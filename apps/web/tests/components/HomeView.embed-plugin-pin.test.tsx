// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_UNSELECTED_SCENARIO_PLUGIN_ID,
  type InstalledPluginRecord,
} from '@open-design/contracts';
import { HomeView } from '../../src/components/HomeView';

// Both plugins must categorize as `prototype` (manifest.od.mode === 'prototype')
// so they survive the embed's `restrictCategory="prototype"` filter on the
// Plugins home section.
function makePrototypePlugin(id: string, title: string): InstalledPluginRecord {
  return {
    id,
    title,
    version: '1.0.0',
    sourceKind: 'bundled',
    source: `/tmp/${id}`,
    trust: 'bundled',
    capabilitiesGranted: ['prompt:inject'],
    fsPath: `/tmp/${id}`,
    installedAt: 0,
    updatedAt: 0,
    manifest: {
      name: id,
      title,
      version: '1.0.0',
      description: `${title} fixture`,
      tags: ['fixture'],
      od: {
        kind: 'scenario',
        taskKind: 'new-generation',
        mode: 'prototype',
        useCase: {
          query: `Hydrated query from ${title}`,
        },
      },
    },
  };
}

const ADMIN_PLUGIN = makePrototypePlugin('admin-dashboard', 'Admin Dashboard');
const WEB_PROTOTYPE_PLUGIN = makePrototypePlugin('example-web-prototype', 'Web Prototype');

// The fixed first prompt the embed auto-sends on confirm. Keep in sync with
// the `embed.usePluginFiredPrompt` i18n key (en value).
const FIRED_PROMPT = 'Create a template based on this plugin.';

function makeFetchMock() {
  return vi.fn<typeof fetch>(async (url) => {
    if (typeof url === 'string' && url === '/api/plugins') {
      return new Response(
        JSON.stringify({ plugins: [ADMIN_PLUGIN, WEB_PROTOTYPE_PLUGIN] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (typeof url === 'string' && url.includes('/apply')) {
      return new Response(
        JSON.stringify({
          ok: true,
          query: 'Hydrated query from Admin Dashboard',
          contextItems: [],
          inputs: [],
          assets: [],
          mcpServers: [],
          appliedPlugin: {
            snapshotId: 'snap-admin-dashboard',
            pluginId: 'admin-dashboard',
            pluginVersion: '1.0.0',
            inputs: {},
            taskKind: 'new-generation',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (typeof url === 'string' && url === '/api/mcp/servers') {
      return new Response(JSON.stringify({ servers: [], templates: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
}

function setEmbedHost(value: boolean) {
  if (value) {
    document.documentElement.setAttribute('data-od-host', 'wxcode');
  } else {
    document.documentElement.removeAttribute('data-od-host');
  }
}

beforeEach(() => {
  // Start every test from a clean, non-embed document so the per-test
  // setEmbedHost(true) is the only thing that flips the host attribute.
  setEmbedHost(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setEmbedHost(false);
});

describe('HomeView embed plugin Use confirms then auto-briefs', () => {
  it('opens a confirmation modal on "Use" instead of immediately pinning + applying', async () => {
    setEmbedHost(true);

    const fetchMock = makeFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const onSubmit = vi.fn();

    render(
      <HomeView
        projects={[]}
        onSubmit={onSubmit}
        onOpenProject={() => undefined}
        onViewAllProjects={() => undefined}
      />,
    );

    const useButton = await screen.findByTestId('plugins-home-use-admin-dashboard');
    fireEvent.click(useButton);

    // The confirmation modal appears...
    expect(await screen.findByTestId('embed-use-confirm')).toBeTruthy();

    // ...and nothing has been applied or submitted yet.
    expect(
      fetchMock.mock.calls.some(([reqUrl]) => String(reqUrl).includes('/apply')),
    ).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('cancel closes the modal with no apply and no submit', async () => {
    setEmbedHost(true);

    const fetchMock = makeFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const onSubmit = vi.fn();

    render(
      <HomeView
        projects={[]}
        onSubmit={onSubmit}
        onOpenProject={() => undefined}
        onViewAllProjects={() => undefined}
      />,
    );

    fireEvent.click(await screen.findByTestId('plugins-home-use-admin-dashboard'));
    expect(await screen.findByTestId('embed-use-confirm')).toBeTruthy();

    fireEvent.click(screen.getByTestId('embed-use-confirm-cancel'));

    await waitFor(() =>
      expect(screen.queryByTestId('embed-use-confirm')).toBeNull(),
    );
    expect(
      fetchMock.mock.calls.some(([reqUrl]) => String(reqUrl).includes('/apply')),
    ).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('confirming applies the plugin and auto-sends the fixed first prompt', async () => {
    setEmbedHost(true);

    const fetchMock = makeFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const onSubmit = vi.fn();

    render(
      <HomeView
        projects={[]}
        onSubmit={onSubmit}
        onOpenProject={() => undefined}
        onViewAllProjects={() => undefined}
      />,
    );

    fireEvent.click(await screen.findByTestId('plugins-home-use-admin-dashboard'));
    fireEvent.click(await screen.findByTestId('embed-use-confirm-ok'));

    // The confirm closes the modal, applies the plugin, and auto-submits the
    // fixed first prompt — no manual typing or send click.
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());

    const payload = onSubmit.mock.calls[0]?.[0];
    // The auto-sent first turn IS the fixed localized prompt.
    expect(payload?.prompt).toBe(FIRED_PROMPT);
    // The pinned plugin carries through as the executable scenario.
    expect(payload?.pluginId).toBe('admin-dashboard');
    expect(payload?.pluginId).not.toBe('example-web-prototype');
    expect(payload?.pluginId).not.toBe(DEFAULT_UNSELECTED_SCENARIO_PLUGIN_ID);
    expect(payload?.appliedPluginSnapshotId).toBe('snap-admin-dashboard');
    expect(payload?.projectKind).toBe('prototype');
    // The pinned plugin is the executable scenario, not an @-context reference.
    expect(payload?.contextPlugins).toEqual([]);

    await waitFor(() =>
      expect(screen.queryByTestId('embed-use-confirm')).toBeNull(),
    );
  });

  it('stages an @-context (not a modal) when "Use"d outside the WXCode embed', async () => {
    // No data-od-host="wxcode": resolvePluginUseMode returns 'context', so the
    // upstream behavior holds — "Use" attaches the plugin as an @-context
    // reference, never opens the embed confirm modal, and never pins it.
    setEmbedHost(false);

    const fetchMock = makeFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const onSubmit = vi.fn();

    render(
      <HomeView
        projects={[]}
        onSubmit={onSubmit}
        onOpenProject={() => undefined}
        onViewAllProjects={() => undefined}
      />,
    );

    const useButton = await screen.findByTestId('plugins-home-use-admin-dashboard');
    fireEvent.click(useButton);

    // No embed confirm modal outside the embed.
    expect(screen.queryByTestId('embed-use-confirm')).toBeNull();

    fireEvent.change(await screen.findByTestId('home-hero-input'), {
      target: { value: 'Build an internal admin dashboard.' },
    });
    fireEvent.click(screen.getByTestId('home-hero-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0]?.[0];
    // Not pinned: pluginId stays the default unselected scenario, never the
    // admin plugin id.
    expect(payload?.pluginId).toBe(DEFAULT_UNSELECTED_SCENARIO_PLUGIN_ID);
    expect(payload?.pluginId).not.toBe('admin-dashboard');
    expect(payload?.appliedPluginSnapshotId).toBeNull();
    // Staged as @-context instead: contextPlugins carries the admin plugin.
    expect(payload?.contextPlugins).toEqual([
      expect.objectContaining({ id: 'admin-dashboard' }),
    ]);
  });
});
