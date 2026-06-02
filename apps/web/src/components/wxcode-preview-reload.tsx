// WXCode-additive preview reload control.
//
// Upstream's main HTML preview toolbar has no manual "reload preview"
// affordance — it only auto-bumps the reload key when the agent rewrites the
// file on disk. The WXCode embed needs a user-driven refresh that reloads only
// the preview iframe (never the whole page), so editors can pull the latest
// committed prototype on demand.
//
// Kept as a self-contained fork-owned component — presentation, icon, and i18n
// all live here — so the FileViewer call site stays a single additive element,
// disjoint from the upstream-owned toolbar JSX. This is the same quarantine
// philosophy as the seam helpers in `./wxcode-embed`: fork substance lives in a
// wxcode-named module, the upstream file only gains one adjacent token.

import { useT } from '../i18n';
import { Icon } from './Icon';

interface WxcodePreviewReloadButtonProps {
  onReload: () => void;
}

export function WxcodePreviewReloadButton({ onReload }: WxcodePreviewReloadButtonProps) {
  const t = useT();
  return (
    <button
      type="button"
      className="icon-only"
      onClick={onReload}
      title={t('fileViewer.reloadDisk')}
      aria-label={t('fileViewer.reloadAria')}
    >
      <Icon name="reload" size={14} />
    </button>
  );
}
