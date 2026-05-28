---
name: admin-finance-terminal
description: |
  Bloomberg-Terminal-inspired institutional admin: pure-black canvas,
  amber accent (#FFB800), dense monospace tables, multi-panel grid,
  ticker strip, P&L / positions / risk panels. Use when the brief
  asks for "trading terminal", "Bloomberg-style", "treasury admin",
  "ops control room", "dense data dashboard", or any zero-density-loss
  finance UI.
triggers:
  - "bloomberg terminal"
  - "trading terminal"
  - "treasury admin"
  - "finance terminal"
  - "ops control room"
  - "dense data dashboard"
  - "金融终端"
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
    requires: [pixel-discipline, state-coverage]
  example_prompt: "Give me a Bloomberg-Terminal-style admin for a treasury desk — black background, amber accents, monospace, dense tables, ticker, P&L panel, risk gauges."
---

# Finance Terminal Admin Skill

Produce a single-page institutional finance admin laid out as a
multi-panel terminal. Density and scanability over decoration.

## Workflow
1. Read the active DESIGN.md (if present); otherwise default to the
   black + amber + white-on-black palette.
2. Extract from the brief: desk name (treasury, prop, risk, ops),
   instruments (FX pairs, equities, futures, perps, ops tickets),
   period (today, week, month).
3. Layout (12-col grid, every cell snaps to a 4px baseline):
   - **Top status bar** (32px): clock, session ID, env chip, latency
     meter, sound toggle, "F1 HELP" hint at right.
   - **Ticker strip** (24px): scrolling row of 8 instruments with last
     price + delta in monospace, green for up amber for down.
   - **Left rail** (200px): module list (8 entries) — F-key shortcut on
     left, label center, mini status dot on right.
   - **Center panel** (8 cols x 2 rows): top = positions table (10+
     rows, 7 columns, sticky header, zebra rows at 5% white); bottom =
     order book / activity log (8 rows).
   - **Right panel** (4 cols x 2 rows): top = P&L block (big monospace
     number + sparkline rendered as inline SVG); bottom = 4 risk
     gauges (VaR, exposure, leverage, drawdown) as labeled bars.
   - **Bottom command line**: monospace input prompt "CMD>" with
     blinking caret, hint chips on the right.
4. Type rules: monospace (`ui-monospace, "SF Mono", Menlo, Consolas`)
   for ALL numerics, labels, and headers. Sans only for the help hint
   text. All numbers right-aligned. Negative numbers in amber NOT red
   (Bloomberg convention).
5. Colors: `--bg:#0E0E0E`, `--panel:#1A1A1A`, `--ink:#fff`,
   `--amber:#FFB800`, `--grid:#2a2a2a`. No gradients, no shadows.
6. One inline `<style>`, semantic HTML, no external assets, no CDNs.

## Output contract

```
<artifact identifier="admin-finance-terminal" type="text/html" title="Finance Terminal Admin">
<!doctype html>...</artifact>
```
