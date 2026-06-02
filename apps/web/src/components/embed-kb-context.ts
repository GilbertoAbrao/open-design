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
 *
 * The `kbContext` param is read unconditionally — no embed-host gate. The
 * WXCode shell is the ONLY source of this param (it appends it to the iframe
 * `src`); a standalone, non-embed Open Design never carries it in its URL, so
 * reading it whenever present is safe. The previous `isWxcodeEmbedHost()` gate
 * was removed because `data-od-host` (what that check reads) is set at runtime
 * and is not guaranteed present at App's FIRST render — the lazy `useRef`
 * initializer that captures this digest ran before the attribute existed, so
 * the gate returned false and the digest was silently dropped. The param's
 * presence is the signal; the host attribute's timing is no longer a factor.
 */
export function resolveEmbedKbContext(search: string): string | null {
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
