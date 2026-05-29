// WXCode embed seam helpers.
//
// These exist to keep the fork's WXCode-embed customizations *additive* against
// upstream churn in FileViewer. Upstream owns the inner preview heuristics and
// the iframe element; the fork only needs to override two derived values when an
// external (WXCode) preview URL is active. By funnelling those overrides through
// helpers, the call sites stay one-token / disjoint from the upstream-owned
// lines, so once this shape lands in a merge base future upstream edits to the
// surrounding code merge cleanly instead of colliding with inline fork logic.

const WXCODE_EXTERNAL_PREVIEW_SANDBOX =
  'allow-scripts allow-forms allow-popups allow-downloads allow-same-origin';
const DEFAULT_PREVIEW_SANDBOX = 'allow-scripts allow-downloads';

/**
 * True when Open Design is running inside the WXCode Design iframe. Keep host
 * checks in this seam so WXCode-only behavior remains additive to upstream.
 */
export function isWxcodeEmbedHost(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-od-host') === 'wxcode'
  );
}

/**
 * WXCode exposes Open Design projects as reusable Design prototypes. Keep the
 * upstream label unchanged outside the WXCode iframe.
 */
export function wxcodeProjectsLabel(defaultLabel: string): string {
  return isWxcodeEmbedHost() ? 'Prototypes' : defaultLabel;
}

/**
 * Sandbox attribute for the URL-load preview iframe. An external WXCode preview
 * is a trusted same-origin app surface that needs forms/popups/same-origin;
 * everything else keeps the locked-down default. Returning a constant string
 * keeps the JSX `sandbox={...}` a single token in every iframe branch.
 */
export function wxcodePreviewSandbox(externalPreviewBaseUrl: string | null | undefined): string {
  return externalPreviewBaseUrl ? WXCODE_EXTERNAL_PREVIEW_SANDBOX : DEFAULT_PREVIEW_SANDBOX;
}

/**
 * Decide the URL-load transport. When an external WXCode preview URL is active
 * the transport is driven purely by preview mode (the external app cannot use
 * the srcDoc bridges). Otherwise defer to upstream's `fallback` heuristic.
 *
 * `fallback` is passed pre-computed (rather than as a thunk) so the upstream
 * `shouldUrlLoadHtmlPreview({...})` call stays verbatim on its own lines at the
 * call site; the predicate is pure, so eager evaluation has no side effects.
 */
export function resolveWxcodeUrlLoadPreview(
  externalPreviewBaseUrl: string | null | undefined,
  isPreviewMode: boolean,
  fallback: boolean,
): boolean {
  return externalPreviewBaseUrl ? isPreviewMode : fallback;
}
