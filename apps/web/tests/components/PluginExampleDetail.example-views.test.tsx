// @vitest-environment jsdom

// Task 2 (feat/wxcode-embed-ux): migrated plugins now ship multiple example
// screens in `od.useCase.exampleOutputs[]` (dashboard / list / form / detail).
// The plugin detail preview must surface ALL of them as switchable tabs, not
// just the single `preview.entry`. This locks the contract:
//
//   - given N exampleOutputs, PluginExampleDetail renders N preview tabs
//     labeled from `title ?? stem`, and switching a tab fetches that
//     specific example by stem (not the generic /preview entry).
//   - given zero exampleOutputs, it falls back to the single /preview view.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InstalledPluginRecord } from '@open-design/contracts';

import { PluginExampleDetail } from '../../src/components/plugin-details/PluginExampleDetail';
import {
  fetchPluginExampleHtml,
  fetchPluginPreviewHtml,
} from '../../src/providers/registry';

vi.mock('../../src/providers/registry', () => ({
  fetchPluginPreviewHtml: vi.fn(async () => ({ html: '<p>preview entry</p>' })),
  fetchPluginExampleHtml: vi.fn(async (_id: string, stem: string) => ({
    html: `<p>example ${stem}</p>`,
  })),
}));

function make(overrides: {
  id: string;
  title?: string;
  mode?: string;
  exampleOutputs?: Array<{ path: string; title?: string }>;
}): InstalledPluginRecord {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    version: '0.1.0',
    sourceKind: 'bundled',
    source: '/tmp',
    trust: 'bundled',
    capabilitiesGranted: [],
    manifest: {
      name: overrides.id,
      version: '0.1.0',
      title: overrides.title ?? overrides.id,
      od: {
        kind: 'scenario',
        ...(overrides.mode ? { mode: overrides.mode } : {}),
        preview: { type: 'html', entry: './index.html' },
        ...(overrides.exampleOutputs
          ? { useCase: { exampleOutputs: overrides.exampleOutputs } }
          : {}),
      },
    },
    fsPath: '/tmp',
    installedAt: 0,
    updatedAt: 0,
  };
}

describe('PluginExampleDetail example-output views', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders one switchable preview tab per exampleOutput, not just the entry', async () => {
    render(
      <PluginExampleDetail
        record={make({
          id: 'migrated-plugin',
          title: 'Migrated Plugin',
          exampleOutputs: [
            { path: 'examples/dashboard/index.html', title: 'Dashboard' },
            { path: 'examples/list/index.html', title: 'List' },
            { path: 'examples/form/index.html', title: 'Form' },
            { path: 'examples/detail/index.html', title: 'Detail' },
          ],
        })}
        onClose={() => {}}
        onUse={() => {}}
      />,
    );

    // The multi-view tab bar must be present with one tab per example.
    const tabs = await waitFor(() => {
      const found = screen.getAllByRole('tab');
      expect(found.length).toBe(4);
      return found;
    });

    const labels = tabs.map((t) => t.textContent);
    expect(labels).toEqual(['Dashboard', 'List', 'Form', 'Detail']);

    // The first example loads by its own stem (NOT the generic /preview entry).
    await waitFor(() => {
      expect(fetchPluginExampleHtml).toHaveBeenCalledWith(
        'migrated-plugin',
        'dashboard',
      );
    });
    expect(fetchPluginPreviewHtml).not.toHaveBeenCalled();

    // Switching tabs fetches that specific example.
    fireEvent.click(screen.getByRole('tab', { name: 'Form' }));
    await waitFor(() => {
      expect(fetchPluginExampleHtml).toHaveBeenCalledWith(
        'migrated-plugin',
        'form',
      );
    });
  });

  it('falls back to a single /preview view when no exampleOutputs are declared', async () => {
    render(
      <PluginExampleDetail
        record={make({ id: 'legacy-plugin', title: 'Legacy Plugin' })}
        onClose={() => {}}
        onUse={() => {}}
      />,
    );

    // No tab bar when there is a single view.
    await waitFor(() => {
      expect(fetchPluginPreviewHtml).toHaveBeenCalledWith('legacy-plugin');
    });
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(fetchPluginExampleHtml).not.toHaveBeenCalled();
  });
});
