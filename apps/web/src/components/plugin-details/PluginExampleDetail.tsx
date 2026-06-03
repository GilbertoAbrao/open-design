// HTML-preview detail surface for plugins that ship a runnable
// `od.preview` entry or example output (the same surface ExamplesTab
// uses for skill cards). Wraps the shared PreviewModal so the user
// gets the full chrome — sandboxed iframe, Fullscreen, merged Share menu —
// plus a primary
// "Use plugin" action that routes through the home applyPlugin flow.
//
// Migrated plugins ship MULTIPLE example screens in
// `od.useCase.exampleOutputs[]` (dashboard / list / form / detail). We
// surface every one as its own switchable tab via PreviewModal's
// multi-view tab bar, loading each example by its own stem through the
// daemon's `/api/plugins/:id/example/:name` route (which confines the
// requested path to the plugin's own directory). When a plugin declares
// no example outputs we fall back to a single view hitting `/preview`,
// preserving the legacy single-screen behavior.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { InstalledPluginRecord } from '@open-design/contracts';
import { useT } from '../../i18n';
import {
  fetchPluginExampleHtml,
  fetchPluginPreviewHtml,
  type SkillExampleResult,
} from '../../providers/registry';
import { PreviewModal, type PreviewView } from '../PreviewModal';
import { buildPluginShareUrl, PluginShareMenu } from './PluginShareMenu';
import { PluginMetaSections } from './PluginMetaSections';

interface Props {
  record: InstalledPluginRecord;
  /**
   * @deprecated The detail surface now derives its views from the
   * manifest's `od.useCase.exampleOutputs[]`. Retained only so older
   * callers that pin one example still compile; ignored when example
   * outputs are present.
   */
  exampleStem?: string | null;
  onClose: () => void;
  onUse: (record: InstalledPluginRecord) => void;
  isApplying?: boolean;
}

// One switchable preview tab. `stem` is the basename-minus-extension
// the daemon's `/example/:name` route matches on; when null the view
// loads the generic `/preview` entry instead.
interface ExampleViewSpec {
  id: string;
  label: string;
  stem: string | null;
}

// Per-view load state. `html === undefined` means "not yet requested",
// `html === null` means "in flight". `error`/`unavailable` mirror the
// PreviewView discriminants.
interface ViewLoadState {
  html: string | null | undefined;
  error: string | null;
  unavailableKind: string | null;
}

const EMPTY_STATE: ViewLoadState = {
  html: undefined,
  error: null,
  unavailableKind: null,
};

// Derive the daemon-matchable stem for an example output path. Mirrors
// the daemon `/example/:name` matcher: it matches on the basename, the
// basename minus extension, or the parent folder for
// `examples/<name>/index.html` shaped paths. We prefer the parent
// folder in that index-shaped case (so `examples/dashboard/index.html`
// → `dashboard`, not `index`), otherwise the basename stem.
function exampleStemForPath(rawPath: string): string {
  const segments = rawPath.split(/[\\/]/).filter(Boolean);
  const base = segments[segments.length - 1] ?? rawPath;
  const baseStem = base.replace(/\.[^.]+$/, '');
  if (baseStem.toLowerCase() === 'index' && segments.length >= 2) {
    return segments[segments.length - 2] ?? baseStem;
  }
  return baseStem;
}

export function PluginExampleDetail({
  record,
  exampleStem,
  onClose,
  onUse,
  isApplying,
}: Props) {
  const t = useT();
  const isDeck = record.manifest?.od?.mode === 'deck';

  // `useT()` returns a fresh translator identity on every render when no
  // i18n provider is mounted (its fallback builds a new object literal).
  // Keep it out of the `viewSpecs` dependency array so it can't drive an
  // infinite render loop: viewSpecs → onView identity → PreviewModal's
  // onView effect → loadView → setStates → re-render. Capture it in a ref
  // and read the fallback label through that instead.
  const tRef = useRef(t);
  tRef.current = t;

  const exampleOutputs = record.manifest?.od?.useCase?.exampleOutputs;

  // Build the view specs once per record. When the manifest ships
  // example outputs we emit one tab per output; otherwise a single
  // `/preview` view (honoring a legacy pinned `exampleStem` if given).
  const viewSpecs = useMemo<ExampleViewSpec[]>(() => {
    const outputs = (exampleOutputs ?? []) as Array<{
      path?: unknown;
      title?: unknown;
    }>;
    const specs: ExampleViewSpec[] = [];
    const seenIds = new Set<string>();
    for (let i = 0; i < outputs.length; i += 1) {
      const out = outputs[i];
      const path = typeof out?.path === 'string' ? out.path : null;
      if (!path) continue;
      const stem = exampleStemForPath(path);
      // De-duplicate ids so two outputs with the same stem don't collide
      // (the tab key + the matched example stay distinct per tab).
      let id = stem || `example-${i}`;
      while (seenIds.has(id)) id = `${id}-${i}`;
      seenIds.add(id);
      const title = typeof out?.title === 'string' && out.title.length > 0 ? out.title : null;
      specs.push({ id, label: title ?? stem, stem });
    }
    if (specs.length > 0) return specs;
    // Fallback: a single preview view. A legacy pinned `exampleStem`
    // still resolves through the example route; otherwise hit /preview.
    return [
      {
        id: 'preview',
        label: tRef.current('examples.previewLabel'),
        stem: exampleStem ?? null,
      },
    ];
  }, [exampleOutputs, exampleStem]);

  const [states, setStates] = useState<Record<string, ViewLoadState>>({});
  // Guard against overlapping fetches for the same view.
  const inFlightRef = useRef<Set<string>>(new Set());

  const loadView = useCallback(
    async (spec: ExampleViewSpec) => {
      if (inFlightRef.current.has(spec.id)) return;
      inFlightRef.current.add(spec.id);
      setStates((prev) => ({
        ...prev,
        [spec.id]: { html: null, error: null, unavailableKind: null },
      }));
      try {
        const result: SkillExampleResult = spec.stem
          ? await fetchPluginExampleHtml(record.id, spec.stem)
          : await fetchPluginPreviewHtml(record.id);
        setStates((prev) => {
          if ('html' in result) {
            return { ...prev, [spec.id]: { html: result.html, error: null, unavailableKind: null } };
          }
          if ('error' in result) {
            return { ...prev, [spec.id]: { html: undefined, error: result.error, unavailableKind: null } };
          }
          // unavailable: the plugin's manifest declares no shipped
          // preview entry (or the daemon 404s on the requested path —
          // common for bundled plugins like example-live-artifact whose
          // manifest references an example file that doesn't ship).
          // Forward to PreviewModal as a typed unavailable view so it
          // renders the calm "no shipped preview" placeholder instead
          // of the misleading "Couldn't load this example." error. The
          // skill helper has had this treatment since #897; the plugin
          // helper gained it later — keep both consumers in lockstep.
          return { ...prev, [spec.id]: { html: undefined, error: null, unavailableKind: result.kind } };
        });
      } finally {
        inFlightRef.current.delete(spec.id);
      }
    },
    [record.id],
  );

  const specsById = useMemo(() => {
    const map = new Map<string, ExampleViewSpec>();
    for (const spec of viewSpecs) map.set(spec.id, spec);
    return map;
  }, [viewSpecs]);

  // PreviewModal fires onView on mount (with the initial view id) and on
  // every tab switch — lazy-load the requested view's HTML the first
  // time it is shown.
  const onView = useCallback(
    (viewId: string) => {
      const spec = specsById.get(viewId);
      if (!spec) return;
      void loadView(spec);
    },
    [specsById, loadView],
  );

  // Reset cached state when the record changes so a re-opened detail for
  // a different plugin doesn't show a stale view's HTML.
  useEffect(() => {
    setStates({});
    inFlightRef.current = new Set();
  }, [record.id]);

  const description = record.manifest?.description ?? '';

  const views = useMemo<PreviewView[]>(
    () =>
      viewSpecs.map((spec) => {
        const state = states[spec.id] ?? EMPTY_STATE;
        return {
          id: spec.id,
          label: spec.label,
          html: state.html,
          error: state.error,
          // Pass the surface-appropriate noun so the unavailable placeholder
          // reads "this plugin" / "this template" instead of falling back to
          // the legacy skills-only "this skill" copy. Issue #3216.
          unavailable: state.unavailableKind
            ? { kind: state.unavailableKind, noun: isDeck ? 'template' : 'plugin' }
            : null,
          deck: isDeck,
        };
      }),
    [viewSpecs, states, isDeck],
  );

  return (
    <PreviewModal
      title={record.title}
      subtitle={description || undefined}
      views={views}
      onView={onView}
      exportTitleFor={() => record.title}
      shareTarget={{
        title: record.title,
        description: description || undefined,
        url: buildPluginShareUrl(record),
      }}
      onClose={onClose}
      sidebar={{
        // Surface every plugin-common manifest field — workflow, context
        // bundles, connectors, file paths, source provenance — alongside
        // the rendered HTML preview, so the example modal carries the
        // same inspector depth the scenario fallback already shows.
        // Default open so users see the metadata without an extra click;
        // the iframe stage scales down to fit and Fullscreen still gives
        // them an immersive view when needed.
        label: 'Plugin info',
        defaultOpen: true,
        contentKey: record.id,
        content: (
          <div className="plugin-info-pane">
            <PluginMetaSections
              record={record}
              omit={{ description: true }}
              compact
              heading="Plugin info"
            />
          </div>
        ),
      }}
      primaryAction={{
        label: 'Use plugin',
        onClick: () => onUse(record),
        busy: !!isApplying,
        busyLabel: 'Applying…',
        testId: `plugin-details-use-${record.id}`,
      }}
      headerExtras={<PluginShareMenu record={record} variant="inline" />}
    />
  );
}
