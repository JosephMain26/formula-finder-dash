# App Reference Handbook (PDF)

Produce a single, professional, downloadable PDF that documents the complete application: every page, form field, button, setting, database column, and calculation formula. The PDF will be generated from the actual codebase (routes, components, lib, and schema) and saved to persistent storage so you can download it.

## Output
- A polished, multi-page PDF: cover page, table of contents, and one chapter per app area.
- Saved as a downloadable artifact you can open or share with your team.
- Branded to match the app (colors/typography pulled from the design tokens).

## Chapters

```text
1.  Cover + Overview        App purpose, tech stack, roles overview
2.  Core Calculations       Revenue, marketer/tech/office splits, balances, parts charges
3.  Jobs                    Add/Edit job fields, JobsTable, inline edit, bulk edit, filters
4.  DataBoard               Widgets, KPIs, insights, goals, mobile drag-lock, exports
5.  Schedule                Calendar, reschedule, reminders
6.  Clients / Companies     Lists, import, marketer types
7.  Technicians / Installers Catalogs, installations editor
8.  Balances                Marketer balance table, parts charges, PDF statements
9.  Reports                 Report builder, sections, columns, totals, automations
10. Messaging & AI          Template variables, SMS, AI message parsing
11. Settings                Form builder, statuses, type groups, door centers, catalogs, users/RBAC
12. Database Schema         Every table + column (jobs, parts_charges, app_settings, profiles, etc.)
13. Roles & Permissions     RBAC matrix
```

## Key formulas documented (verbatim from code)

```text
revenue        = price - co_parts - office_parts - parts - tip - (cc_fee if card)
marketerBase   = fixed ? marketer_fixed_amount : revenue * marketer_pct
techBase       = fixed ? tech_fixed_amount     : revenue * tech_pct
officeBase     = fixed ? office_fixed_amount   : revenue * (1 - marketer_pct - tech_pct)
total_marketer = marketerBase + co_parts
total_tech     = techBase + parts + tip
total_office   = officeBase + office_parts
marketer net   = positive ⇒ office owes marketer; parts charges reduce net
```

## How it will be built (technical)
- A Python script (reportlab) reads the documented structure and renders the PDF to `/mnt/documents/app-reference-handbook.pdf`.
- Source of truth: existing files already reviewed — `jobCalc.ts`, `marketerBalance.ts`, `reportSpec.ts`, `metrics.ts`, `partsCharges.ts`, route files, settings components, and `integrations/supabase/types.ts` for the schema.
- After generation, each page is rendered to images and visually QA'd (overflow, clipping, layout) and fixed before delivery.
- No application code is changed — this is a documentation artifact only.

## Deliverable
A `<presentation-artifact>` link to the finished PDF so you can preview/download it directly.
