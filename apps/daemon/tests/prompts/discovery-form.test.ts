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

// Consolidation: the WXCode-embedded OD generation agent used to receive a
// per-request `customInstructions` payload that (a) declared the active
// plugin/skill is aesthetic-only and the product DOMAIN comes from the
// Knowledge-Base context + the user's prompt, and (b) banned generated-design
// metadata from leaking into product screens (rules/status panels instead of
// inline validation, build-status caveats, and design-narration prose). These
// tests lock those behaviors as NATIVE to OD's composed system prompt so the
// embed can revert `customInstructions` to a digest-only channel.
describe('discovery.ts active-visual-skill DOMAIN AUTHORITY', () => {
  it('states the active visual skill is look + structure only, not the product domain', () => {
    // The pinned visual skill fixes the LOOK + STRUCTURE; the product domain
    // (entities, screens, metrics, workflows, terminology) must come from the
    // KB context + the user's prompt, not the skill.
    expect(DISCOVERY_AND_PHILOSOPHY).toMatch(
      /Active visual skill exception[\s\S]*?LOOK \+ STRUCTURE/,
    );
    expect(DISCOVERY_AND_PHILOSOPHY).toMatch(
      /Active visual skill exception[\s\S]*?product \*\*domain\*\*[\s\S]*?Knowledge Base/,
    );
  });

  it('treats the skill example domain as illustrative only — never briefs or builds it', () => {
    // Authoritative-domain behavior: the skill's example domain is a sample of
    // the aesthetic, not the thing to build. The agent must not brief, ask
    // about, or generate the skill's example domain.
    expect(DISCOVERY_AND_PHILOSOPHY).toMatch(
      /Active visual skill exception[\s\S]*?illustrative only/,
    );
    expect(DISCOVERY_AND_PHILOSOPHY).toMatch(
      /Active visual skill exception[\s\S]*?Do NOT brief, ask about, or generate the skill's example domain/,
    );
  });

  it('falls back to the skill example domain only when no KB/domain is supplied (standalone)', () => {
    // Standalone (no embed, no KB): there is no real domain, so the skill's
    // example domain is the correct fallback.
    expect(DISCOVERY_AND_PHILOSOPHY).toMatch(
      /Active visual skill exception[\s\S]*?If NO KB\/domain is supplied[\s\S]*?fall back to the skill's example domain/,
    );
  });

  it('keys the domain source on the Custom instructions (project-level) KB block', () => {
    // The KB digest arrives as projectInstructions -> "## Custom instructions
    // (project-level)". The domain-authority clause must reference that block so
    // the agent knows where the real domain lives.
    expect(DISCOVERY_AND_PHILOSOPHY).toMatch(
      /Active visual skill exception[\s\S]*?## Custom instructions \(project-level\)/,
    );
  });
});

describe('discovery.ts anti-AI-slop metadata-as-UI (three families)', () => {
  it('forbids rules/status/validation panels and requires inline field validation instead', () => {
    // Family 1: domain rules must be expressed as inline field validation
    // (required marks, helper text, inline errors), NEVER as a panel listing
    // the rules.
    expect(DISCOVERY_AND_PHILOSOPHY).toMatch(/inline field validation/);
    expect(DISCOVERY_AND_PHILOSOPHY).toMatch(
      /never a panel listing the rules/,
    );
  });

  it('forbids build/implementation status notes and designer/demo controls', () => {
    // Family 2: no "depends on backend" / "persistence pending" / "TODO" /
    // "coming soon" build-status caveats, and no designer/demo controls.
    expect(DISCOVERY_AND_PHILOSOPHY).toMatch(/persistence pending/);
    expect(DISCOVERY_AND_PHILOSOPHY).toMatch(/coming soon/);
  });

  it('forbids design-narration prose and asserts every visible word is real product copy', () => {
    // Family 3 (NEW): no copy that narrates the design / visual system / plugin
    // or that the artifact is a template/prototype. The two stable phrases the
    // task calls out:
    expect(DISCOVERY_AND_PHILOSOPHY).toMatch(/template with real form states/);
    expect(DISCOVERY_AND_PHILOSOPHY).toMatch(
      /Every visible word is real product copy for the end user/,
    );
  });
});

// Two residual metadata leaks survived the anti-design-narration family. They
// are tighter than the generic family-3 prose ban, so they get their own
// stable phrases:
//   R1 — the agent named the generated product after the active skill itself.
//        A pinned `## Active skill — Forge Admin` produced a product titled
//        "Escola Forge Admin" with `aria-label="Escola Forge Admin"` and an
//        intro like "...telas ... com a linguagem visual do Forge Admin". The
//        skill name is internal tooling, not product identity — the product
//        name comes from the KB/domain.
//   R2 — screens carried decorative cards that NARRATE a feature/flow instead
//        of being functional UI (a login screen with a "RECUPERAÇÃO" card
//        explaining the reset link, a "SESSÃO ATIVA" card explaining the
//        timeout policy). A login screen is the real form + a plain "Forgot
//        password?" link, not panels describing the auth flow.
describe('discovery.ts anti-AI-slop metadata-as-UI residual leaks (R1/R2)', () => {
  it('forbids surfacing the active plugin/skill name as the product brand/title (R1)', () => {
    // The skill name (`## Active skill — <name>`) is internal tooling, not
    // product identity. It must never appear as the product brand, <title>,
    // header/logo, aria-label, or visible copy; name the product from its
    // domain (the KB + user prompt).
    expect(DISCOVERY_AND_PHILOSOPHY).toMatch(
      /the skill name is internal tooling, not product identity/,
    );
    expect(DISCOVERY_AND_PHILOSOPHY).toMatch(
      /Never surface the active plugin\/skill's NAME[\s\S]*?as the product's brand, page `<title>`/,
    );
    // And the specific intro pattern observed in the leak is called out by name.
    expect(DISCOVERY_AND_PHILOSOPHY).toMatch(
      /screens … with the visual language of <Plugin>/,
    );
  });

  it('forbids decorative behavior-explainer cards and requires functional UI instead (R2)', () => {
    // Build the functional control, never a card narrating what a feature or
    // flow does. The two observed cards (a Recovery card describing the reset
    // flow, a Session card describing the timeout) are the stable examples, and
    // a login is the real form plus a plain "Forgot password?" link.
    expect(DISCOVERY_AND_PHILOSOPHY).toMatch(
      /never decorative cards that narrate what a feature or flow does/,
    );
    expect(DISCOVERY_AND_PHILOSOPHY).toMatch(
      /A login screen is the real login form plus a plain 'Forgot password\?' link/,
    );
    expect(DISCOVERY_AND_PHILOSOPHY).toMatch(
      /If a behavior matters, implement the control, don't describe it/,
    );
  });
});
