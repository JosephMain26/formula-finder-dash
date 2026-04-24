## Responsive UI/UX Overhaul

I'll make the entire app render and function cleanly on phones (≤640px), tablets (641–1024px), and desktops (≥1024px).

### 1. New `src/components/MobileNav.tsx`
A hamburger menu (Shadcn `Sheet`) shown only on mobile/tablet. Provides links to Dashboard, Settings, Marketers, Technicians, Installers, plus the user's email/role and Sign out. Replaces the cramped header buttons on small screens.

### 2. Dashboard (`src/routes/index.tsx`)
- Header: stack vertically on mobile (`flex-col sm:flex-row`), reduce padding (`px-3 sm:px-6`), show `MobileNav` on `<lg`, hide desktop button row on `<lg`.
- Replace `ResizablePanelGroup` with `flex flex-col lg:flex-row` — Analytics panel stacks **below** the table on mobile/tablet (no more 25% sidebar squashing the table).
- Filters/stats wrapper padding reduced on mobile.

### 3. Jobs Table (`src/components/JobsTable.tsx`)
- Wrap `<Table>` in `<div className="overflow-x-auto -mx-2 sm:mx-0">` with inner `min-w-[900px]` so the table scrolls horizontally on small screens instead of squashing cells. Editable cells and selection logic stay intact.

### 4. Filters (`src/components/JobFilters.tsx`)
- Search input full width on mobile (`w-full sm:flex-1`).
- Each select gets `w-full sm:min-w-[150px]` so they stack as full-width rows on phones.

### 5. Stats (`src/components/StatsCards.tsx`)
- Grid: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6` instead of fixed `grid-cols-6` (cards become readable on phones).
- Hide drag/resize affordances on touch (`hidden md:block` for resize handle and reorder hint).

### 6. BulkEditBar (`src/components/BulkEditBar.tsx`)
- Already uses `flex-wrap`; just ensure each control gets `w-full sm:w-auto` so buttons stack cleanly.

### 7. Secondary routes — `settings.tsx`, `companies.tsx`, `technicians.tsx`, `installers.tsx`
- Header: `flex-col sm:flex-row`, reduced padding, add `MobileNav` on small screens.
- Tables wrapped in `overflow-x-auto`.
- Settings `TabsList` wrapped in `overflow-x-auto` so all 4 tabs are reachable on phones (with horizontal scroll if needed).
- Settings AI training row: replace `grid-cols-12` with `flex flex-col sm:grid sm:grid-cols-12` so inputs stack vertically on mobile.

### 8. Auth route (`src/routes/auth.tsx`)
- Reduce horizontal padding on small screens (`px-4 sm:px-6`) — most likely already fine but verify card max-width.

### What I'm intentionally NOT doing (saves credits)
- **No mobile-only "card view" of the jobs table** — the existing editable cells would need to be reimplemented. Horizontal scroll is the standard, low-cost solution.
- **No new package installs** — using existing Shadcn `Sheet` and Tailwind breakpoints.
- **No changes to `ResizableHandle`** — just bypassed on mobile via the `flex-col` switch.

### Files touched
- **New**: `src/components/MobileNav.tsx`
- **Edited**: `src/routes/index.tsx`, `src/routes/settings.tsx`, `src/routes/companies.tsx`, `src/routes/technicians.tsx`, `src/routes/installers.tsx`, `src/components/JobsTable.tsx`, `src/components/JobFilters.tsx`, `src/components/StatsCards.tsx`, `src/components/BulkEditBar.tsx`

Approve and I'll implement everything in one pass.
