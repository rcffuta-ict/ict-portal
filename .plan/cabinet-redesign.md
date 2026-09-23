# Cabinet: office creation on its own page, and an appointment flow that makes sense

Three asks, one area. (3) is already done and is listed for completeness.

## 1. "Create office" leaves the cabinet tab

**Why.** Minting an office adds a node to the administrative hierarchy and a row of
privilege tags that decide what its holder can do. That is not the same kind of act as
adding someone to a roster, and it should not be a third toggle beside "Roster" and
"Appoint" where it can be reached by a misclick.

**Scope, as decided:** the page creates **Exco offices for a unit or team that has
none**. The fixed spine -- President, the two VPs, ICT Coordinator, the Level
Coordinators -- stays frozen in `src/config/leadership-positions.ts`, seeded and held by
`enforce_frozen_position_catalogue`. Runtime creation exists for exactly one real case:
a unit created after the catalogue was seeded and needing its Executive.

**Route:** `src/app/dashboard/tenure/offices/new/page.tsx`.

- Lists units/teams with **no active Exco office** and makes you pick one. If there are
  none, the page says so and offers nothing -- the honest empty state, rather than a
  form that will fail.
- Title, alias and slug are **derived** from the unit (`exco-<unit-slug>`), shown
  read-only with the slug explained as immutable. Nothing to mistype.
- Privileges are fixed at `EXCO:<unit-slug>` and shown, not edited. A free privilege
  builder here is how an office ends up with a scope that does not match its unit.
- A confirm step naming the unit and the resulting office, plus a back link.

The cabinet's `ConfigurationView` loses its creation form and keeps privilege editing
for existing offices. The "Roles" mode button becomes a link to the new page.

## 2. Appointment: office -> level -> member

**Why.** The current flow is member-first: search all members, then pick an office from
a dropdown of ~36. You have to know who you want before the screen tells you what you
are filling, and the search is a bare box over the whole fellowship.

**New shape, three steps, one per screen:**

**Step 1 -- Office.** Grouped by tier, each card showing the office, its alias, its
privilege pills, whether it grants login, and who currently holds it (so re-appointing
an occupied office is a visible decision, not a surprise).

**Step 2 -- Level.** A grid of generation cards: level, family name, member count, and
how many of that level already hold an office. Behaviour depends on the office:

- **Non-level office** (Exco, VP, President): every level card. Narrowing to a level is
  how you get from 600 members to 20.
- **Level-scoped office** (`LEVEL:300`): the scoped level is **pre-selected and marked
  "expected"**, but the other levels stay reachable.

  Not a hard lock, deliberately. A 300 Level Coordinator is drawn from 300 Level, but
  the **100 Level Coordinator is a senior -- a 400 or 500 Level member** -- so a lock on
  the scoped level would make the most common junior appointment impossible. The default
  encodes the usual case; the grid keeps the exception one click away.
- **`LEVEL:all`** (500 Level Coordinator): every level, nothing pre-selected.

**Step 3 -- Member.** Search *within the chosen level* -- client-side over that level's
roster, so it is instant and needs no round-trip per keystroke. Cards show name, matric,
department, gender, and any office already held. Then Lead vs Assistant, and confirm.

A breadcrumb across the top (Office > Level > Member), each step clickable to go back.
Mobile: one column, cards stack, 44px touch targets.

**Data.** `data.positions` and `data.families` already come from `getAdminData`. Level
rosters need one action returning a class set's members.

## 3. No full reload on change -- DONE

`page.tsx` set `loading` on every refresh, and `loading` short-circuits the whole
component to a preloader, so each action unmounted the tab and lost mode, selection,
search and scroll. Split into a separate `refreshing` flag rendered as a small
`aria-live` indicator beside the title.

## Verification

1. `pnpm lint` per touched file against a `git stash` baseline; `pnpm build`.
2. Appoint to `exco-choir`: all five level cards, pick 300, search, appoint -- cabinet
   updates with no full-page preloader.
3. `level-coord-300`: 300 pre-selected and badged "expected"; 500 still selectable.
4. `level-coord-100`: 100 pre-selected, and picking 500 works -- the senior case.
5. `level-coord-500` (`LEVEL:all`): nothing pre-selected, all levels open.
6. Offices page with every unit already having an Exco: the empty state, no form.
7. Creation still refused server-side for a unit that already has one.
8. 360px: breadcrumb wraps, grids single-column, no horizontal scroll.
