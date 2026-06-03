import { describe, expect, it } from 'vitest';

import { DISCOVERY_AND_PHILOSOPHY } from '../../src/prompts/discovery.js';
import { composeSystemPrompt } from '../../src/prompts/system.js';

// The default-router exception in `discovery.ts` emits a single `<question-form
// id="task-type">` on turn 1 that combines the routing question (which Open
// Design workflow to take) with the core discovery brief (audience / brand /
// scale / constraints). Before this consolidation, freeform projects (no Home
// chip pick) saw two clarification cards in a row — task-type, then "Quick
// brief — 30 seconds" — which felt like the agent was re-asking. These tests
// lock the single-shot shape so a future prompt edit cannot accidentally split
// the brief into two turns again.

describe('discovery.ts task-type form (single-shot brief)', () => {
  it('emits a task-type form that asks the routing question plus the discovery brief', () => {
    expect(DISCOVERY_AND_PHILOSOPHY).toContain('<question-form id="task-type"');
    // Task-type radio + the four discovery brief fields must all live in this
    // single form so the user does not see a second clarification card.
    expect(DISCOVERY_AND_PHILOSOPHY).toContain('"id": "taskType"');
    expect(DISCOVERY_AND_PHILOSOPHY).toContain('"id": "audience"');
    expect(DISCOVERY_AND_PHILOSOPHY).toContain('"id": "brand"');
    expect(DISCOVERY_AND_PHILOSOPHY).toContain('"id": "scale"');
    expect(DISCOVERY_AND_PHILOSOPHY).toContain('"id": "constraints"');
  });

  it('preserves the three branch values RULE 2 dispatches on', () => {
    // RULE 2 line 130+ keys off these exact `brand` answer values to choose
    // Branch A (real brand source) vs Branch B (auto-pick). They are part of
    // the discovery contract — labels can localize but values must not.
    expect(DISCOVERY_AND_PHILOSOPHY).toContain('"value": "pick_direction"');
    expect(DISCOVERY_AND_PHILOSOPHY).toContain('"value": "brand_spec"');
    expect(DISCOVERY_AND_PHILOSOPHY).toContain('"value": "reference_match"');
  });

  it('keeps the eight canonical task-type options', () => {
    const options = [
      'Prototype',
      'Live artifact',
      'Slide deck',
      'Image',
      'Video',
      'HyperFrames',
      'Audio',
      'Other',
    ];
    for (const option of options) {
      expect(DISCOVERY_AND_PHILOSOPHY).toContain(`"${option}"`);
    }
  });

  it('forbids the agent from emitting a second Quick brief form after task-type answers', () => {
    // The whole point of the consolidation: once turn 1's task-type form is
    // answered, turn 2 must go straight to brand handling / planning. A regex
    // is brittle so check for the explicit no-second-form sentence the prompt
    // ships with.
    expect(DISCOVERY_AND_PHILOSOPHY).toMatch(
      /do NOT emit a second `<question-form id="discovery">` \/ "Quick brief — 30 seconds" form/,
    );
  });

  it('forbids pairing a tailored discovery form with the default Quick brief in one turn', () => {
    expect(DISCOVERY_AND_PHILOSOPHY).toContain('Emit exactly ONE `<question-form>` in this turn.');
    expect(DISCOVERY_AND_PHILOSOPHY).toContain(
      'that tailored form replaces the default "Quick brief — 30 seconds" form; never output both.',
    );
  });

  it('teaches RULE 2 to accept the task-type answer marker alongside discovery', () => {
    // RULE 2's first sentence enumerates the answer markers it routes on. The
    // single-shot brief means `[form answers — task-type]` must be a valid
    // entry point — equivalent to `[form answers — discovery]` for the brand
    // branching logic that follows.
    expect(DISCOVERY_AND_PHILOSOPHY).toMatch(
      /\[form answers — discovery\][^.]*\[form answers — task-type\]/,
    );
  });
});

// Bug: opening a project through a pinned visual plugin (e.g. an admin-dashboard
// plugin) emits `## Active skill — <name>` carrying that plugin's visual
// language + layout archetype — i.e. the visual direction is already chosen.
// But the discovery brief only suppressed the `tone`/`brand` questions for a
// `## Active design system` section. A pinned skill produces `## Active skill`,
// so the suppression never fired and turn 1 still asked "Visual tone" and
// "Brand context". These tests lock the generalized exception: a pinned visual
// skill is ALSO a chosen visual direction and must drop those questions.
describe('discovery.ts active-skill visual-direction exception', () => {
  it('ships an active-skill exception that treats a pinned visual skill as the visual direction', () => {
    // The original prompt only mentioned `## Active design system` as the
    // visual-direction signal. The fix adds a tightly parallel clause keyed on
    // `## Active skill`. Assert on the section title in an exception context
    // that did not exist before.
    expect(DISCOVERY_AND_PHILOSOPHY).toContain('Active visual skill exception');
    expect(DISCOVERY_AND_PHILOSOPHY).toContain('`## Active skill`');
  });

  it('drops the tone and brand discovery questions when a visual skill is active', () => {
    // The user-visible symptom: turn 1 kept asking "Visual tone" (`tone`) and
    // "Brand context" (`brand`). The exception must explicitly say a pinned
    // visual skill suppresses those two questions.
    expect(DISCOVERY_AND_PHILOSOPHY).toMatch(
      /active visual skill[\s\S]*?drop[\s\S]*?\btone\b[\s\S]*?\bbrand\b/i,
    );
  });

  it('preserves the default-router exception (od-default is not a visual direction)', () => {
    // od-default / "Default design router" is a routing skill, not a visual
    // direction — the new exception must explicitly carve it out so the
    // task-type routing form behavior is untouched.
    expect(DISCOVERY_AND_PHILOSOPHY).toMatch(
      /Active visual skill exception[\s\S]*?od-default[\s\S]*?Default design router/,
    );
  });

  it('preserves the explicit brand-override (Branch A still runs on a provided source)', () => {
    // Even with an active visual skill, an explicitly provided brand spec /
    // reference site / screenshot must still run Branch A as a supplemental
    // override — the suppression is only about not ASKING, not about ignoring
    // a real source the user provides.
    expect(DISCOVERY_AND_PHILOSOPHY).toMatch(
      /Active visual skill exception[\s\S]*?Branch A/,
    );
  });

  it('teaches RULE 2 Branch B to treat an active visual skill as the visual direction', () => {
    // Branch B originally only handled an active design system. After the fix it
    // must treat an active visual skill the same way: use it as the visual
    // direction without asking; only pick a direction yourself when NEITHER is
    // present.
    expect(DISCOVERY_AND_PHILOSOPHY).toMatch(
      /active design system OR an active visual skill/i,
    );
  });

  it('composes a ## Active skill section when a skillBody is present and no design system is', () => {
    // Integration: confirm the exact section title the new exception keys on is
    // emitted in the pinned-plugin scenario (active skill, NO design system).
    const prompt = composeSystemPrompt({
      skillName: 'Admin Dashboard',
      skillBody:
        '# Admin Dashboard\n\nVisual language: dense data tables, monospace numerics, a single cyan accent.\nLayout archetype: sidebar + top bar + content grid.',
    });
    expect(prompt).toContain('## Active skill — Admin Dashboard');
    // And crucially the EMITTED design-system section header is absent in this
    // scenario (the discovery prose references `## Active design system` in
    // backticks, but the composer only emits the real `\n\n## Active design
    // system` heading when a DESIGN.md body is present). The old exception
    // keyed on that heading, so it could never have fired for a pinned skill.
    expect(prompt).not.toMatch(/\n## Active design system(?:\n| —)/);
  });
});
