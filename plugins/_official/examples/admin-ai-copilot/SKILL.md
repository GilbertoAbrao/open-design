---
name: admin-ai-copilot
description: |
  Admin dashboard with a permanent AI copilot rail: deterministic widget
  canvas on the left (KPIs, charts, tables), conversational agent panel
  on the right with tool-call cards and suggestion chips, Cmd+K command
  palette at the top, bottom status bar with agent idle/working / cost /
  latency. Direct fit for any agentic cockpit, ops co-pilot, or AI-first
  admin.
triggers:
  - "ai copilot admin"
  - "agent dashboard"
  - "ai assistant panel"
  - "copilot rail"
  - "agentic admin"
  - "cockpit ui"
  - "ai 助手 后台"
od:
  mode: prototype
  surface: web
  scenario: operations
  preview:
    type: html
    entry: index.html
  design_system:
    requires: true
    sections: [color, typography, layout, components]
  craft:
    requires: [state-coverage, laws-of-ux]
  example_prompt: "Build an admin dashboard with a permanent AI copilot rail — left = widget canvas with KPIs / chart / table, right = chat with tool-call cards, top = Cmd+K palette, bottom status with agent idle/working."
---

# AI Copilot Admin Skill

Produce a single-page agentic admin where the agent is a first-class
citizen of the layout — not a hidden floating button.

## Workflow
1. Read the active DESIGN.md (if present); otherwise use the dark
   navy + indigo + pink palette below.
2. Extract from the brief: product name, the domain the agent
   governs (ops, support, marketing, security), KPIs (4), the kind
   of records the table shows.
3. Layout (3 vertical bands plus top + bottom strips):
   - **Top bar (56px)**: brand mark, breadcrumb, **Cmd+K palette
     trigger** centered (pill with placeholder "Ask anything or jump
     to..."), notifications, avatar.
   - **Left rail (64px)**: 7 icon nav items vertical, active item
     glows indigo.
   - **Center canvas (flex)**: greeting + 4 KPI tiles, a primary chart
     card, a records table (8 rows). Subtle dark cards with hairline
     border. This is the deterministic surface.
   - **Right copilot rail (380px)**: title "COPILOT" + agent name +
     status dot, thread of 4 turns:
       1. user asks a question
       2. assistant answers with markdown + a **tool-call card**
          (e.g., `query_revenue_by_segment` — showing input args
          collapsed, status "ran in 240ms", result row count)
       3. assistant returns a **mini chart artifact** inline (small
          bar chart inline SVG)
       4. assistant proposes 3 suggestion chips for next action
     Sticky composer at bottom: textarea + send button + tools
     toggle + attach.
   - **Bottom status bar (32px)**: dot + "Agent idle" (or "Working:
     fetching positions..."), cost meter ($0.043 used today), p50
     latency (1.2s), model chip.
4. Style rules: dark navy canvas (#0f1419), indigo (#6366f1) for
   actives + agent accents, pink (#ec4899) for the agent avatar +
   notifications. Tool-call cards have a thin indigo left bar and
   subtle indigo-tinted background. Status dots use semantic colors.
5. Cmd+K palette appears as a faux-open overlay above the layout (or
   shown as a pill in the top bar with a `⌘K` chip — pick whichever
   reads cleaner; in the example.html, show the closed pill state).
6. One inline `<style>`, semantic HTML, no external assets, no CDNs.

## Output contract

```
<artifact identifier="admin-ai-copilot" type="text/html" title="AI Copilot Admin">
<!doctype html>...</artifact>
```
