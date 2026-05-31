// Per-run usage webhook.
//
// When a chat/design run reaches terminal state and token usage is
// finalized, the daemon POSTs a small JSON payload describing the run's
// billable token usage to a configured URL. This is deliberately
// INDEPENDENT of the telemetry/analytics (PostHog/Langfuse) path: it is
// not gated by user metrics preferences, only by the presence of the
// `OD_USAGE_WEBHOOK_URL` environment variable. The payload contract is
// frozen and consumed by an external collector, so keep field names and
// shapes stable.
//
// The sender is strictly fire-and-forget: a short timeout, all errors
// swallowed, and it never throws into or blocks the run. Run success must
// never depend on this webhook.

/** Minimal fetch surface the sender depends on; injectable for tests. */
export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<unknown>;

/** Raw inputs available at the run-finalization hook point. */
export interface UsageWebhookInputs {
  runId: string;
  conversationId?: string | null;
  projectId?: string | null;
  /** True for design-system generation runs; otherwise a chat-panel run. */
  isDesignSystemRun?: boolean;
  model?: string | null;
  designSystemId?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  /** Epoch millis or ISO string; serialized to ISO8601 (or null). */
  startedAt?: number | string | null;
  /** Epoch millis or ISO string; serialized to ISO8601 (or null). */
  endedAt?: number | string | null;
}

/** Frozen payload contract — an external collector parses this verbatim. */
export interface UsageWebhookPayload {
  runId: string;
  conversationId: string;
  projectId: string | null;
  area: 'design_system_generation' | 'chat_panel' | 'other';
  model: string | null;
  designSystemId: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  startedAt: string | null;
  endedAt: string | null;
}

function toNonNegativeInt(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return value > 0 ? Math.round(value) : 0;
}

function toIso(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

function toStringOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Build the frozen usage payload from hook-point inputs. Pure: no I/O,
 * no env reads. Returns `null` when there is no billable usage (both
 * input and output tokens absent or zero), signalling the caller to skip
 * the POST entirely.
 */
export function buildUsageWebhookPayload(
  inputs: UsageWebhookInputs,
): UsageWebhookPayload | null {
  const inputTokens = toNonNegativeInt(inputs.inputTokens);
  const outputTokens = toNonNegativeInt(inputs.outputTokens);
  if (inputTokens === 0 && outputTokens === 0) return null;

  const area: UsageWebhookPayload['area'] = inputs.isDesignSystemRun
    ? 'design_system_generation'
    : 'chat_panel';

  return {
    runId: String(inputs.runId ?? ''),
    conversationId: toStringOrNull(inputs.conversationId) ?? '',
    projectId: toStringOrNull(inputs.projectId),
    area,
    model: toStringOrNull(inputs.model),
    designSystemId: toStringOrNull(inputs.designSystemId),
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    startedAt: toIso(inputs.startedAt),
    endedAt: toIso(inputs.endedAt),
  };
}

export interface SendUsageWebhookOptions {
  /** Target URL; when empty/unset the send is a no-op. */
  url?: string | null | undefined;
  /** Optional shared secret; sent as `X-OD-Usage-Secret` when present. */
  secret?: string | null | undefined;
  /** Injectable fetch implementation (defaults to global fetch). */
  fetchImpl?: FetchLike | undefined;
  /** Request timeout in milliseconds. */
  timeoutMs?: number | undefined;
}

/**
 * Fire-and-forget usage webhook sender. Resolves to `true` when a POST was
 * attempted and accepted, `false` when it was skipped (no URL, no payload)
 * or swallowed an error. NEVER rejects, NEVER throws, NEVER blocks the
 * run: every failure path is caught and logged via `console.warn`.
 */
export async function sendUsageWebhook(
  payload: UsageWebhookPayload | null,
  options: SendUsageWebhookOptions,
): Promise<boolean> {
  try {
    if (!payload) return false;
    const url = typeof options.url === 'string' ? options.url.trim() : '';
    if (!url) return false;

    const fetchImpl: FetchLike | undefined =
      options.fetchImpl ??
      (typeof fetch === 'function' ? (fetch as unknown as FetchLike) : undefined);
    if (!fetchImpl) return false;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const secret = typeof options.secret === 'string' ? options.secret.trim() : '';
    if (secret) headers['X-OD-Usage-Secret'] = secret;

    const timeoutMs =
      typeof options.timeoutMs === 'number' && options.timeoutMs > 0
        ? options.timeoutMs
        : 2000;

    await fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return true;
  } catch (err) {
    console.warn('[usage-webhook] post failed', err);
    return false;
  }
}

/**
 * Convenience entry used from the run-finalization hook. Reads the target
 * URL/secret from the environment, builds the payload, and fires the
 * webhook — all without ever throwing. Returns the send result for tests.
 */
export async function emitUsageWebhook(
  inputs: UsageWebhookInputs,
  overrides: { fetchImpl?: FetchLike; url?: string | null; secret?: string | null } = {},
): Promise<boolean> {
  try {
    const url =
      overrides.url !== undefined ? overrides.url : process.env.OD_USAGE_WEBHOOK_URL;
    if (!url || !String(url).trim()) return false;
    const secret =
      overrides.secret !== undefined
        ? overrides.secret
        : process.env.OD_USAGE_WEBHOOK_SECRET;
    const payload = buildUsageWebhookPayload(inputs);
    return await sendUsageWebhook(payload, {
      url,
      secret,
      fetchImpl: overrides.fetchImpl,
    });
  } catch (err) {
    console.warn('[usage-webhook] emit failed', err);
    return false;
  }
}

// Expose the hook entry on globalThis so the `@ts-nocheck`, import-free
// `server.ts` can call it as a bare global after a side-effect
// `require('./usage-webhook.js')`, mirroring the `run-artifacts.js` shim
// pattern already used in this package. The named ESM exports above stay
// the canonical surface for unit tests.
Object.assign(globalThis, { emitUsageWebhook });
