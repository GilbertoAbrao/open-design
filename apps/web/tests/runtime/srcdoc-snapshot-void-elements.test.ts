// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { buildSrcdoc } from '../../src/runtime/srcdoc';

// Regression coverage for the "Could not capture the preview. Try again to
// avoid sending only ink." failure on form-heavy prototypes.
//
// The snapshot bridge (injected by `buildSrcdoc` → `injectSnapshotBridge`)
// clones the document, embeds it inside an `<svg><foreignObject>`, and loads
// that SVG as an `<img>`. An SVG loaded as an image is parsed as **XML**
// (strict), but the bridge serialized the body with `.innerHTML` — HTML
// serialization, which leaves void elements (`<input>`, `<br>`, `<img>`,
// `<hr>`, …) unclosed (`<input ...>` instead of `<input ... />`). XML has no
// void elements, so any such tag makes the SVG malformed → the image fails to
// load → `img.onerror` ("snapshot image failed") → the host shows the capture
// warning. This pins that the embedded markup is well-formed XML so the
// rasterisation can succeed for pages that contain form controls.

function extractSnapshotBridge(srcdoc: string): string {
  const match = srcdoc.match(
    /<script data-od-snapshot-bridge>([\s\S]*?)<\/script>/,
  );
  if (!match || !match[1]) {
    throw new Error('snapshot bridge script not found in srcdoc');
  }
  return match[1];
}

/**
 * Run the snapshot bridge inside a jsdom realm, drive one `od:snapshot`
 * request, and return the SVG data-URL string the bridge would have handed to
 * the rasterising `<img>`. `Image` is stubbed so we capture the markup instead
 * of attempting a (jsdom-unsupported) raster load.
 */
async function captureSnapshotSvg(bodyHtml: string): Promise<string> {
  const srcdoc = buildSrcdoc(
    `<!doctype html><html><body>${bodyHtml}</body></html>`,
  );
  const script = extractSnapshotBridge(srcdoc);

  const dom = new JSDOM(
    `<!doctype html><html><body>${bodyHtml}</body></html>`,
    { runScripts: 'outside-only', pretendToBeVisual: true },
  );
  const win = dom.window as unknown as Window & typeof globalThis;

  Object.defineProperty(win, 'parent', {
    configurable: true,
    value: { postMessage: vi.fn() },
  });

  const captured: string[] = [];
  class StubImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(value: string) {
      captured.push(value);
    }
  }
  Object.defineProperty(win, 'Image', { configurable: true, value: StubImage });

  // jsdom never actually fetches images, so `img.complete` stays false and the
  // bridge's `waitForImages()` would hang. Mark them ready so the snapshot path
  // proceeds — this mirrors a real browser where images have finished loading
  // before the user triggers a capture.
  for (const img of Array.from(win.document.images)) {
    Object.defineProperty(img, 'complete', { configurable: true, get: () => true });
  }

  const evaluate = new win.Function(script);
  evaluate.call(win);

  win.dispatchEvent(
    new win.MessageEvent('message', {
      data: { type: 'od:snapshot', id: 'snap-test' },
    }),
  );

  // waitForImages() resolves a microtask, then renderSnapshot sets img.src.
  await new Promise<void>((resolve) => win.setTimeout(resolve, 10));

  const dataUrl = captured.find((s) => s.startsWith('data:image/svg+xml'));
  if (!dataUrl) throw new Error('snapshot bridge never produced an SVG data URL');
  return dataUrl;
}

function xmlParseError(svgDataUrl: string): string | null {
  const comma = svgDataUrl.indexOf(',');
  const svg = decodeURIComponent(svgDataUrl.slice(comma + 1));
  const parser = new (new JSDOM('').window.DOMParser)();
  const parsed = parser.parseFromString(svg, 'application/xml');
  const err = parsed.querySelector('parsererror');
  return err ? (err.textContent || 'parse error').slice(0, 200) : null;
}

describe('snapshot bridge — void elements stay well-formed XML', () => {
  it('produces well-formed XML for a body containing an <input> (settings form)', async () => {
    const svg = await captureSnapshotSvg(
      '<form><label>Workspace Name<input value="Meridian Inc." /></label><button>Save</button></form>',
    );
    expect(xmlParseError(svg)).toBeNull();
  });

  it('produces well-formed XML for assorted void elements (br/hr/img)', async () => {
    const svg = await captureSnapshotSvg(
      '<section>line one<br>line two<hr><img alt="logo" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" /></section>',
    );
    expect(xmlParseError(svg)).toBeNull();
  });
});
