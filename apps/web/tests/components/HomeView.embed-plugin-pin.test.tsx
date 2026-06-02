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

describe('HomeView embed plugin Use pins selected plugin', () => {
  it('carries the picked plugin id as pluginId when "Use"d inside the WXCode embed', async () => {
    setEmbedHost(true);

    const fetchMock = vi.fn<typeof fetch>(async (url) => {
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

    // "Use" the admin plugin from the Plugins home section. In the embed this
    // PINS it as the active scenario (usePlugin -> setActive) rather than
    // attaching it as @-context.
    const useButton = await screen.findByTestId('plugins-home-use-admin-dashboard');
    fireEvent.click(useButton);

    // The apply roundtrip resolves the snapshot; submit must then carry the
    // picked plugin id, not the generic example-web-prototype or the unselected
    // default.
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([reqUrl]) => String(reqUrl).includes('/apply')),
      ).toBe(true),
    );

    fireEvent.change(await screen.findByTestId('home-hero-input'), {
      target: { value: 'Build an internal admin dashboard.' },
    });
    fireEvent.click(screen.getByTestId('home-hero-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0]?.[0];
    expect(payload?.pluginId).toBe('admin-dashboard');
    expect(payload?.pluginId).not.toBe('example-web-prototype');
    expect(payload?.pluginId).not.toBe(DEFAULT_UNSELECTED_SCENARIO_PLUGIN_ID);
    expect(payload?.appliedPluginSnapshotId).toBe('snap-admin-dashboard');
    // The pinned plugin is the executable scenario, not an @-context reference.
    expect(payload?.contextPlugins).toEqual([]);
  });

  it('stages an @-context (not a pin) when "Use"d outside the WXCode embed', async () => {
    // No data-od-host="wxcode": resolvePluginUseMode returns 'context', so the
    // upstream behavior holds — "Use" attaches the plugin as an @-context
    // reference and never pins it as the executable scenario.
    setEmbedHost(false);

    const fetchMock = vi.fn<typeof fetch>(async (url) => {
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

    // Same "Use" button as the embed test, but without the embed host the
    // click attaches the admin plugin as @-context instead of pinning it.
    const useButton = await screen.findByTestId('plugins-home-use-admin-dashboard');
    fireEvent.click(useButton);

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
