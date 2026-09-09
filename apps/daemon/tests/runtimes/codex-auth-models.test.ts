import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/runtimes/invocation.js', () => ({
  execAgentFile: vi.fn(),
}));

import { execAgentFile } from '../../src/runtimes/invocation.js';
import {
  codexModelCompatibilityError,
  filterCodexModelsForAuth,
  formatCodexModelProviderError,
  isCodexModelProviderError,
  parseCodexLoginStatus,
  probeCodexAuthMode,
  type CodexAuthMode,
} from '../../src/runtimes/codex-auth-models.js';
import type { RuntimeModelOption } from '../../src/runtimes/types.js';

const CHATGPT_INCOMPATIBLE_IDS = [
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.1',
  'gpt-5',
  'o3',
  'o4-mini',
] as const;

function options(ids: readonly string[]): RuntimeModelOption[] {
  return ids.map((id) => ({ id, label: `label:${id}` }));
}

describe('Codex auth-aware model policy', () => {
  afterEach(() => {
    vi.mocked(execAgentFile).mockReset();
  });

  it.each(['fallback', 'live'])('filters exactly the ChatGPT-incompatible ids from a %s catalog', () => {
    const input = options([
      'default',
      ...CHATGPT_INCOMPATIBLE_IDS,
      'gpt-5.3-codex',
      'gpt-5.1-codex-mini',
      'gpt-5-codex',
      'custom-preview',
    ]);

    expect(filterCodexModelsForAuth(input, 'chatgpt' satisfies CodexAuthMode)).toEqual(
      options([
        'default',
        'gpt-5.3-codex',
        'gpt-5.1-codex-mini',
        'gpt-5-codex',
        'custom-preview',
      ]),
    );
  });

  it.each([
    ['API key', 'Logged in using an API key'],
    ['unknown output', 'Session active'],
  ])('fails open without filtering for %s login status', (_label, stdout) => {
    const input = options(['default', ...CHATGPT_INCOMPATIBLE_IDS, 'gpt-5.3-codex']);

    expect(parseCodexLoginStatus(stdout)).toBeNull();
    expect(filterCodexModelsForAuth(input, parseCodexLoginStatus(stdout))).toEqual(input);
  });

  it('recognizes only a whitespace-tolerant, case-insensitive positive ChatGPT login line', async () => {
    vi.mocked(execAgentFile).mockResolvedValue({
      stdout: '  LOGGED   IN USING   CHATGPT  \n',
      stderr: 'ignored diagnostic',
    });

    await expect(probeCodexAuthMode('/bin/codex', { PATH: '/bin' })).resolves.toBe('chatgpt');
    expect(execAgentFile).toHaveBeenCalledWith('/bin/codex', ['login', 'status'], {
      env: { PATH: '/bin' },
      timeout: 4000,
      maxBuffer: 16 * 1024,
    });
  });

  it('recognizes the positive ChatGPT login line when Codex writes status to stderr', async () => {
    vi.mocked(execAgentFile).mockResolvedValue({
      stdout: '',
      stderr: 'Logged in using ChatGPT\n',
    });

    await expect(probeCodexAuthMode('/bin/codex', { PATH: '/bin' })).resolves.toBe('chatgpt');
  });

  it('fails open when the Codex login-status probe fails', async () => {
    vi.mocked(execAgentFile).mockRejectedValue(new Error('timed out'));
    const input = options(['default', ...CHATGPT_INCOMPATIBLE_IDS, 'gpt-5.3-codex']);

    const mode = await probeCodexAuthMode('/bin/codex', { PATH: '/bin' });

    expect(mode).toBeNull();
    expect(filterCodexModelsForAuth(input, mode)).toEqual(input);
  });

  it('returns actionable guidance before a ChatGPT-incompatible Codex model can launch', () => {
    const message = codexModelCompatibilityError('gpt-5.4', 'chatgpt');

    expect(message).toContain('gpt-5.4');
    expect(message).toContain('Choose a Codex-compatible model');
    expect(message).toContain('sign in with an API key');
  });

  it('allows default, Codex-suffixed, and unknown custom models through the ChatGPT guard', () => {
    expect(codexModelCompatibilityError('default', 'chatgpt')).toBeNull();
    expect(codexModelCompatibilityError('gpt-5.3-codex', 'chatgpt')).toBeNull();
    expect(codexModelCompatibilityError('future-custom-model', 'chatgpt')).toBeNull();
  });

  it.each([
    ["The 'gpt-5.4' model is not supported when using Codex with a ChatGPT account."],
    ['Bad Request: {"detail":"The gpt-5.4 model is not supported when using Codex with a ChatGPT account."}'],
  ])('turns Codex provider model rejection into actionable guidance while preserving its detail', (raw) => {
    const message = formatCodexModelProviderError(raw);

    expect(message).toContain('Choose a different Codex model or sign in with a different account');
    expect(message).toContain(
      raw.startsWith('Bad Request:')
        ? 'The gpt-5.4 model is not supported when using Codex with a ChatGPT account.'
        : raw,
    );
    if (raw.startsWith('Bad Request:')) expect(message).not.toContain('Bad Request:');
  });

  it('does not classify a generic model-service outage as a ChatGPT account mismatch', () => {
    expect(isCodexModelProviderError('Model service is temporarily unavailable')).toBe(false);
  });

  it('formats an already-actionable Codex model error idempotently', () => {
    const raw = "The 'gpt-5.4' model is not supported when using Codex with a ChatGPT account.";
    const once = formatCodexModelProviderError(raw);

    expect(formatCodexModelProviderError(once)).toBe(once);
  });
});
