import { describe, expect, it } from 'vitest';
import {
  filterWxcodePreviewBackedTabs,
  isWxcodePreviewBackedFileTab,
  shouldRouteWxcodeFileTabToLivePreview,
} from '../../src/components/wxcode-preview-tabs';

describe('wxcode preview-backed tabs', () => {
  it('routes the imported entry file to Live Preview when WXCode provides previewUrl by default', () => {
    expect(
      isWxcodePreviewBackedFileTab(
        'app/templates/index.html',
        'https://example.preview.wxcode.ai/',
        'app/templates/index.html',
      ),
    ).toBe(true);
    expect(
      shouldRouteWxcodeFileTabToLivePreview(
        'app/templates/index.html',
        'https://example.preview.wxcode.ai/',
        'app/templates/index.html',
      ),
    ).toBe(true);
  });

  it('keeps the source file tab when the WXCode embed deep-links to a file', () => {
    expect(
      shouldRouteWxcodeFileTabToLivePreview(
        'app/templates/index.html',
        'https://example.preview.wxcode.ai/',
        'app/templates/index.html',
        { preferSourceFile: true },
      ),
    ).toBe(false);
    expect(
      filterWxcodePreviewBackedTabs(
        ['app/templates/index.html', 'app/static/css/app.css', 'README.md'],
        'https://example.preview.wxcode.ai/',
        'app/templates/index.html',
        { preferSourceFile: true },
      ),
    ).toEqual(['app/templates/index.html', 'app/static/css/app.css', 'README.md']);
  });

  it('routes server templates to Live Preview even when older metadata has no entry file', () => {
    expect(
      isWxcodePreviewBackedFileTab(
        'root_code/templates/detail.html',
        'https://example.preview.wxcode.ai/',
        null,
      ),
    ).toBe(true);
  });

  it('does not hide ordinary files or standalone static html without a WXCode preview', () => {
    expect(isWxcodePreviewBackedFileTab('index.html', null, 'index.html')).toBe(false);
    expect(
      filterWxcodePreviewBackedTabs(
        ['app/templates/index.html', 'app/static/css/app.css', 'README.md'],
        'https://example.preview.wxcode.ai/',
        'app/templates/index.html',
      ),
    ).toEqual(['app/static/css/app.css', 'README.md']);
  });
});
