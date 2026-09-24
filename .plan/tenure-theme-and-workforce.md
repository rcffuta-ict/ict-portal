# Tenure identity, the theme palette, and activating Workforce

Three pieces of work that share a spine: a tenure stops being "a row with a name" and
becomes the session's identity, and the Workforce module finally opens to the people who
actually run the units.

Written to be picked up remotely — every section says what exists today, what changes,
and how to tell it worked. Every claim about the current code was checked against the
tree at `0c4768a`; line numbers are from that commit.

---

## 0. Decisions (settled — do not re-open while implementing)

1. **A tenure is its Session, its Theme and its Text** — plus dates, status and the
   coronation assets. **It has no name.** `tenures.name` is dropped, not migrated
   somewhere else.
2. **No theme means not yet coronated.** Coronation (the retreat) is where the theme is
   unveiled. An uncoronated tenure reads **"2026/2027 · Awaiting coronation"** — the
   honest state of a young session, not a warning. Nothing is *gated* on coronation.
3. **Coronation is not an app-managed event.** No `events` row. The portal records only
   its outcome: theme, text, assets, palette, when, and by whom.
4. **`theme_text` is a Bible reference** (`John 1:1-3`, `Isaiah 1:2-3`), not the verse.
5. **The theme is required at coronation; the assets are not.** Banner, icon and palette
   are each optional and each falls back to the brand on its own. A coronation can be
   recorded on retreat day before the designer has finished the banner, and a missing
   asset never leaves the portal unstyled.
6. **The palette repaints the dashboard only**, through one mechanism that another layout
   can adopt later. Public event pages and Lo! stay on brand navy/gold.
7. **Honorary offices are offices that control no unit or team.** The Secretariat Keeper
   is one; the General Secretary and Financial Secretary already are. An honorary office
   is expressed the way the catalogue already expresses it — **no privilege tags** —
   which by the existing rule (`defaultGrantsLogin`, `leadership-positions.ts:96`) also
   means **no portal login** by default. No new flag is invented.
8. **Birthdays are shown per month.** A member born on **29 February is celebrated on
   28 February** in years that are not leap years (on the 29th in leap years).
9. **Update links are never minted by an exco.** They are the level coordinator's
   credential; an exco may only copy one that exists.
10. **Two releases.** The app stops reading `name` in a MINOR release; the column is
    dropped in the following MAJOR release (`pnpm release -- --major`). A rollback of the
    first never meets code that expects a missing column.

---

## 1. A tenure is a Session, a Theme and a Text

### What exists today

```sql
CREATE TABLE public.tenures (
    id, name text NOT NULL, session text NOT NULL,
    start_date date NOT NULL, end_date date, is_active boolean, created_at,
    theme text                              -- already here, already nullable
);
```

`name` is read or written in ~40 places, not a dozen. The full list to change:

| where | what |
|---|---|
| `src/utils/action.ts:26` | `getActiveTenureName()` → `tenureLabel()` (feeds the auth layout + `Copyright`) |
| `src/app/dashboard/(overview)/page.tsx:19` | store read of `activeTenure.name` |
| `src/app/dashboard/settings/insurance/page.tsx:80` | `tenure?.name` |
| `src/app/dashboard/tenure/components/tenure-tab.tsx:68,226` | display + the edit form's **Name** input (remove it) |
| `src/app/dashboard/tenure/components/cabinet-tab.tsx:47` | "Active Tenure: …" |
| `src/app/dashboard/tenure/components/handover-wizard.tsx` | `form.name` + `form.theme` inputs, validation at :185, summary rows — see *Handover* below |
| `src/app/dashboard/tenure/components/handover-index.tsx`, `handover-record.tsx` | `fromTenure.name`, `plannedName` |
| `src/app/dashboard/tenure/actions.ts` | :232 create, :255 update, :342 select, :509 handover insert, :1697–1857 handover intents |
| `src/lib/backup.ts:154,156` | selects `name` into the backup manifest |
| `scripts/seed-staging.mjs:307–369` | creates the tenure with a name and prints it |
| `scripts/restore-backup.mjs:120,152` | prints `manifest.tenure.name` — **keep reading it as a fallback**: every backup taken before this change carries it |
| `scripts/ict-coord.mjs`, `scripts/backup.mjs` | check each for `name` |
| `src/lib/stores/tenure.store.ts` | the tenure type |

Grep `\.name\b` near `tenure` / `Tenure` again before closing step 2 — this list is a
starting point, not a proof.

### The change

| field | required | meaning |
|---|---|---|
| `session` | yes | `2026/2027`. The spine — every level is computed from it. |
| `theme` | at coronation | `Arise and Shine`. NULL until coronated. |
| `theme_text` | at coronation (form) | `John 1:1-3`. A reference, stored as typed. |

**The label rule, in one place** — `src/lib/tenure.ts`:

```ts
tenureLabel(t)      // t.theme ?? t.session                 → "Arise and Shine" | "2026/2027"
tenureFullLabel(t)  // "Arise and Shine · 2026/2027"  |  "2026/2027 · Awaiting coronation"
isCoronated(t)      // !!t.theme
```

No component decides this for itself. Short label for tight spaces (sidebar, copyright),
full label wherever a tenure is *named* (overview, insurance, handover records, backups).

### Columns

```sql
ALTER TABLE public.tenures
    ADD COLUMN theme_text        text,
    ADD COLUMN theme_banner_url  text,
    ADD COLUMN theme_icon_url    text,
    ADD COLUMN theme_palette     jsonb,
    ADD COLUMN coronated_on           date,   -- the day of the retreat, NOT the start date
    ADD COLUMN coronation_recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
```

**Constraints** — the state the database can be in, stated once:

```sql
-- Coronated = has a theme; a theme is never blank.
CHECK (theme IS NULL OR btrim(theme) <> '')
-- Nothing theme-shaped exists without a theme, a coronation date included.
CHECK (theme IS NOT NULL OR (theme_text IS NULL AND theme_banner_url IS NULL
                             AND theme_icon_url IS NULL AND theme_palette IS NULL
                             AND coronated_on IS NULL AND coronation_recorded_by IS NULL))
-- The palette, if present, is an object (shape + contrast are checked in the app).
CHECK (theme_palette IS NULL OR jsonb_typeof(theme_palette) = 'object')
```

`theme_text` and `coronated_on` are NOT required by the database, only by the
coronation form, because tenures themed before this change have neither on record. The
Tenure page shows *"Theme text not recorded"* / *"Coronation date not recorded"* for
those, with the form one tap away.

**The coronation date is not the start date** (decision from review). The retreat
happens some time into the session, so `coronated_on` is a date the VP Admin enters —
never derived from `start_date`, and never "the moment the form was submitted".

### Migration and backfill (MINOR release)

In order, in one migration made with `supabase migration new tenure_identity_and_workforce`:

1. Add the columns (above), `IF NOT EXISTS` so a replay is harmless.
2. **Existing themes are coronations with an unknown date.** `coronated_on` stays NULL
   (not guessed from the start date); `RAISE NOTICE` each one so the date gets entered.
3. **Names are not copied anywhere.** A name is not tenure information (decision 1), and
   copying `"Staging"` into `theme` would falsely declare a coronation. `RAISE NOTICE`
   each `(session, name)` whose name differs from its theme, so the VP Admin knows which
   tenures to coronate from the Tenure page. The values also survive in every backup
   taken before the release — **take one** (`pnpm backup`) before applying to production.
4. `ALTER COLUMN name DROP NOT NULL` — so the new code, which never writes it, can
   create tenures. The column stays for one release.
5. Add the three CHECKs.
6. The Workforce/Secretariat/birthday pieces from sections 2–3 (same migration keeps the
   MINOR a single step).

### Drop (MAJOR release, the next one)

A separate migration, `drop_tenure_name`: `ALTER TABLE public.tenures DROP COLUMN IF EXISTS name;`
Released with `--major`. Before writing it, grep the other applications that share this
database (AGENTS.md: four hold FKs to `profiles`) for `tenures` — if any reads `name`,
it must move first.

`handover_intents.from_tenure_name` **stays**. It is a snapshot taken at the time of the
handover, not a reference; from now on it is written with `tenureFullLabel()`.

### Handover

Handover opens a new session; it does not coronate one. So the wizard **loses both its
Name and its Theme inputs** and asks only for session and start date. The new tenure is
created uncoronated and reads *"Awaiting coronation"* until the retreat. `payload.name`
disappears from new intents; `handover-record.tsx` falls back to `payload.name` only
when rendering intents recorded before this change, and otherwise shows the planned
session.

### Coronation form

`src/app/dashboard/tenure/components/coronation-form.tsx`, opened from the Tenure page.
Write gate: the same check that guards tenure edits today (VP Admin / System Admin via
`requireModuleWrite`), re-checked in the server action — never trusted from the UI.

- **Theme** — required, 2–80 chars.
- **Theme text** — required, validated loosely:
  `^(?:[1-3]\s?)?[A-Za-z][A-Za-z .']+\s\d{1,3}:\d{1,3}(?:[-–]\d{1,3})?$`.
  Accepts `John 1:1-3`, `Isaiah 1:2-3`, `1 John 4:7`, `Song of Solomon 2:4`;
  rejects `John`, `1:1-3`. Not checked against a canon list; stored as typed.
- **Banner, icon** — optional; upload through `src/lib/cloudinary.ts` (add
  `uploadThemeImage` beside `uploadAvatar`, same size/type checks).
- **Palette** — optional; four colour pickers with a live preview of the sidebar and a
  button, and the measured contrast ratios shown as you pick.
- **Coronation date** — required, a date picker (the day of the retreat). Defaults to
  empty, never to today or the start date.
- Re-submitting edits the theme and its details; `coronation_recorded_by` is whoever
  last saved. "Remove theme" clears every theme column **and** `coronated_on` together
  (the CHECK makes anything else impossible) behind a confirm. Until this form exists,
  the Tenure edit modal's Theme field does the same clearing (step 2).

react-hook-form + zod; inline errors; pending/disabled submit.

### The palette

```json
{ "primary": "#181240", "primaryLight": "#2a2257", "accent": "#fbbf24" }
```

Three keys, one per brand token — because those are the three tokens the app actually
uses (`--color-rcf-navy`, `--color-rcf-navy-light`, `--color-rcf-gold` in
`src/app/globals.css`). The earlier `surface` / `onPrimary` keys are dropped: nothing
reads a surface token, and text on navy is a hard-coded `text-white` in ~250 places, so
white is what the contrast check must assume. `primaryLight` may be omitted and is then
derived from `primary` (mix 12% white).

**`src/lib/palette.ts`** (pure, importable by both client form and server action):

- `parsePalette(json)` → palette | null. Every value must match `^#[0-9a-fA-F]{6}$`
  exactly. **This is a security boundary, not tidiness**: the values are written into a
  `<style>` block, so anything looser allows CSS injection or a `</style>` breakout.
- `checkPalette(p)` → `{ ok, failures: [{ pair, ratio, needed }] }`, WCAG 2.1 AA:
  - white on `primary` ≥ 4.5 (sidebar, buttons, headers)
  - white on `primaryLight` ≥ 4.5 (hover states)
  - `accent` on `primary` ≥ 3.0 (gold highlights and icons on navy — large/graphic)
- A failing palette is refused **in the form and again in the server action**, with the
  measured ratio shown ("White on primary is 2.9:1 — needs 4.5:1").

**Where it's applied.** `src/app/dashboard/layout.tsx` is a `"use client"` component, so
it cannot emit the style on the server as the first draft assumed. Instead:

1. Move the current client layout body to `src/app/dashboard/dashboard-shell.tsx`
   (unchanged, still `"use client"`).
2. Make `layout.tsx` a server component that reads the active tenure's palette
   (`getActiveTenure()`), runs `parsePalette` + `checkPalette`, and renders
   `<ThemeStyle palette={…} />` then `<DashboardShell>{children}</DashboardShell>`.
3. `src/components/layout/theme-style.tsx` renders
   `<style>{":root{--color-rcf-navy:…;--color-rcf-navy-light:…;--color-rcf-gold:…}"}</style>`
   — or nothing at all when there is no valid palette, so the `@theme` defaults stand.

Tailwind v4 utilities resolve through `var(--color-rcf-*)`, so every `bg-rcf-navy`
follows with no component changes. Server-rendered means the right colours are in the
first paint — no navy flash on a slow connection. Extending to another layout later is
one `<ThemeStyle>` line.

**Image URLs are validated server-side**: accept only
`https://res.cloudinary.com/<NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME>/…`. The upload is
unsigned and client-side; without this check anyone who reaches the action can make
every dashboard load an image from a server of their choosing. Render with `next/image`
(add the Cloudinary host to `images.remotePatterns` if it isn't there).

---

## 2. Activate Workforce

### What exists today

- `src/config/sidebar-items.tsx:137` — Workforce carries **`comingSoon: true`**, the only
  thing switching it off.
- `module_access` already has `('workforce', ARRAY['CENTRAL','EXCO'], ARRAY['EXCO'], 'OWN')`.
- `/dashboard/units` already has `admin-view`, `leader-view`, `unit-manager`,
  `level-view`, `appoint-panel`, `unit-leadership-card`, `unit-positions-manager`.
- **Assistants already qualify.** `canManageUnit()` (`access-control.ts:186`) reads EXCO
  privilege scopes from the POSITION and never looks at `is_lead`.

"Activate" = drop `comingSoon`, then build 2a–2d behind the checks that already exist.

### Honorary offices — the Secretariat Keeper

**Today** the Secretariat is a **TEAM** in `src/config/fellowship-units.ts:220`, and the
seed generator derives `exco-secretariat` from it with `EXCO:secretariat` and
`grants_login = true`. That is why the Keeper would appear in Workforce.

**The change** — make it honorary the way `gen-sec` and `fin-sec` already are:

1. **Remove the `secretariat` entry from `FELLOWSHIP_UNITS`.** An honorary office
   controls no team, and a team nobody manages is dead weight in every picker.
2. **Add `exco-secretariat` to the fixed offices** in `src/config/leadership-positions.ts`,
   next to `gen-sec`: **same slug** (existing `leadership` rows and service history point
   at it), title `Secretariat Keeper`, tier `EXECUTIVE`, `privileges: []`, description
   *"An executive seat honouring the Secretariat Keeper. Honorary in the portal — no
   access unless the VP Admin grants it."* With no tags, `defaultGrantsLogin` returns
   false — no new flag, no special case.
3. `pnpm db:gen-seed`. The parser needs **no change** (no new key). Confirm the unit
   count guard passes and `exco-secretariat` now appears among the fixed offices.

**The seed alone does not reach live databases** — it never deletes and sets
`grants_login` on INSERT only. So the migration (section 1, step 6) also:

- deletes the `position_privileges` row `(exco-secretariat, EXCO, 'secretariat')`;
- sets `exco-secretariat`'s title/description/tier as above;
- sets `grants_login = false` for `exco-secretariat` **only if it is still `true`** and
  `RAISE NOTICE`s that it did. This overrides a VP Admin choice exactly once, which is
  acceptable because nobody could have chosen it deliberately — the office only arrived
  in `20260920162209`;
- **revokes current holders' access the way `deprovisionLoginIfUnappointed`
  (`src/lib/auth/provision.ts:134`) does**: for each current (active tenure,
  `ended_at IS NULL`) holder of `exco-secretariat` who holds **no other** current office
  with `grants_login`, revoke their `auth_sessions` exactly as `revokeAllSessions` does
  (read it first — mirror its columns and reason) and delete their `profile_login`.
  Report the count. Someone who is Keeper *and* a unit exco keeps their login;
- deletes the `secretariat` row from `units` **only if** no `membership_units` or
  `position_privileges` row references it; otherwise leaves it and `RAISE NOTICE`s why.

The Keeper stays on the cabinet screen, in the Executive tier, on their service record.
The VP Admin can still switch the login on from the cabinet screen if it's ever needed.

**Brothers' / Sisters'** are unchanged: computed from `profiles.gender`, add form
replaced by an explanation, `addWorkerAction` refuses. Verify, don't rebuild.

### Worker vs. team member (unchanged rule — keep saying it in the UI)

- A **worker** belongs to a **UNIT** — one per member per tenure
  (`enforce_single_unit_membership`); a conflict queues a transfer for the VP Admin.
- **TEAMs are unconstrained** and do not make anyone a worker.

### 2a. Full member details

An exco sees their member the way a level coordinator does — bio, academics, contact,
unit and teams, service record (0014). Reuse
`src/app/dashboard/level/components/member-detail-view.tsx`; it's now needed by a second
route, so **promote it to `src/components/dashboard/member-detail-view.tsx`** (AGENTS.md
rule) and update the level import. New route
`/dashboard/units/[unitId]/member/[profileId]`, gated by `canManageUnit(ctx, unitId)`
**and** a check that the profile is actually in that unit this tenure — otherwise any
exco could read any member by editing the URL.

### 2b. Birthdays by month

`birthdays-panel.tsx` in the unit view: a month selector (defaults to this month,
prev/next arrows), members of that unit with a birthday in the chosen month, sorted by
day, today highlighted, empty state "No birthdays in March".

Server-side, never shipping every DOB to the browser — supabase-js can't filter on
`extract(month …)`, so a SQL function in the migration:

```sql
public.rcf_unit_birthdays(p_unit_id uuid, p_tenure_id uuid, p_month int, p_year int)
RETURNS TABLE (profile_id uuid, first_name text, last_name text, avatar_url text, celebrate_day int)
```

Rule for the celebrated day, written once in SQL:

- `dob` is 29 Feb **and** `p_year` is not a leap year → listed in **February on the 28th**;
- otherwise → the dob's own month and day.

Returns name and day only — **never the year of birth** (age is personal). The action
gates on `canManageUnit` before calling it. Birthdays are shown to the unit's managers
only, not to other members.

### 2c. Membership log

New table in the migration, same shape as `invite_events` / `login_events`:

```sql
membership_events (id, profile_id, unit_id, tenure_id,
                   action text CHECK (action IN ('added','removed','transferred_in',
                                                  'transferred_out','carried_over')),
                   actor_id uuid NULL, actor_name text, created_at)
```

RLS enabled and forced, no policies (house rule). Written from **every** path that
changes `membership_units`, not just two:

| path | where | event |
|---|---|---|
| `addWorker` | `src/lib/fellowship.ts:153` | `added` |
| `removeWorker` | `src/lib/fellowship.ts:175` | `removed` — **read the row and write the event before the delete** |
| `approveTransferAction` | `tenure/actions.ts:1606` | `transferred_out` + `transferred_in` |
| handover carry-over | `tenure/actions.ts:625–645` | `carried_over`, one bulk insert per chunk, actor = the VP Admin |

`membership-log.tsx`: newest first, 20 per page, "Ada Obi was added by John Musa ·
3 Sep". Visible to `canManageUnit` for that unit.

### 2d. Update link — only when the level coordinator has one

The link is `/register?invite=<token>&reason=update`. Tokens live in
`registration_invites`; the one a level coordinator issues is **`purpose = 'level'`**,
and the partial unique index `registration_invites_one_active_level_token` guarantees at
most one active per `class_set_id`.

Resolve **per member**, from their own generation: active means `purpose = 'level'`,
`is_active`, `revoked_at IS NULL`, `expires_at` null or future, `max_uses` null or
`use_count < max_uses`. Ignore per-member (`target_profile_id`) tokens — those were
issued for somebody specific.

- Active token → **Copy update link** (`update-link.tsx`).
- None → no button, and the words: *"No update link for 300 Level — their coordinator
  has not issued one."*

The token is resolved in the server action at click time, not embedded in the page, and
each copy writes an `invite_events` row. That requires adding `'copied'` to
`invite_events_action_check` in the migration (drop + re-add the constraint). An exco
**never** mints a token — no code path from Workforce inserts into `registration_invites`.

---

## 3. The Tenure page: how is the session actually faring?

### What exists today

`sessionStats` (`tenure/actions.ts`) returns totals; `tenure-tab.tsx` shows four cards.
It answers "how many", never "so what".

### The change

Headline first:

> **2026/2027 · Awaiting coronation**
> **110 members · 45 workers (41%)**
> 65 members are in no unit. Unit leaders may need to register their people, or the
> next induction needs planning.

Panels, stacked on mobile, each carrying its "so what" and linking to where it's fixed:

| panel | shows | links to |
|---|---|---|
| **Coronation** | theme + text + banner, or "Awaiting coronation" with the form | coronation form |
| **Workforce coverage** | workers / members bar, shortfall named | Workforce |
| **Units at a glance** | members per UNIT; flags empty units and units with no Exco | that unit |
| **Cabinet completeness** | offices filled / vacant by tier (honorary offices counted, marked honorary) | cabinet tab |
| **Generations** | members per level, gender split, workers per level | level page |
| **Access** | holders of login-granting offices; how many never set a password | cabinet tab |
| **Transfers** | pending transfers awaiting the VP Admin | transfers tab |

**Definitions, fixed so the numbers agree everywhere:**

- *member* — a profile counted by the existing `sessionStats.totalMembers`.
- *worker* — distinct `profile_id` in `membership_units` for the **active tenure**,
  joined to `units` with `type = 'UNIT' AND is_workforce`. (Brothers'/Sisters' have
  `is_workforce = false` and are computed from gender — they must not count.)

Compute everything in one server action with parallel queries (or one RPC if it grows
past ~8 round trips); the page gets one payload. 360px: headline and bar first, no table
wider than the screen — per-unit and per-level lists render as stacked rows, not tables.

---

## Files

**New**
```
src/lib/tenure.ts                                  tenureLabel, tenureFullLabel, isCoronated
src/lib/palette.ts                                 parsePalette (strict hex), checkPalette (WCAG AA)
src/components/layout/theme-style.tsx              the <style> emitter
src/app/dashboard/dashboard-shell.tsx              current client layout body, moved
src/app/dashboard/tenure/components/coronation-form.tsx
src/app/dashboard/tenure/components/session-insight.tsx
src/app/dashboard/units/[unitId]/member/[profileId]/page.tsx
src/app/dashboard/units/components/birthdays-panel.tsx
src/app/dashboard/units/components/membership-log.tsx
src/app/dashboard/units/components/update-link.tsx
supabase/migrations/<ts>_tenure_identity_and_workforce.sql     (MINOR)
supabase/migrations/<ts>_drop_tenure_name.sql                  (MAJOR, next release)
```

**Moved**
```
src/app/dashboard/level/components/member-detail-view.tsx
  → src/components/dashboard/member-detail-view.tsx
```

**Modified**
```
src/app/dashboard/layout.tsx                 server component: palette + <DashboardShell>
src/config/sidebar-items.tsx                 drop comingSoon from Workforce
src/config/fellowship-units.ts               remove the secretariat TEAM
src/config/leadership-positions.ts           exco-secretariat as a fixed honorary office
db/seed/default.sql                          regenerated (pnpm db:gen-seed)
src/lib/cloudinary.ts                        uploadThemeImage
src/lib/fellowship.ts                        addWorker/removeWorker write membership_events
src/lib/backup.ts                            manifest: session/theme/theme_text, no name
src/lib/stores/tenure.store.ts               tenure type
src/app/dashboard/tenure/actions.ts          no name; coronation action; handover without
                                             name/theme; transfer + carry-over events;
                                             richer stats
src/app/dashboard/tenure/components/*        tenure-tab, cabinet-tab, handover-wizard,
                                             handover-index, handover-record
src/app/dashboard/units/actions.ts           member detail, birthdays, log, update link
src/utils/action.ts, (overview)/page.tsx, settings/insurance/page.tsx
scripts/seed-staging.mjs, scripts/restore-backup.mjs (fallback only),
  scripts/ict-coord.mjs, scripts/backup.mjs
next.config.ts                               Cloudinary remotePattern, if missing
AGENTS.md                                    honorary offices; tenure has no name
```

---

## Order of work

1. ✅ **Migration (MINOR)** — `20260924095226_tenure_identity_and_workforce.sql`:
   columns, backfill notices, `name` nullable, CHECKs, Secretariat data fix,
   `membership_events`, `rcf_birthdays`, `'copied'` action. **The Secretariat config +
   seed regen moved here from step 3**: CI applies `db/seed/default.sql` right after the
   migrations, and the old seed would have put the team and its EXCO tag straight back.
   Rehearsed from zero on local PG16 (CI replays on 17), idempotent on re-run.
   - Birthdays take **profile ids**, not a unit (`rcf_birthdays(ids, month, year)`):
     the Brothers'/Sisters' rosters are computed from gender in the app, so the app
     resolves the roster and SQL only filters by month.
2. ✅ **`src/lib/tenure.ts` + remove every `name` read/write** (table in §1), including
   handover and scripts. Mechanical; must land before any new UI.
   ✅ Done. `name` is no longer read or written anywhere; the column is nullable and
   stays until step 8. Legacy fallbacks kept on purpose: `restore-backup.mjs` reads
   `manifest.tenure.name` from old backups, and handover records read `payload.name`
   from intents begun before this change. `handover_intents.from_tenure_name` is now
   written with `tenureFullLabel()` (surfaced as `fromTenure.label`).
3. **Workforce switch-on** — drop `comingSoon`. (Secretariat already done in step 1.)
4. **Workforce features** — 2a details, 2b birthdays, 2c log, 2d update link.
5. **Coronation form + palette** — ends with the dashboard in the session's colours.
6. **Tenure insight page.**
7. Release MINOR. Coronate the active tenure from the UI.
8. **Drop migration**, release MAJOR.

Steps 3–4 and 5 are independent once 1–2 are in.

---

## Verification

1. `pnpm lint` per touched file against a `git stash` baseline; `pnpm build`.
2. Both migrations replay from zero on `supabase/postgres:17.6.1.166`, and re-running
   the first is harmless. Notices list the assumed coronations and the dropped names.
3. An uncoronated tenure shows **"2026/2027 · Awaiting coronation"** on the overview,
   insurance page, cabinet tab, handover records and auth pages. `grep -rn "tenure.*\.name"`
   finds nothing that reads the column.
4. Handover creates an uncoronated tenure; the wizard has no name or theme field. An
   intent recorded before the change still renders its planned name.
5. Coronation with theme + text only → coronated, brand colours. Add a palette → the
   dashboard repaints on first load (no flash). Remove the theme → every theme column and
   `coronated_on` clear, brand returns. Public event pages and Lo! never change colour.
   No row is written to `events`.
6. `theme_text` accepts `John 1:1-3`, `Isaiah 1:2-3`, `1 John 4:7`, `Song of Solomon 2:4`;
   rejects `John` and `1:1-3`.
7. A palette with white-on-primary below 4.5:1 is refused in the form **and** by the
   action (call it directly), with the ratio shown. `"#fff;}</style>"` is refused.
8. SQL: clearing `theme` while `coronated_on` is set fails; a blank theme fails;
   setting `theme_banner_url` on an uncoronated tenure fails.
9. A banner URL outside the Cloudinary cloud is refused by the action.
10. **Assistants:** appoint an assistant (`is_lead = false`) to an exco office that
    grants login (e.g. `exco-choir`); they sign in, reach Workforce, add a member.
11. **Secretariat Keeper:** on the cabinet screen in the Executive tier, marked honorary;
    no Workforce entry; no `EXCO:secretariat` privilege; `grants_login = false`; a
    holder with no other office loses their login and sessions; a holder who is also a
    unit exco keeps theirs. The Secretariat is gone from team pickers.
12. Brothers'/Sisters' still show computed rosters and refuse additions.
13. Member detail: an exco opens their own unit's member; editing the URL to another
    unit's member is refused.
14. Birthdays: only the chosen month, sorted by day, today highlighted, no birth years in
    the payload. A 29 Feb member shows under February on the **28th** in 2027 and on the
    29th in 2028.
15. Update link: with an active 300 Level `level` token, an exco copies it and an
    `invite_events` `copied` row names them. Revoke it → the button is replaced by the
    "No update link for 300 Level" line. No Workforce path inserts a token.
16. Add, remove, approve a transfer, and run a staging handover → `membership_events`
    rows for each, naming the actor.
17. Tenure page worker count equals
    `select count(distinct mu.profile_id) from membership_units mu join units u on u.id = mu.unit_id
     where mu.tenure_id = <active> and u.type = 'UNIT' and u.is_workforce`.
18. 360px: headline, coverage bar, panels, birthdays and log all stack with no
    horizontal scroll.

---

## Security notes (call out in the PR)

- `<style>` injection: palette values are strict `#rrggbb`, validated server-side.
- Remote images: only the project's own Cloudinary cloud.
- Update-link tokens: resolved server-side at click time, copies logged, never minted
  by an exco.
- Member detail and birthdays: gated per unit, re-checked in the action, no birth year.
- The Secretariat migration revokes logins and sessions — it touches `profile_login`
  and `auth_sessions` directly, so it mirrors `provision.ts` exactly and reports counts.
- `membership_events` is RLS-forced with no policies, like every other table.
