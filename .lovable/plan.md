## Goal
Replace the checkbox-grid mapping in Settings → "Job & Comp Types" with a drag-and-drop board so you can drag a Job Type chip into a Comp Type column to assign it (and drag it out / between columns to reassign).

## Approach (minimal credits)
- Keep the existing storage: `app_settings.job_type_groups` JSON `{ groups: { compName: [jobTypeName, ...] } }`. No DB changes, no new tables.
- Keep the existing add/rename/delete rows for Comp Types and Job Types untouched.
- Use the browser-native HTML5 drag-and-drop API (no new dependency, zero install cost). Works fine for this list-sized UI.
- One file edited: `src/components/settings/TypeGroupsManager.tsx`. Nothing else changes.

## UI

```text
+-- Unassigned Job Types ------------------+
| [Install] [Service] [Repair] [Survey]   |  <- draggable chips
+------------------------------------------+

+-- Solar ----------+  +-- HVAC ----------+  +-- Roofing -------+
| [Install]         |  | [Service]        |  | (drop here)      |
| [Survey]          |  | [Repair]         |  |                  |
+-------------------+  +------------------+  +------------------+
```

- Each Comp Type is a drop zone (column/card) listing its assigned Job Type chips.
- A top "Unassigned" zone lists Job Types not in any comp.
- Drag a chip from one zone into another → save `groups` to `app_settings` immediately (debounced if needed, but a single upsert per drop is fine).
- A Job Type may belong to multiple comp types (current data model already allows it). Default drag = move from source to target; hold a modifier (or use a small "copy" toggle in the chip's hover menu) to copy instead. Simpler v1: plain move, since multi-assign is rare; can revisit.
- Mobile fallback: on touch devices, show a small "Assign…" button on each chip that opens a popover with comp-type checkboxes (reuses existing logic), since HTML5 DnD is unreliable on touch. Keeps it usable everywhere without adding a DnD library.

## Behaviour details
- Rename of a comp type → migrate the key in `groups` (already implemented, keep as-is).
- Delete of a comp type / job type → strip from `groups` (already implemented).
- "Unassigned" is computed: `jobTypes` minus union of all assigned names.
- Saves are optimistic: update local `groups` state, then `saveTypeGroups(next)`; toast on failure.

## Out of scope
- No new npm package, no DB migration, no changes to `AddJobDialog` (filter logic already reads `groups` and keeps working unchanged).
- No reordering within a column (assignment only, not ordering). Can add later if needed.
