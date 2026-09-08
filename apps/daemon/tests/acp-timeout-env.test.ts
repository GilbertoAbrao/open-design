import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, vi } from 'vitest';
import { detectAcpModels } from '../src/acp.js';

function writeStallingProbe(): { dir: string; bin: string } {
  const dir = mkdtempSync(join(tmpdir(), 'od-acp-timeout-'));
  const bin = join(dir, 'stall-acp-probe.mjs');
  writeFileSync(
    bin,
    'process.stdin.resume();\nsetTimeout(() => {}, 60_000);\n',
    'utf8',
  );
  chmodSync(bin, 0o755);
  return { dir, bin };
}

function writeDelayedSuccessProbe(delayMs: number): { dir: string; bin: string } {
  const dir = mkdtempSync(join(tmpdir(), 'od-acp-timeout-'));
  const bin = join(dir, 'delayed-acp-probe.mjs');
  writeFileSync(
    bin,
    [
      'process.stdin.setEncoding("utf8");',
      'let buffer = "";',
      'process.stdin.on("data", (chunk) => {',
      '  buffer += chunk;',
      '  for (;;) {',
      '    const idx = buffer.indexOf("\\n");',
      '    if (idx === -1) break;',
      '    const line = buffer.slice(0, idx).trim();',
      '    buffer = buffer.slice(idx + 1);',
      '    if (!line) continue;',
      '    const message = JSON.parse(line);',
      '    setTimeout(() => {',
      '      process.stdout.write(JSON.stringify({ id: message.id, result: message.method === "session/new" ? { sessionId: "s1" } : {} }) + "\\n");',
      `    }, ${delayMs});`,
      '  }',
      '});',
      'process.stdin.resume();',
    ].join('\n'),
    'utf8',
  );
  chmodSync(bin, 0o755);
  return { dir, bin };
}

test('detectAcpModels uses OD_ACP_TIMEOUT_MS from the ACP probe environment', async () => {
  const { dir, bin } = writeStallingProbe();
  try {
    const started = Date.now();
    await assert.rejects(
      detectAcpModels({
        bin: process.execPath,
        args: [bin],
        env: { OD_ACP_TIMEOUT_MS: '123' },
        timeoutMs: 15_000,
      }),
      /ACP model detection timed out after 123ms/,
    );
    assert.ok(
      Date.now() - started < 5_000,
      'expected OD_ACP_TIMEOUT_MS to bound the probe instead of waiting for the 15s caller timeout',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('detectAcpModels ignores invalid OD_ACP_TIMEOUT_MS values', async () => {
  const { dir, bin } = writeStallingProbe();
  try {
    await assert.rejects(
      detectAcpModels({
        bin: process.execPath,
        args: [bin],
        env: { OD_ACP_TIMEOUT_MS: 'not-a-number' },
        timeoutMs: 50,
      }),
      /ACP model detection timed out after 50ms/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('detectAcpModels caps oversized OD_ACP_TIMEOUT_MS values before scheduling timers', async () => {
  vi.useFakeTimers();
  const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
  try {
    const probe = detectAcpModels({
      bin: process.execPath,
      args: ['-e', 'process.stdin.resume()'],
      env: { OD_ACP_TIMEOUT_MS: '10000000000' },
      timeoutMs: 15_000,
    });
    probe.catch(() => {});

    const scheduledDelay = timeoutSpy.mock.calls
      .map((call) => call[1])
      .find((delay) => delay === 24 * 60 * 60 * 1000);

    assert.equal(scheduledDelay, 24 * 60 * 60 * 1000);
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    await assert.rejects(probe, /ACP model detection timed out after 86400000ms/);
  } finally {
    timeoutSpy.mockRestore();
    vi.useRealTimers();
  }
});

test('detectAcpModels treats OD_ACP_TIMEOUT_MS=0 as disabling the ACP probe timeout', async () => {
  const { dir, bin } = writeDelayedSuccessProbe(120);
  try {
    const models = await detectAcpModels({
      bin: process.execPath,
      args: [bin],
      env: { OD_ACP_TIMEOUT_MS: '0' },
      timeoutMs: 50,
    });

    assert.deepEqual(models, [{ id: 'default', label: 'Default (CLI config)' }]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('detectAcpModels strips both telemetry prefixes from the real ACP child environment', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'od-acp-env-'));
  const script = join(dir, 'env-probe.mjs');
  const output = join(dir, 'env-names.json');
  writeFileSync(
    script,
    [
      'import { writeFileSync } from "node:fs";',
      'import { env, stdin, stdout } from "node:process";',
      'writeFileSync(env.OD_ENV_PROBE_OUTPUT, JSON.stringify(Object.keys(env).filter((key) => key.toUpperCase().startsWith("WXCODE_TELEMETRY_") || key.toUpperCase().startsWith("WXCODE_DESIGN_TELEMETRY_"))));',
      'stdin.setEncoding("utf8");',
      'let buffer = "";',
      'stdin.on("data", (chunk) => {',
      '  buffer += chunk;',
      '  for (;;) {',
      '    const index = buffer.indexOf("\\n");',
      '    if (index < 0) break;',
      '    const message = JSON.parse(buffer.slice(0, index));',
      '    buffer = buffer.slice(index + 1);',
      '    const result = message.method === "initialize" ? { protocolVersion: 1 } : { sessionId: "env-probe" };',
      '    stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }) + "\\n");',
      '  }',
      '});',
      'stdin.resume();',
    ].join("\n"),
    'utf8',
  );
  try {
    await detectAcpModels({
      bin: process.execPath,
      args: [script],
      env: {
        OD_ENV_PROBE_OUTPUT: output,
        WXCODE_TELEMETRY_TOKEN: 'chat-token',
        Wxcode_Design_Telemetry_Token: 'design-token',
      },
      timeoutMs: 2_000,
    });
    assert.deepEqual(JSON.parse(readFileSync(output, 'utf8')), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
