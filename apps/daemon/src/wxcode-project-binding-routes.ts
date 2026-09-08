import type { Express } from 'express';
import type {
  UpdateWxcodeProjectBindingRequest,
  WxcodeDesignGitRef,
  WxcodeDesignGitStatus,
  WxcodeProjectBindingResponse,
  WxcodeProjectMetadata,
} from '@open-design/contracts';
import type { RouteDeps } from './server-context.js';

export interface RegisterWxcodeProjectBindingRoutesDeps
  extends RouteDeps<'db' | 'http' | 'paths' | 'projectStore' | 'projectFiles'> {}

const GIT_STATUSES = new Set<WxcodeDesignGitStatus>([
  'linked',
  'dirty',
  'clean',
  'pushed',
  'pull_requested',
  'merged',
  'conflicted',
]);

type NullablePatch<T> = {
  [K in keyof T]?: T[K] | null;
};

type NormalizedBindingPatch = NullablePatch<Omit<WxcodeProjectMetadata, 'git'>> & {
  git?: NullablePatch<WxcodeDesignGitRef> | null;
};

export function registerWxcodeProjectBindingRoutes(
  app: Express,
  ctx: RegisterWxcodeProjectBindingRoutesDeps,
) {
  const { db } = ctx;
  const { sendApiError } = ctx.http;
  const { PROJECTS_DIR } = ctx.paths;
  const { getProject, updateProject } = ctx.projectStore;
  const { resolveProjectDir } = ctx.projectFiles;

  app.get('/api/projects/:id/wxcode-binding', (req, res) => {
    const project = getProject(db, req.params.id);
    if (!project) {
      return sendApiError(res, 404, 'PROJECT_NOT_FOUND', 'project not found');
    }
    const body: WxcodeProjectBindingResponse = {
      project,
      resolvedDir: resolveProjectDir(PROJECTS_DIR, project.id, project.metadata),
      wxcode: currentWxcodeMetadata(project.metadata),
    };
    res.json(body);
  });

  app.patch('/api/projects/:id/wxcode-binding', (req, res) => {
    const project = getProject(db, req.params.id);
    if (!project) {
      return sendApiError(res, 404, 'PROJECT_NOT_FOUND', 'project not found');
    }

    let patch: NormalizedBindingPatch;
    try {
      patch = normalizeBindingPatch(req.body ?? {});
    } catch (err) {
      return sendApiError(
        res,
        400,
        'BAD_REQUEST',
        err instanceof Error ? err.message : String(err),
      );
    }

    const metadata = project.metadata && typeof project.metadata === 'object'
      ? project.metadata
      : { kind: 'prototype' as const };
    const wxcode = applyBindingPatch(currentWxcodeMetadata(metadata), patch);
    const updated = updateProject(db, project.id, {
      metadata: {
        ...metadata,
        kind: metadata.kind ?? 'prototype',
        wxcode,
      },
    });
    if (!updated) {
      return sendApiError(res, 404, 'PROJECT_NOT_FOUND', 'project not found');
    }

    const body: WxcodeProjectBindingResponse = {
      project: updated,
      resolvedDir: resolveProjectDir(PROJECTS_DIR, updated.id, updated.metadata),
      wxcode,
    };
    res.json(body);
  });
}

function currentWxcodeMetadata(metadata: unknown): WxcodeProjectMetadata {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }
  const wxcode = (metadata as { wxcode?: unknown }).wxcode;
  if (!wxcode || typeof wxcode !== 'object' || Array.isArray(wxcode)) {
    return {};
  }
  return wxcode as WxcodeProjectMetadata;
}

function normalizeBindingPatch(input: UpdateWxcodeProjectBindingRequest): NormalizedBindingPatch {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('request body must be an object');
  }

  const patch: NormalizedBindingPatch = {};
  assignIfPresent(patch, 'tenantId', normalizeOptionalText(input.tenantId, 'tenantId', 128));
  assignIfPresent(patch, 'knowledgeBaseId', normalizeOptionalText(input.knowledgeBaseId, 'knowledgeBaseId', 128));
  assignIfPresent(patch, 'designId', normalizeOptionalText(input.designId, 'designId', 128));
  assignIfPresent(
    patch,
    'activePrototypePath',
    normalizeOptionalRelativePath(input.activePrototypePath, 'activePrototypePath'),
  );
  assignIfPresent(patch, 'git', normalizeGitPatch(input.git));
  return patch;
}

function normalizeGitPatch(input: UpdateWxcodeProjectBindingRequest['git']): NullablePatch<WxcodeDesignGitRef> | null | undefined {
  if (input === undefined) return undefined;
  if (input === null) return null;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('git must be an object or null');
  }

  const provider = input.provider ?? 'forgejo';
  if (provider !== 'forgejo') {
    throw new Error('git.provider must be forgejo');
  }
  const status = normalizeOptionalText(input.status, 'git.status', 64);
  if (status !== undefined && status !== null && !GIT_STATUSES.has(status as WxcodeDesignGitStatus)) {
    throw new Error('git.status is invalid');
  }

  const patch: NullablePatch<WxcodeDesignGitRef> = {};
  assignIfPresent(patch, 'provider', provider);
  assignIfPresent(patch, 'repositoryUrl', normalizeOptionalText(input.repositoryUrl, 'git.repositoryUrl', 2048));
  assignIfPresent(patch, 'repositoryPath', normalizeOptionalText(input.repositoryPath, 'git.repositoryPath', 512));
  assignIfPresent(patch, 'branch', normalizeOptionalText(input.branch, 'git.branch', 256));
  assignIfPresent(patch, 'commitSha', normalizeOptionalText(input.commitSha, 'git.commitSha', 128));
  assignIfPresent(patch, 'pullRequestUrl', normalizeOptionalText(input.pullRequestUrl, 'git.pullRequestUrl', 2048));
  assignIfPresent(patch, 'status', status as WxcodeDesignGitStatus | null | undefined);
  assignIfPresent(patch, 'lastSyncedAt', normalizeOptionalText(input.lastSyncedAt, 'git.lastSyncedAt', 128));
  return patch;
}

function normalizeOptionalText(
  value: string | null | undefined,
  field: string,
  maxLength: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string or null`);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    throw new Error(`${field} exceeds ${maxLength} characters`);
  }
  return trimmed;
}

function normalizeOptionalRelativePath(
  value: string | null | undefined,
  field: string,
): string | null | undefined {
  const text = normalizeOptionalText(value, field, 512);
  if (text === undefined || text === null) return text;
  const normalized = text.replace(/\\/g, '/').replace(/^\/+/, '');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error(`${field} must be a relative project path`);
  }
  return segments.join('/');
}

function applyBindingPatch(
  existing: WxcodeProjectMetadata,
  patch: NormalizedBindingPatch,
): WxcodeProjectMetadata {
  const next: WxcodeProjectMetadata = { ...existing };
  applyNullableField(next, 'tenantId', patch.tenantId);
  applyNullableField(next, 'knowledgeBaseId', patch.knowledgeBaseId);
  applyNullableField(next, 'designId', patch.designId);
  applyNullableField(next, 'activePrototypePath', patch.activePrototypePath);

  if (patch.git === null) {
    delete next.git;
  } else if (patch.git !== undefined) {
    const base = next.git ?? { provider: 'forgejo' as const };
    next.git = applyGitPatch(base, patch.git);
  }

  return next;
}

function assignIfPresent<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | null | undefined,
): void {
  if (value !== undefined) {
    target[key] = value as T[K];
  }
}

function applyNullableField<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | null | undefined,
): void {
  if (value === undefined) return;
  if (value === null) {
    delete target[key];
    return;
  }
  target[key] = value;
}

function applyGitPatch(
  existing: WxcodeDesignGitRef,
  patch: NullablePatch<WxcodeDesignGitRef>,
): WxcodeDesignGitRef {
  const next: WxcodeDesignGitRef = { ...existing, provider: 'forgejo' };
  applyNullableField(next, 'repositoryUrl', patch.repositoryUrl);
  applyNullableField(next, 'repositoryPath', patch.repositoryPath);
  applyNullableField(next, 'branch', patch.branch);
  applyNullableField(next, 'commitSha', patch.commitSha);
  applyNullableField(next, 'pullRequestUrl', patch.pullRequestUrl);
  applyNullableField(next, 'status', patch.status);
  applyNullableField(next, 'lastSyncedAt', patch.lastSyncedAt);
  return next;
}
