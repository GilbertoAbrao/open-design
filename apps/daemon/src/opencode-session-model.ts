// Read the concrete model an OpenCode run actually used, for usage billing.
//
// OpenCode's `run --format json` stream never reports the model (it only emits
// step_start / text / step_finish frames). The model IS persisted in OpenCode's
// own SQLite database (`<XDG_DATA_HOME>/opencode/opencode.db`), in the `session`
// table's `model` column as JSON: `{"id":"gpt-5.4","providerID":"openai",...}`.
//
// This reads that value, best-effort, given an OpenCode sessionID captured from
// the stream. It is isolated, defensive, and never throws: any failure (db
// missing, schema drift, row absent, malformed JSON) returns null so the usage
// webhook falls back to its other model sources and never breaks the run.

import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * Resolve the path to OpenCode's SQLite db from the daemon's environment. The
 * daemon spawns OpenCode with `XDG_DATA_HOME` set per tenant; OpenCode stores
 * its db at `<XDG_DATA_HOME>/opencode/opencode.db`. Returns null when no data
 * home is configured (desktop installs that don't relocate it are not the
 * billing target — those reads simply fall back).
 */
export function resolveOpencodeDbPath(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const dataHome = typeof env.XDG_DATA_HOME === 'string' ? env.XDG_DATA_HOME.trim() : '';
  if (!dataHome) return null;
  return path.join(dataHome, 'opencode', 'opencode.db');
}

/**
 * Normalize OpenCode's `session.model` JSON into a `provider/model` id that
 * matches the wxcode-adm price table (e.g. `{"id":"gpt-5.4","providerID":
 * "openai"}` -> `openai/gpt-5.4`). Accepts the raw column string. Returns null
 * when it can't produce a non-empty id.
 */
export function parseOpencodeSessionModel(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const rec = obj as Record<string, unknown>;
  const id = typeof rec.id === 'string' ? rec.id.trim() : '';
  if (!id) return null;
  const provider = typeof rec.providerID === 'string' ? rec.providerID.trim() : '';
  return provider ? `${provider}/${id}` : id;
}

/**
 * Read the concrete `provider/model` for an OpenCode session id from OpenCode's
 * SQLite. Best-effort: returns null on any error (no db, no row, schema drift,
 * malformed JSON). Never throws.
 */
export function readOpencodeSessionModel(
  sessionId: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): string | null {
  if (typeof sessionId !== 'string' || !sessionId.trim()) return null;
  const dbPath = resolveOpencodeDbPath(env);
  if (!dbPath) return null;
  let db: { prepare: (sql: string) => { get: (...args: unknown[]) => unknown }; close: () => void } | null =
    null;
  try {
    const Database = require('better-sqlite3');
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const row = db!
      .prepare('SELECT model FROM session WHERE id = ? LIMIT 1')
      .get(sessionId.trim()) as { model?: unknown } | undefined;
    return parseOpencodeSessionModel(row?.model);
  } catch {
    return null;
  } finally {
    try {
      db?.close();
    } catch {
      /* ignore */
    }
  }
}
