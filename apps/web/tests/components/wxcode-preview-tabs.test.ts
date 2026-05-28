import { describe, expect, it } from 'vitest';
import {
  filterWxcodePreviewBackedTabs,
  isWxcodePreviewBackedFileTab,
} from '../../src/components/wxcode-preview-tabs';

describe('wxcode preview-backed tabs', () => {
  it('routes the imported entry file to Live Preview when WXCode provides previewUrl', () => {
    expect(
      isWxcodePreviewBackedFileTab(
        'app/templates/index.html',
        'https://example.preview.wxcode.ai/',
        'app/templates/index.html',
      ),
    ).toBe(true);
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
