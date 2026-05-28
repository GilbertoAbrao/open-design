---
name: admin-glassmorphism
description: |
  Dark-mode admin built on frosted glass panels — translucent surfaces
  with backdrop blur over a soft aurora gradient background, cyan
  accent, hairline white-alpha borders, soft inner glow on actives.
  Use when the brief asks for glassmorphism, frosted glass, aurora
  background, modern dark dashboard, or anything that signals "not
  flat cards".
triggers:
  - "glassmorphism dashboard"
  - "frosted glass admin"
  - "aurora dashboard"
  - "modern dark admin"
  - "translucent panels"
  - "painel glassmorphism"
  - "毛玻璃后台"
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
    requires: [pixel-discipline, typographic-rhythm]
  example_prompt: "Make me a glassmorphism admin dashboard for a creator-economy platform — dark, aurora gradient background, frosted glass panels, cyan accent, KPI tiles, revenue chart, top creators table."
---

# Glassmorphism Admin Skill

Produce a single-page dark admin where every surface is a frosted glass
panel sitting on top of an aurora gradient.

## Workflow
1. Read the active DESIGN.md (if present); otherwise use the cyan +
   navy palette below.
2. Extract from the brief: platform name, the people/objects being
   governed (creators, drivers, tenants, artists), primary KPIs (4),
   featured chart subject.
3. Layout (everything floats over the gradient):
   - **Background**: full-viewport fixed gradient — radial blobs of
     cyan, magenta, and indigo at low opacity, fading into deep navy
     base. Add a subtle noise overlay via SVG `feTurbulence` data URI
     for grain.
   - **Left sidebar (240px)**: glass panel (rgba white 4-6% +
     backdrop-filter blur 18px + 1px white-alpha 10% border). Brand
     mark at top, 7 nav items with inline SVG icons. Active item has
     a cyan-tinted glass card with soft inset glow.
   - **Top bar (72px)**: glass panel spanning right area. Search
     pill (glass), notification icon, avatar.
   - **4 KPI tiles**: glass panels with the same recipe. Each: tiny
     uppercase label in white-alpha 60%, big number white, tiny
     sparkline in cyan, delta chip (green-glass / pink-glass).
   - **Main grid (8/4)**:
     - LEFT (8 cols): chart panel — title, 3 period chips, legend.
       Area chart as inline SVG with cyan gradient fill (transparent
       at bottom), white axis labels.
     - RIGHT (4 cols): top-N list — 6 rows with avatar bubble,
       primary text, secondary, trailing metric.
   - **Wide table panel**: 8 rows, glass header with frosted
     contrast, zebra rows at white-alpha 2%, status pills as small
     tinted glass capsules.
4. Glass recipe: `background: rgba(255,255,255,0.04); backdrop-filter:
   blur(18px) saturate(120%); border: 1px solid rgba(255,255,255,0.10);
   border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.35), inset
   0 1px 0 rgba(255,255,255,0.06);`
5. Type: system font, white at 95% for body, 60% for labels. Cyan
   (#4dd0e1) ONLY for actives, links, and chart accents.
6. One inline `<style>`, semantic HTML, no external assets, no CDNs.

## Output contract

```
<artifact identifier="admin-glassmorphism" type="text/html" title="Glassmorphism Admin">
<!doctype html>...</artifact>
```
