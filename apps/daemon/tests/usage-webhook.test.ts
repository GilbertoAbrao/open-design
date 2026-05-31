import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildUsageWebhookPayload,
  sendUsageWebhook,
  emitUsageWebhook,
  type FetchLike,
} from '../src/usage-webhook.js';

afterEach(() => {
  delete process.env.OD_USAGE_WEBHOOK_URL;
  delete process.env.OD_USAGE_WEBHOOK_SECRET;
  vi.restoreAllMocks();
});

describe('buildUsageWebhookPayload', () => {
  it('maps every field for a chat run', () => {
    const payload = buildUsageWebhookPayload({
      runId: 'run_1',
      conversationId: 'conv_1',
      projectId: 'proj_1',
      isDesignSystemRun: false,
      model: 'claude-sonnet-4',
      designSystemId: null,
      inputTokens: 100,
      outputTokens: 25,
      startedAt: 1_700_000_000_000,
      endedAt: 1_700_000_005_000,
    });
    expect(payload).toEqual({
      runId: 'run_1',
      conversationId: 'conv_1',
      projectId: 'proj_1',
      area: 'chat_panel',
      model: 'claude-sonnet-4',
      designSystemId: null,
      inputTokens: 100,
      outputTokens: 25,
      totalTokens: 125,
      startedAt: new Date(1_700_000_000_000).toISOString(),
      endedAt: new Date(1_700_000_005_000).toISOString(),
    });
  });

  it('uses design_system_generation area for DS runs and carries designSystemId', () => {
    const payload = buildUsageWebhookPayload({
      runId: 'run_2',
      conversationId: 'conv_2',
      projectId: null,
      isDesignSystemRun: true,
      model: null,
      designSystemId: 'ds_42',
      inputTokens: 10,
      outputTokens: 0,
    });
    expect(payload?.area).toBe('design_system_generation');
    expect(payload?.designSystemId).toBe('ds_42');
    expect(payload?.projectId).toBeNull();
    expect(payload?.model).toBeNull();
    expect(payload?.startedAt).toBeNull();
    expect(payload?.endedAt).toBeNull();
    expect(payload?.totalTokens).toBe(10);
  });

  it('returns null when both token counts are absent', () => {
    expect(
      buildUsageWebhookPayload({ runId: 'r', conversationId: 'c' }),
    ).toBeNull();
  });

  it('returns null when both token counts are zero', () => {
    expect(
      buildUsageWebhookPayload({
        runId: 'r',
        conversationId: 'c',
        inputTokens: 0,
        outputTokens: 0,
      }),
    ).toBeNull();
  });

  it('emits a payload when only one token side is positive', () => {
    const inOnly = buildUsageWebhookPayload({
      runId: 'r',
      conversationId: 'c',
      inputTokens: 5,
      outputTokens: 0,
    });
    expect(inOnly).not.toBeNull();
    expect(inOnly?.inputTokens).toBe(5);
    expect(inOnly?.outputTokens).toBe(0);
    expect(inOnly?.totalTokens).toBe(5);

    const outOnly = buildUsageWebhookPayload({
      runId: 'r',
      conversationId: 'c',
      inputTokens: 0,
      outputTokens: 7,
    });
    expect(outOnly?.totalTokens).toBe(7);
  });

  it('coerces negative / non-finite token counts to zero', () => {
    const payload = buildUsageWebhookPayload({
      runId: 'r',
      conversationId: 'c',
      inputTokens: -3,
      outputTokens: 12.6,
    });
    // input clamps to 0, output rounds to 13 -> still billable
    expect(payload?.inputTokens).toBe(0);
    expect(payload?.outputTokens).toBe(13);
    expect(payload?.totalTokens).toBe(13);
  });

  it('normalizes blank conversationId to empty string', () => {
    const payload = buildUsageWebhookPayload({
      runId: 'r',
      conversationId: null,
      inputTokens: 1,
      outputTokens: 1,
    });
    expect(payload?.conversationId).toBe('');
  });
});

describe('sendUsageWebhook', () => {
  const samplePayload = buildUsageWebhookPayload({
    runId: 'run_1',
    conversationId: 'conv_1',
    projectId: 'proj_1',
    inputTokens: 10,
    outputTokens: 5,
  })!;

  it('POSTs to the URL with the secret header and JSON body', async () => {
    const calls: Array<{ url: string; init: any }> = [];
    const fetchImpl: FetchLike = async (url, init) => {
      calls.push({ url, init });
      return { ok: true };
    };

    const result = await sendUsageWebhook(samplePayload, {
      url: 'https://collector.example/usage',
      secret: 'sek',
      fetchImpl,
    });

    expect(result).toBe(true);
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe('https://collector.example/usage');
    expect(call.init.method).toBe('POST');
    expect(call.init.headers['X-OD-Usage-Secret']).toBe('sek');
    expect(call.init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(call.init.body)).toEqual(samplePayload);
    expect(call.init.signal).toBeInstanceOf(AbortSignal);
  });

  it('omits the secret header when no secret is configured', async () => {
    let captured: any = null;
    const fetchImpl: FetchLike = async (_url, init) => {
      captured = init;
      return {};
    };
    await sendUsageWebhook(samplePayload, {
      url: 'https://collector.example/usage',
      fetchImpl,
    });
    expect(captured.headers['X-OD-Usage-Secret']).toBeUndefined();
  });

  it('does not call fetch when the URL is unset/empty', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => ({}));
    const r1 = await sendUsageWebhook(samplePayload, { url: '', fetchImpl });
    const r2 = await sendUsageWebhook(samplePayload, { url: null, fetchImpl });
    const r3 = await sendUsageWebhook(samplePayload, { url: undefined, fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect([r1, r2, r3]).toEqual([false, false, false]);
  });

  it('does not call fetch when the payload is null (skip-on-zero)', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => ({}));
    const result = await sendUsageWebhook(null, {
      url: 'https://collector.example/usage',
      fetchImpl,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('swallows a fetch rejection without throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchImpl: FetchLike = async () => {
      throw new Error('network down');
    };
    let result: boolean | undefined;
    await expect(
      (async () => {
        result = await sendUsageWebhook(samplePayload, {
          url: 'https://collector.example/usage',
          fetchImpl,
        });
      })(),
    ).resolves.toBeUndefined();
    expect(result).toBe(false);
    expect(warn).toHaveBeenCalled();
  });
});

describe('emitUsageWebhook', () => {
  const inputs = {
    runId: 'run_1',
    conversationId: 'conv_1',
    projectId: 'proj_1',
    inputTokens: 10,
    outputTokens: 5,
  };

  it('reads the URL/secret from env and fires (not gated by prefs)', async () => {
    process.env.OD_USAGE_WEBHOOK_URL = 'https://collector.example/usage';
    process.env.OD_USAGE_WEBHOOK_SECRET = 'env-secret';
    let captured: any = null;
    const fetchImpl: FetchLike = async (url, init) => {
      captured = { url, init };
      return {};
    };
    const result = await emitUsageWebhook(inputs, { fetchImpl });
    expect(result).toBe(true);
    expect(captured.url).toBe('https://collector.example/usage');
    expect(captured.init.headers['X-OD-Usage-Secret']).toBe('env-secret');
  });

  it('does nothing when OD_USAGE_WEBHOOK_URL is unset', async () => {
    delete process.env.OD_USAGE_WEBHOOK_URL;
    const fetchImpl = vi.fn<FetchLike>(async () => ({}));
    const result = await emitUsageWebhook(inputs, { fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('skips the POST when usage is zero even with URL set', async () => {
    process.env.OD_USAGE_WEBHOOK_URL = 'https://collector.example/usage';
    const fetchImpl = vi.fn<FetchLike>(async () => ({}));
    const result = await emitUsageWebhook(
      { runId: 'r', conversationId: 'c', inputTokens: 0, outputTokens: 0 },
      { fetchImpl },
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('never throws even if the fetch impl rejects', async () => {
    process.env.OD_USAGE_WEBHOOK_URL = 'https://collector.example/usage';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchImpl: FetchLike = async () => {
      throw new Error('boom');
    };
    await expect(emitUsageWebhook(inputs, { fetchImpl })).resolves.toBe(false);
  });
});
