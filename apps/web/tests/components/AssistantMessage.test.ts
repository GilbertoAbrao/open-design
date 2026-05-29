// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { assistantRoleLabel } from '../../src/components/AssistantMessage';
import type { ChatMessage } from '../../src/types';

const t = () => 'Assistant';

describe('assistantRoleLabel', () => {
  it('prefers the persisted assistant display name over the protocol id', () => {
    const message: ChatMessage = {
      id: 'message-1',
      role: 'assistant',
      content: '',
      agentId: 'openai-api',
      agentName: 'OpenAI API · google/gemma-4-e4b',
    };

    expect(assistantRoleLabel(message, t)).toBe('OpenAI API · google/gemma-4-e4b');
  });

  it('maps API protocol ids to readable labels when no display name is saved', () => {
    const message: ChatMessage = {
      id: 'message-2',
      role: 'assistant',
      content: '',
      agentId: 'openai-api',
    };

    expect(assistantRoleLabel(message, t)).toBe('OpenAI API');
  });

  it('normalizes saved API protocol ids used as display names', () => {
    const message: ChatMessage = {
      id: 'message-3',
      role: 'assistant',
      content: '',
      agentName: 'openai-api',
    };

    expect(assistantRoleLabel(message, t)).toBe('OpenAI API');
  });

  it('preserves an explicit local agent model in the display name', () => {
    const message: ChatMessage = {
      id: 'message-4',
      role: 'assistant',
      content: '',
      agentId: 'claude',
      agentName: 'Claude · claude-sonnet-4-6',
    };

    expect(assistantRoleLabel(message, t)).toBe('Claude · claude-sonnet-4-6');
  });

  it('adds the model reported by a local CLI initializing event', () => {
    const message: ChatMessage = {
      id: 'message-5',
      role: 'assistant',
      content: '',
      agentId: 'claude',
      agentName: 'Claude',
      events: [{ kind: 'status', label: 'initializing', detail: 'claude-sonnet-4-6' }],
    };

    expect(assistantRoleLabel(message, t)).toBe('Claude · claude-sonnet-4-6');
  });
});

describe('assistantRoleLabel — WXCode embed white-label', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-od-host');
  });

  it('shows WXCode instead of the underlying agent inside the WXCode embed', () => {
    document.documentElement.setAttribute('data-od-host', 'wxcode');
    const message: ChatMessage = {
      id: 'message-wx',
      role: 'assistant',
      content: '',
      agentId: 'opencode',
      agentName: 'OpenCode',
    };

    expect(assistantRoleLabel(message, t)).toBe('WXCode');
  });

  it('keeps the upstream agent label outside the WXCode embed', () => {
    const message: ChatMessage = {
      id: 'message-host',
      role: 'assistant',
      content: '',
      agentId: 'opencode',
      agentName: 'OpenCode',
    };

    expect(assistantRoleLabel(message, t)).toBe('OpenCode');
  });
});
