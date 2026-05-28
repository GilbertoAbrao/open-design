---
name: admin-neobrutal
description: |
  A neo-brutalist admin dashboard with thick black borders, hard 4px offset
  shadows, vibrant pastel blocks (coral / lime / cream), monospace numerics,
  and uppercase eyebrow labels. Use when the brief asks for an admin with
  personality, brutalist admin, pastel dashboard, bold borders, flat blocks,
  or "not another blue SaaS dashboard".
triggers:
  - "brutalist admin"
  - "neobrutalism dashboard"
  - "pastel admin"
  - "bold borders admin"
  - "flat blocks dashboard"
  - "admin painel brutalista"
  - "野兽派后台"
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
  example_prompt: "Build me a neo-brutalist admin panel for a creative studio — bold black borders, pastel blocks, sidebar, stat tiles, project table, recent activity."
---

# Neobrutalist Admin Skill

Produce a single-page neo-brutalist admin dashboard. Personality first,
density second.

## Workflow
1. Read the active DESIGN.md (if present); otherwise default to the
   palette below.
2. Extract from the brief: org name, product/project the admin governs,
   primary KPI names (4), and the recent-activity domain (deploys,
   bookings, orders, signups...).
3. Layout (top → bottom, left → right):
   - **Left sidebar (220px)**: bold black border-right, brand mark in a
     coral block, 6 nav items in uppercase with monospace prefix glyphs
     (>, #, *, +, %, @), one active item highlighted with lime block
     background and offset shadow.
   - **Top bar**: search slab (cream fill, 3px black border, no rounded
     corners), avatar in coral block, "+ NEW" CTA in lime block.
   - **4 stat tiles** in a row: each is a cream block with thick black
     border + 4px offset shadow (offset DOWN-RIGHT in black). Uppercase
     label, monospace big number, tiny delta arrow.
   - **Main grid (2 cols)**:
     - LEFT: project/order table — sticky uppercase header, monospace
       cells, alternating cream / white rows, status pills as flat
       pastel blocks with borders.
     - RIGHT: "recent activity" stacked cards, each cream block with
       border, monospace timestamp on the right.
   - **Footer strip**: ribbon with monospace meta (version, build, env)
     and a coral block link.
4. ALL borders 2-3px solid #000. ALL shadows are hard offsets
   (`4px 4px 0 #000`), never blurred. Border-radius: 0 everywhere.
5. One inline `<style>`, semantic HTML, no external assets, no CDNs.

## Output contract

```
<artifact identifier="admin-neobrutal" type="text/html" title="Neobrutalist Admin">
<!doctype html>...</artifact>
```
