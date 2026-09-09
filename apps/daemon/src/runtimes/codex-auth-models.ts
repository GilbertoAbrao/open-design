import type { RuntimeModelOption } from './types.js';
import { execAgentFile } from './invocation.js';

export type CodexAuthMode = 'chatgpt' | null;

const CHATGPT_INCOMPATIBLE_MODEL_IDS = new Set([
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.1',
  'gpt-5',
  'o3',
  'o4-mini',
]);

export function parseCodexLoginStatus(stdout: string): CodexAuthMode {
  const lines = String(stdout || '').split(/\r?\n/);
  return lines.some((line) => /^\s*logged\s+in\s+using\s+chatgpt\s*$/i.test(line))
    ? 'chatgpt'
    : null;
}

export async function probeCodexAuthMode(
  resolvedBin: string,
  env: NodeJS.ProcessEnv,
): Promise<CodexAuthMode> {
  try {
    const { stdout, stderr } = await execAgentFile(resolvedBin, ['login', 'status'], {
      env,
      timeout: 4000,
      maxBuffer: 16 * 1024,
    });
    return parseCodexLoginStatus(`${String(stdout)}\n${String(stderr)}`);
  } catch {
    return null;
  }
}

export function filterCodexModelsForAuth(
  models: RuntimeModelOption[],
  authMode: CodexAuthMode,
): RuntimeModelOption[] {
  if (authMode !== 'chatgpt') return models;
  return models.filter((model) => !CHATGPT_INCOMPATIBLE_MODEL_IDS.has(model.id));
}

export function codexModelCompatibilityError(
  modelId: string | null | undefined,
  authMode: CodexAuthMode,
): string | null {
  if (
    authMode !== 'chatgpt' ||
    typeof modelId !== 'string' ||
    !CHATGPT_INCOMPATIBLE_MODEL_IDS.has(modelId.trim())
  ) {
    return null;
  }
  const model = modelId.trim();
  return `Model "${model}" is not available when Codex is signed in with ChatGPT. Choose a Codex-compatible model, or sign in with an API key account, then retry.`;
}

function codexProviderDetail(raw: string): string {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(trimmed.slice(jsonStart)) as { detail?: unknown };
      if (typeof parsed.detail === 'string' && parsed.detail.trim()) {
        return parsed.detail.trim();
      }
    } catch {
      // Preserve the original text when the provider's JSON is malformed.
    }
  }
  return trimmed;
}

export function formatCodexModelProviderError(raw: string): string {
  if (raw.startsWith('Codex rejected the selected model.')) return raw;
  const detail = codexProviderDetail(raw);
  return `Codex rejected the selected model. Choose a different Codex model or sign in with a different account, then retry. Technical detail: ${detail}`;
}

export function isCodexModelProviderError(raw: string): boolean {
  return (
    /model/i.test(raw) &&
    /not supported/i.test(raw) &&
    /codex/i.test(raw) &&
    /chatgpt\s+account/i.test(raw)
  );
}
