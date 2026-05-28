const SERVER_TEMPLATE_HTML_RE = /(^|\/)(templates|views)\/.+\.html?$/i;

interface WxcodePreviewTabOptions {
  preferSourceFile?: boolean;
}

function normalizeTabPath(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/^\/+/, '');
}

export function isWxcodePreviewBackedFileTab(
  tabName: string | null | undefined,
  previewUrl: string | null | undefined,
  previewEntryFile?: string | null,
): boolean {
  if (!previewUrl?.trim()) return false;

  const normalizedTab = normalizeTabPath(tabName);
  if (!normalizedTab) return false;

  const normalizedEntry = normalizeTabPath(previewEntryFile);
  if (normalizedEntry && normalizedTab === normalizedEntry) return true;

  return SERVER_TEMPLATE_HTML_RE.test(normalizedTab);
}

export function shouldRouteWxcodeFileTabToLivePreview(
  tabName: string | null | undefined,
  previewUrl: string | null | undefined,
  previewEntryFile?: string | null,
  options: WxcodePreviewTabOptions = {},
): boolean {
  if (options.preferSourceFile) return false;
  return isWxcodePreviewBackedFileTab(tabName, previewUrl, previewEntryFile);
}

export function filterWxcodePreviewBackedTabs(
  tabs: string[],
  previewUrl: string | null | undefined,
  previewEntryFile?: string | null,
  options: WxcodePreviewTabOptions = {},
): string[] {
  if (!previewUrl?.trim() || options.preferSourceFile) return tabs;
  return tabs.filter((tab) => !isWxcodePreviewBackedFileTab(tab, previewUrl, previewEntryFile));
}
