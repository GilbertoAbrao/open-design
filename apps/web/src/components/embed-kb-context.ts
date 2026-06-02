/**
 * WXCode embed KB-context seam.
 *
 * The WXCode shell hands a Knowledge-Base digest to the embedded Open Design
 * home by appending a `kbContext` query param to the iframe `src`. When the
 * user submits a prompt and a project is created, that digest becomes the
 * project's `customInstructions`, which the daemon renders into the agent's
 * system prompt under "## Custom instructions (project-level)" — so the agent
 * is KB-grounded before turn 0 (the briefing).
 *
 * Keep the parse/decision pure and isolated here so the behavior stays
 * additive to upstream (mirrors the `home-plugin-use` / `wxcode-embed` seam
 * style) and is unit-testable without mounting the app.
 */
export function resolveEmbedKbContext(
  search: string,
  opts: { embed: boolean },
): string | null {
  // Only honor the param inside the WXCode iframe; non-embed hosts are
  // unaffected so upstream merges stay clean.
  if (!opts.embed) return null;
  let raw: string | null;
  try {
    raw = new URLSearchParams(search).get('kbContext');
  } catch {
    return null;
  }
  if (raw == null) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}
