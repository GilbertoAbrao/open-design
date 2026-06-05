import type http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { startServer } from '../src/server.js';

describe('WXK project binding routes', () => {
  let server: http.Server;
  let baseUrl: string;
  const tempDirs: string[] = [];

  beforeAll(async () => {
    const started = (await startServer({ port: 0, returnServer: true })) as {
      url: string;
      server: http.Server;
    };
    baseUrl = started.url;
    server = started.server;
  });

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  function makeFolder(): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'od-wxcode-binding-'));
    tempDirs.push(dir);
    return dir;
  }

  async function createProject(projectId: string) {
    const resp = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: projectId,
        name: 'WXK binding fixture',
        skillId: null,
        designSystemId: null,
        metadata: { kind: 'prototype' },
      }),
    });
    expect(resp.status).toBe(200);
    return (await resp.json()) as { project: { id: string } };
  }

  it('persists KB-scoped WXK and Forgejo metadata without changing project files ownership', async () => {
    const projectId = `wxk-binding-${Date.now()}`;
    await createProject(projectId);

    const patchResp = await fetch(`${baseUrl}/api/projects/${projectId}/wxcode-binding`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'tenant-1',
        knowledgeBaseId: 'kb-1',
        designId: 'design-1',
        activePrototypePath: 'prototype',
        git: {
          repositoryUrl: 'https://forgejo.example.test/wxk/kb-design.git',
          repositoryPath: 'wxk/kb-design',
          branch: 'main',
          commitSha: 'abc123',
          status: 'pushed',
          lastSyncedAt: '2026-06-04T20:00:00.000Z',
        },
      }),
    });
    expect(patchResp.status).toBe(200);
    const body = (await patchResp.json()) as {
      project: { metadata?: { wxcode?: Record<string, unknown>; baseDir?: string } };
      resolvedDir: string;
      wxcode: Record<string, unknown>;
    };

    expect(body.project.metadata?.baseDir).toBeUndefined();
    expect(body.wxcode).toEqual({
      tenantId: 'tenant-1',
      knowledgeBaseId: 'kb-1',
      designId: 'design-1',
      activePrototypePath: 'prototype',
      git: {
        provider: 'forgejo',
        repositoryUrl: 'https://forgejo.example.test/wxk/kb-design.git',
        repositoryPath: 'wxk/kb-design',
        branch: 'main',
        commitSha: 'abc123',
        status: 'pushed',
        lastSyncedAt: '2026-06-04T20:00:00.000Z',
      },
    });
    expect(body.project.metadata?.wxcode).toEqual(body.wxcode);
    expect(path.isAbsolute(body.resolvedDir)).toBe(true);
  });

  it('preserves imported-folder baseDir while updating WXK binding metadata', async () => {
    const folder = makeFolder();
    await writeFile(path.join(folder, 'index.html'), '<!doctype html>');
    const importResp = await fetch(`${baseUrl}/api/import/folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseDir: folder, name: 'Forgejo design checkout' }),
    });
    expect(importResp.status).toBe(200);
    const imported = (await importResp.json()) as {
      project: { id: string; metadata?: { baseDir?: string } };
    };
    const baseDir = imported.project.metadata?.baseDir;
    expect(baseDir).toBeTruthy();

    const patchResp = await fetch(`${baseUrl}/api/projects/${imported.project.id}/wxcode-binding`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        knowledgeBaseId: 'kb-imported',
        git: { repositoryPath: 'wxk/imported-design', status: 'linked' },
      }),
    });
    expect(patchResp.status).toBe(200);
    const body = (await patchResp.json()) as {
      project: { metadata?: { baseDir?: string; wxcode?: { knowledgeBaseId?: string } } };
      resolvedDir: string;
    };

    expect(body.project.metadata?.baseDir).toBe(baseDir);
    expect(body.project.metadata?.wxcode?.knowledgeBaseId).toBe('kb-imported');
    expect(body.resolvedDir).toBe(baseDir);
  });

  it('rejects unsafe activePrototypePath values', async () => {
    const projectId = `wxk-binding-bad-path-${Date.now()}`;
    await createProject(projectId);

    const resp = await fetch(`${baseUrl}/api/projects/${projectId}/wxcode-binding`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activePrototypePath: '../outside' }),
    });
    expect(resp.status).toBe(400);
    const body = (await resp.json()) as { error?: { code?: string; message?: string } };
    expect(body.error?.code).toBe('BAD_REQUEST');
    expect(body.error?.message).toMatch(/activePrototypePath/i);
  });

  it('clears individual WXK binding fields with null', async () => {
    const projectId = `wxk-binding-clear-${Date.now()}`;
    await createProject(projectId);
    const seedResp = await fetch(`${baseUrl}/api/projects/${projectId}/wxcode-binding`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        knowledgeBaseId: 'kb-1',
        designId: 'design-1',
        git: { repositoryPath: 'wxk/design', branch: 'main' },
      }),
    });
    expect(seedResp.status).toBe(200);

    const clearResp = await fetch(`${baseUrl}/api/projects/${projectId}/wxcode-binding`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ designId: null, git: null }),
    });
    expect(clearResp.status).toBe(200);
    const body = (await clearResp.json()) as {
      wxcode: { knowledgeBaseId?: string; designId?: string; git?: unknown };
    };

    expect(body.wxcode.knowledgeBaseId).toBe('kb-1');
    expect(body.wxcode.designId).toBeUndefined();
    expect(body.wxcode.git).toBeUndefined();
  });
});
