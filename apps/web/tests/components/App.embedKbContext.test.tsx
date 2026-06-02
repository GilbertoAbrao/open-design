// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../src/App';
import type { CreateInput } from '../../src/components/NewProjectPanel';
import type { AppConfig } from '../../src/types';
import {
  fetchComposioConfigFromDaemon,
  loadConfig,
  mergeDaemonConfig,
  saveConfig,
  syncConfigToDaemon,
} from '../../src/state/config';
import {
  daemonIsLive,
  fetchAgents,
  fetchAppVersionInfo,
  fetchDesignSystems,
  fetchPromptTemplates,
  fetchSkills,
} from '../../src/providers/registry';
import { createProject, listProjects, listTemplates } from '../../src/state/projects';

const navigateMock = vi.fn();
const useRouteMock = vi.fn(() => ({ kind: 'home' as const, view: 'home' as const }));

vi.mock('../../src/router', () => ({
  navigate: (...args: unknown[]) => navigateMock(...args),
  useRoute: () => useRouteMock(),
}));

// Drive the real `App.handleCreateProject` through the same prop the live
// EntryView funnels Home submits into (`onCreateProject`). Three buttons mirror
// the three create payloads we assert on: a bare create (embed default should
// apply), and a create that already carries an explicit `customInstructions`
// (the embed default must NOT clobber it).
vi.mock('../../src/components/EntryView', () => ({
  EntryView: ({
    onCreateProject,
  }: {
    onCreateProject: (
      input: CreateInput & { customInstructions?: string },
    ) => Promise<boolean>;
  }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          void onCreateProject({
            name: 'Bare project',
            skillId: null,
            designSystemId: null,
            metadata: { kind: 'prototype' },
          })
        }
      >
        Create bare project
      </button>
      <button
        type="button"
        onClick={() =>
          void onCreateProject({
            name: 'User-instructions project',
            skillId: null,
            designSystemId: null,
            metadata: { kind: 'prototype' },
            customInstructions: 'USER-WINS-456',
          })
        }
      >
        Create with user instructions
      </button>
    </div>
  ),
}));

vi.mock('../../src/components/ProjectView', () => ({
  ProjectView: () => <div>Project view</div>,
}));

vi.mock('../../src/components/pet/PetOverlay', () => ({
  PetOverlay: () => null,
}));

vi.mock('../../src/components/pet/pets', () => ({
  migrateCustomPetAtlas: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../src/components/SettingsDialog', () => ({
  SettingsDialog: () => null,
}));

vi.mock('../../src/providers/registry', async () => {
  const actual = await vi.importActual<typeof import('../../src/providers/registry')>(
    '../../src/providers/registry',
  );
  return {
    ...actual,
    daemonIsLive: vi.fn(),
    fetchAgents: vi.fn(),
    fetchAppVersionInfo: vi.fn(),
    fetchDesignSystems: vi.fn(),
    fetchPromptTemplates: vi.fn(),
    fetchSkills: vi.fn(),
  };
});

vi.mock('../../src/state/projects', async () => {
  const actual = await vi.importActual<typeof import('../../src/state/projects')>(
    '../../src/state/projects',
  );
  return {
    ...actual,
    createProject: vi.fn(),
    listProjects: vi.fn(),
    listTemplates: vi.fn(),
  };
});

vi.mock('../../src/state/config', async () => {
  const actual = await vi.importActual<typeof import('../../src/state/config')>(
    '../../src/state/config',
  );
  return {
    ...actual,
    loadConfig: vi.fn(),
    mergeDaemonConfig: vi.fn(),
    saveConfig: vi.fn(),
    syncConfigToDaemon: vi.fn().mockResolvedValue(undefined),
    fetchComposioConfigFromDaemon: vi.fn().mockResolvedValue(null),
  };
});

const mockedDaemonIsLive = vi.mocked(daemonIsLive);
const mockedFetchAgents = vi.mocked(fetchAgents);
const mockedFetchAppVersionInfo = vi.mocked(fetchAppVersionInfo);
const mockedFetchDesignSystems = vi.mocked(fetchDesignSystems);
const mockedFetchPromptTemplates = vi.mocked(fetchPromptTemplates);
const mockedFetchSkills = vi.mocked(fetchSkills);
const mockedCreateProject = vi.mocked(createProject);
const mockedListProjects = vi.mocked(listProjects);
const mockedListTemplates = vi.mocked(listTemplates);
const mockedFetchComposioConfigFromDaemon = vi.mocked(fetchComposioConfigFromDaemon);
const mockedLoadConfig = vi.mocked(loadConfig);
const mockedMergeDaemonConfig = vi.mocked(mergeDaemonConfig);

const baseConfig: AppConfig = {
  mode: 'api',
  apiKey: '',
  apiProtocol: 'anthropic',
  apiVersion: '',
  baseUrl: 'https://api.anthropic.com',
  model: 'claude-sonnet-4-5',
  apiProviderBaseUrl: 'https://api.anthropic.com',
  apiProtocolConfigs: {},
  agentId: null,
  skillId: null,
  designSystemId: null,
  onboardingCompleted: true,
  mediaProviders: {},
  composio: {},
  agentModels: {},
  agentCliEnv: {},
};

function setEmbedHost(value: boolean) {
  if (value) {
    document.documentElement.setAttribute('data-od-host', 'wxcode');
  } else {
    document.documentElement.removeAttribute('data-od-host');
  }
}

describe('App embed kbContext injection into createProject', () => {
  beforeEach(() => {
    mockedDaemonIsLive.mockResolvedValue(true);
    mockedFetchAgents.mockResolvedValue([]);
    mockedFetchSkills.mockResolvedValue([]);
    mockedFetchDesignSystems.mockResolvedValue([]);
    mockedFetchPromptTemplates.mockResolvedValue([]);
    mockedFetchAppVersionInfo.mockResolvedValue(null);
    mockedListProjects.mockResolvedValue([]);
    mockedListTemplates.mockResolvedValue([]);
    mockedFetchComposioConfigFromDaemon.mockResolvedValue(null);
    mockedMergeDaemonConfig.mockImplementation((local) => local);
    mockedLoadConfig.mockReturnValue({ ...baseConfig });
    // The create flow only reaches the post-create navigation when
    // createProject resolves a project; a minimal id is enough for App's
    // setProjects / navigate continuation.
    mockedCreateProject.mockResolvedValue({
      project: { id: 'proj-created' } as never,
      conversationId: 'conv-1',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }),
    );
    // Clean URL + non-embed host before each test; individual tests opt in.
    window.history.replaceState(null, '', '/');
    setEmbedHost(false);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/');
    setEmbedHost(false);
  });

  it('seeds the kbContext digest as customInstructions on the created project', async () => {
    // The capture is a lazy useRef initializer that reads window.location.search
    // on FIRST render, so the param must be in place BEFORE mount. The presence
    // of the param is the signal now — the embed host no longer gates it, but
    // keep the embed attribute set here since that is the real WXCode case.
    setEmbedHost(true);
    window.history.replaceState(null, '', '/?kbContext=KB-MARKER-123');

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Create bare project' }));

    await waitFor(() => expect(mockedCreateProject).toHaveBeenCalled());
    expect(mockedCreateProject.mock.calls[0]?.[0]).toMatchObject({
      customInstructions: 'KB-MARKER-123',
    });
  });

  it('does not inject customInstructions when no kbContext param is present', async () => {
    // No kbContext in the URL: resolveEmbedKbContext returns null, so the create
    // payload must carry no customInstructions at all. (Only the WXCode shell
    // ever appends kbContext, so a standalone URL never has it.)
    setEmbedHost(false);
    window.history.replaceState(null, '', '/');

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Create bare project' }));

    await waitFor(() => expect(mockedCreateProject).toHaveBeenCalled());
    expect(mockedCreateProject.mock.calls[0]?.[0]).not.toHaveProperty('customInstructions');
  });

  it('lets an explicit caller customInstructions win over the embed default', async () => {
    // A kbContext digest is present, but the caller already provides its own
    // customInstructions — the kbContext default must never clobber it.
    setEmbedHost(true);
    window.history.replaceState(null, '', '/?kbContext=KB-MARKER-123');

    render(<App />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Create with user instructions' }),
    );

    await waitFor(() => expect(mockedCreateProject).toHaveBeenCalled());
    expect(mockedCreateProject.mock.calls[0]?.[0]).toMatchObject({
      customInstructions: 'USER-WINS-456',
    });
  });
});
