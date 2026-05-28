---
name: admin-saas-bestseller
description: |
  The market-leading polished SaaS admin archetype (Metronic / Vuexy /
  Velzon family): light mode, collapsible left sidebar with grouped
  nav, breadcrumb topbar with search + notifications + avatar,
  4 KPI stat tiles, primary chart card, recent records table card,
  side activity feed, subtle shadows, indigo accent. Use as the
  default safe pick when the brief just says "admin dashboard" or
  "SaaS dashboard" with no other style direction.
triggers:
  - "saas admin"
  - "admin dashboard"
  - "enterprise dashboard"
  - "metronic style"
  - "vuexy style"
  - "polished admin"
  - "painel administrativo"
  - "管理后台"
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
    requires: [pixel-discipline, laws-of-ux]
  example_prompt: "Build me a polished SaaS admin dashboard for a B2B product — left sidebar, breadcrumb topbar, 4 KPI tiles, revenue chart, recent customers table, activity feed."
---

# SaaS Admin Bestseller Skill

Produce the canonical polished SaaS admin layout — the shape every
buyer recognizes from the top sellers on Themeforest.

## Workflow
1. Read the active DESIGN.md (if present); otherwise use indigo
   (#5369f8) on a near-white canvas (#f5f7fa).
2. Extract from the brief: product name, primary KPIs (4: revenue,
   active users, churn, NPS or domain equivalents), record type for
   the table (customers, orders, projects, tickets).
3. Layout:
   - **Left sidebar (256px, collapsible feel)**: brand mark + product
     name at top, grouped nav with section headers (MAIN, MANAGE,
     SETTINGS), each item icon + label + optional badge. Active item
     has indigo left-bar and tinted background.
   - **Top bar (64px)**: breadcrumb on the left (Home / Dashboard),
     search input in the middle, notification bell with red dot,
     avatar + name on the right.
   - **Greeting strip**: "Good morning, <name>" + date + "Export"
     ghost button + indigo "+ New" primary CTA.
   - **4 stat tiles**: white cards with 12px radius and 0 2px 8px
     rgba(0,0,0,0.04) shadow. Each: small uppercase label, big number,
     tiny sparkline (inline SVG), delta chip (green up / red down).
   - **Main grid (8/4)**:
     - LEFT (8 cols): revenue chart card — title, 4 period tabs (24H,
       7D, 30D, YTD), legend, area chart as inline SVG with grid lines.
     - RIGHT (4 cols): activity feed — 6 entries with mini avatar dot,
       action verb, target, relative timestamp.
   - **Wide table card**: "Recent customers" — header with title +
     view-all link, 8 rows, columns (name+avatar, plan, MRR, signup
     date, status pill). Tinted hover row, pagination hint.
4. Type: system font stack only. Tiny uppercase labels with
   letter-spacing for tile titles. Indigo for active states and links.
   Green / red for deltas only.
5. One inline `<style>`, semantic HTML, no external assets, no CDNs.

## Output contract

```
<artifact identifier="admin-saas-bestseller" type="text/html" title="SaaS Admin Bestseller">
<!doctype html>...</artifact>
```
