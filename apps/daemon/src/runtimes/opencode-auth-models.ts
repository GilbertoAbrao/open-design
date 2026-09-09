import { execAgentFile } from './invocation.js';
import type { RuntimeListModels, RuntimeModelOption } from './types.js';

export type OpenCodeAuthMode = 'openai-oauth' | null;

const OPENAI_OAUTH_INCOMPATIBLE_MODEL_IDS = new Set([
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.1',
  'gpt-5',
  'o3',
  'o4-mini',
]);

function stripAnsi(value: string): string {
  return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
}

export function parseOpenCodeAuthList(stdout: string): OpenCodeAuthMode {
  const lines = stripAnsi(String(stdout || '')).split(/\r?\n/);
  return lines.some((line) => /^\s*●\s+OpenAI\s+oauth\s*$/i.test(line))
    ? 'openai-oauth'
    : null;
}

export async function probeOpenCodeAuthMode(
  resolvedBin: string,
  env: NodeJS.ProcessEnv,
): Promise<OpenCodeAuthMode> {
  try {
    const { stdout, stderr } = await execAgentFile(resolvedBin, ['auth', 'list'], {
      env,
      timeout: 4000,
      maxBuffer: 16 * 1024,
    });
    return parseOpenCodeAuthList(`${String(stdout)}\n${String(stderr)}`);
  } catch {
    return null;
  }
}

function normalizedOpenAiModelId(modelId: string): string {
  const normalized = modelId.trim();
  return normalized.startsWith('openai/') ? normalized.slice('openai/'.length) : normalized;
}

function isIncompatibleOpenAiOauthModel(modelId: string): boolean {
  return OPENAI_OAUTH_INCOMPATIBLE_MODEL_IDS.has(normalizedOpenAiModelId(modelId));
}

export function filterOpenCodeModelsForOpenAiOauth(
  models: RuntimeModelOption[],
  authMode: OpenCodeAuthMode,
): RuntimeModelOption[] {
  if (authMode !== 'openai-oauth') return models;
  return models.filter((model) => !isIncompatibleOpenAiOauthModel(model.id));
}

export type OpenCodeModelGuard = {
  authMode: OpenCodeAuthMode;
  liveModels: RuntimeModelOption[] | null;
};

export async function probeOpenCodeModelGuard(
  resolvedBin: string,
  env: NodeJS.ProcessEnv,
  listModels: RuntimeListModels | undefined,
): Promise<OpenCodeModelGuard> {
  const authMode = await probeOpenCodeAuthMode(resolvedBin, env);
  if (!listModels) return { authMode, liveModels: null };
  try {
    const { stdout } = await execAgentFile(resolvedBin, listModels.args, {
      env,
      timeout: listModels.timeoutMs ?? 5000,
      maxBuffer: 8 * 1024 * 1024,
    });
    const liveModels = listModels.parse(String(stdout));
    const hasConcreteModel = liveModels?.some((model) => model.id !== 'default');
    return { authMode, liveModels: hasConcreteModel ? liveModels : null };
  } catch {
    return { authMode, liveModels: null };
  }
}

export function openCodeModelCompatibilityError(
  modelId: string | null | undefined,
  guard: OpenCodeModelGuard,
): string | null {
  if (
    guard.authMode !== 'openai-oauth'
    || !guard.liveModels
    || typeof modelId !== 'string'
    || !modelId.trim()
    || modelId.trim().toLowerCase() === 'default'
  ) return null;

  const model = modelId.trim();
  if (isIncompatibleOpenAiOauthModel(model)) {
    return `Model "${model}" is not available when OpenCode is signed in with OpenAI OAuth. Choose a different OpenCode model or sign in with a different account, then retry.`;
  }
  const normalized = normalizedOpenAiModelId(model);
  const isListed = guard.liveModels.some(
    (candidate) => normalizedOpenAiModelId(candidate.id) === normalized,
  );
  if (isListed) return null;
  return `Model "${model}" is not present in the current OpenCode model catalog for this account. Choose a different OpenCode model or sign in with a different account, then retry.`;
}
