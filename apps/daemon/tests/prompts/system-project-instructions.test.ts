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
    // The composer emits the section as a real `\n\n## Custom instructions
    // (project-level)\n\n` heading. Assert on that rendered form rather than a
    // bare substring: the discovery prose now also *mentions* the heading name
    // in backticks (the domain-authority clause points the agent at the KB
    // block), so a substring check would no longer prove the section rendered.
    expect(out).toMatch(/\n## Custom instructions \(project-level\)\n/);
  });

  it('omits the project-level section when no instructions are set', () => {
    const out = composeSystemPrompt({});
    // Same precision fix: the static discovery prose references the heading
    // name inline, so the absence guard must key on the emitted `\n\n##`
    // heading form, not the substring that the prose legitimately contains.
    expect(out).not.toMatch(/\n## Custom instructions \(project-level\)\n/);
  });
});
