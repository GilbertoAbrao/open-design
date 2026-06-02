import { describe, it, expect } from 'vitest';

import { composeSystemPrompt } from '../../src/prompts/system.js';

/**
 * Guard for the WXCode KB-context channel (Part B).
 *
 * The web embed seeds a created project's `customInstructions` with the
 * Knowledge-Base digest the shell handed on the iframe URL. The daemon reads
 * that column into `projectInstructions` and passes it to `composeSystemPrompt`,
 * which renders it under "## Custom instructions (project-level)". This test
 * locks that the value actually reaches the rendered prompt, so a future prompt
 * refactor cannot silently drop the channel the embed relies on.
 */
describe('daemon composeSystemPrompt — project-level custom instructions', () => {
  it('renders project-level custom instructions (KB context channel)', () => {
    const out = composeSystemPrompt({ projectInstructions: 'KB-CONTEXT-MARKER' });
    expect(out).toContain('KB-CONTEXT-MARKER');
    expect(out).toContain('## Custom instructions (project-level)');
  });

  it('omits the project-level section when no instructions are set', () => {
    const out = composeSystemPrompt({});
    expect(out).not.toContain('## Custom instructions (project-level)');
  });
});
