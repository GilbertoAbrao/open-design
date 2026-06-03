import { describe, it, expect } from 'vitest';
import {
  parseOpencodeSessionModel,
  resolveOpencodeDbPath,
  readOpencodeSessionModel,
} from '../src/opencode-session-model.js';

describe('parseOpencodeSessionModel', () => {
  it('builds provider/model from OpenCode session.model JSON', () => {
    expect(
      parseOpencodeSessionModel('{"id":"gpt-5.4","providerID":"openai","variant":"default"}'),
    ).toBe('openai/gpt-5.4');
    expect(
      parseOpencodeSessionModel('{"id":"claude-sonnet-4.6","providerID":"github-copilot"}'),
    ).toBe('github-copilot/claude-sonnet-4.6');
  });

  it('returns the bare id when providerID is missing', () => {
    expect(parseOpencodeSessionModel('{"id":"gpt-5.4"}')).toBe('gpt-5.4');
  });

  it('returns null for empty / malformed / non-object input', () => {
    expect(parseOpencodeSessionModel('')).toBeNull();
    expect(parseOpencodeSessionModel(null)).toBeNull();
    expect(parseOpencodeSessionModel(undefined)).toBeNull();
    expect(parseOpencodeSessionModel('not json')).toBeNull();
    expect(parseOpencodeSessionModel('"a string"')).toBeNull();
    expect(parseOpencodeSessionModel('{"providerID":"openai"}')).toBeNull(); // no id
    expect(parseOpencodeSessionModel('{"id":"  "}')).toBeNull();
  });
});

describe('resolveOpencodeDbPath', () => {
  it('derives the db path from XDG_DATA_HOME', () => {
    expect(resolveOpencodeDbPath({ XDG_DATA_HOME: '/tmp/x/data' })).toBe(
      '/tmp/x/data/opencode/opencode.db',
    );
  });

  it('returns null when XDG_DATA_HOME is unset/empty', () => {
    expect(resolveOpencodeDbPath({})).toBeNull();
    expect(resolveOpencodeDbPath({ XDG_DATA_HOME: '' })).toBeNull();
    expect(resolveOpencodeDbPath({ XDG_DATA_HOME: '   ' })).toBeNull();
  });
});

describe('readOpencodeSessionModel', () => {
  it('returns null for empty session id without touching the fs', () => {
    expect(readOpencodeSessionModel('', { XDG_DATA_HOME: '/tmp/x/data' })).toBeNull();
    expect(readOpencodeSessionModel(null, { XDG_DATA_HOME: '/tmp/x/data' })).toBeNull();
    expect(readOpencodeSessionModel(undefined)).toBeNull();
  });

  it('returns null (never throws) when the db is missing', () => {
    expect(
      readOpencodeSessionModel('ses_does_not_exist', {
        XDG_DATA_HOME: '/tmp/definitely-no-opencode-db-here-xyz',
      }),
    ).toBeNull();
  });

  it('returns null when no data home is configured', () => {
    expect(readOpencodeSessionModel('ses_abc', {})).toBeNull();
  });
});
