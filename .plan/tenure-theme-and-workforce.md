# Tenure identity, the theme palette, and activating Workforce

Three pieces of work that share a spine: a tenure stops being "a row with a name" and
becomes the session's identity, and the Workforce module finally opens to the people who
actually run the units.

Written to be picked up remotely — every section says what exists today, what changes,
and how to tell it worked.

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

`name` is NOT NULL and carries whatever somebody typed — "Staging", "Dominion". It is
read in roughly a dozen places: `src/utils/action.ts:26`, the dashboard overview, the
insurance page, and the handover payloads (`from_tenure_name`, `plannedName`).

### The change

A tenure is identified by three things and nothing else:

| field | required | meaning |
|---|---|---|
| `session` | yes | `2026/2027`. The spine — every level in the fellowship is computed from it. |
| `theme` | **no** | `Arise and Shine`. Unveiled at coronation. |
| `theme_text` | no | The Bible reference the theme is drawn from — `John 1:1-3`, `Isaiah 1:2-3`. A reference, not the verse itself. |

**`name` is dropped.** It was a third name for a thing that already had two, and the two
it had were better.

**The label rule, in one place:** `tenureLabel(t) = t.theme || t.session`. A new helper
in `src/lib/tenure.ts`, used everywhere `tenure.name` is read today. No component
decides this for itself, or the fellowship ends up with screens that disagree about what
the session is called.

### Coronation

**No theme means the tenure has not been coronated.** Coronation (the retreat service) is
where the theme is unveiled, so the absence of a theme is not missing data — it is a
true statement about where the tenure is in its life.

The portal should say so rather than showing a blank: a tenure without a theme reads as
**"2026/2027 · Awaiting coronation"**, and the Tenure page offers the coronation form.

New columns:

```sql
ALTER TABLE public.tenures
    ADD COLUMN theme_text        text,
    ADD COLUMN theme_banner_url  text,
    ADD COLUMN theme_icon_url    text,
    ADD COLUMN theme_palette     jsonb,
    ADD COLUMN coronated_at      timestamptz,
    ADD COLUMN coronated_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.tenures DROP COLUMN name;
```

`coronated_at` is stored rather than inferred from `theme IS NOT NULL`, because "when
were we coronated" is a fact worth keeping and a theme can be edited afterwards.

**`theme_text` is a reference, not prose.** `John 1:1-3`, `Isaiah 1:2-3` — book, chapter,
verse or verse range. Validated loosely (`<book> <chapter>:<verse>[-<verse>]`) so a typo
is caught at entry, but not against a canon list: abbreviations and spellings vary, and a
form that argues with somebody about how to spell "Song of Solomon" is worse than one
that accepts it. Stored as typed; never parsed for meaning.

**A theme is all-or-nothing.** A theme always has a banner, an icon and a palette, so the
coronation form takes all of them together and a partial theme is not a state the system
can be in. Enforced by a CHECK: either every theme column is NULL, or `theme`,
`theme_banner_url`, `theme_icon_url` and `theme_palette` are all present.

### The palette, adopted all round

`theme_palette` is jsonb of the shape:

```json
{ "primary": "#181240", "accent": "#fbbf24", "surface": "#f8fafc", "onPrimary": "#ffffff" }
```

The brand tokens live in the `@theme` block of `src/app/globals.css`
(`--color-rcf-navy`, `--color-rcf-navy-light`, `--color-rcf-gold`). Tailwind v4 reads
those at build time, so the palette cannot *replace* them — but CSS custom properties
set at runtime on `<html>` can override what the utilities resolve to.

The dashboard layout emits a `<style>` block setting `--color-rcf-navy` and friends from
the active tenure's palette. Every existing `bg-rcf-navy` then follows the theme with no
component changes at all.

**Scope: the dashboard, built so it can spread.** The palette repaints the members'
dashboard — that is where a leader spends their time and where the session's identity
belongs. Public event pages and Lo! keep brand navy and gold for now, since they are seen
by people who are not in the fellowship. The mechanism is a single provider emitting
custom properties, so extending it to another layout later is one line there, not a
rewrite.

Three constraints, and they are not negotiable:

- **Falls back to the brand.** No tenure, no theme, or a malformed palette → the
  `@theme` defaults stand. The portal must never render unstyled because a palette was
  half-entered.
- **Contrast is checked, not trusted.** A palette that fails WCAG AA against the
  surfaces it will sit on is rejected at entry with the measured ratio shown, because
  the alternative is a session where nobody can read the sidebar. The check lives in
  `src/lib/palette.ts` and runs both in the form and in the server action.
- **Never `tailwind.config.js`.** This is a CSS-first Tailwind v4 project (AGENTS.md).

### Images

Banner and icon upload through the existing Cloudinary setup
(`NEXT_PUBLIC_CLOUDINARY_*`, as the avatar uploader already does) — not a new
dependency, not base64 in a column.

### Migration and backfill

`name` is dropped, so the data in it must go somewhere first. Backfill: where `theme` is
NULL and `name` is not a session-shaped string, copy `name` into `theme`. Most tenures
were named after their theme anyway. Report what moved rather than doing it silently.

---

## 2. Activate Workforce

### What exists today

- `src/config/sidebar-items.tsx:133` — the Workforce item carries **`comingSoon: true`**.
  That flag is the only thing switching the module off.
- `module_access` already has the right row:
  `('workforce', ARRAY['CENTRAL','EXCO'], ARRAY['EXCO'], 'OWN')`.
- `/dashboard/units` already exists: `admin-view`, `leader-view`, `unit-manager`,
  `level-view`.
- **Assistants already qualify.** `canManageUnit()` in `src/lib/access-control.ts` reads
  EXCO privilege scopes and never looks at `is_lead`, and privileges come from the
  POSITION — which assistants hold. Nothing to build; worth a test so it stays true.

So "activate" is: drop `comingSoon`, then build the features below behind the access
checks that already exist.

### Units that do not recruit

Three units take no members, for two different reasons:

- **Brothers' / Sisters'** — already done. `genderCategory` in
  `src/config/fellowship-units.ts`; membership is computed from `profiles.gender`, the
  add form is replaced by an explanation, and `addWorkerAction` refuses.
- **Secretariat** — new, and a different kind. The office exists to honour the holder
  with an executive seat; it manages nothing in the portal. So it needs its own flag,
  `portalManaged: false`, and it is **not** the same as `genderCategory`: the Sisters'
  Unit has a computed roster, the Secretariat has no roster at all.

  `portalManaged: false` means: no add form, no roster, no Workforce entry for its
  Exco, and `addWorkerAction` refuses. The office keeps its place in the catalogue, its
  tier and its Exco appointment.

### Worker vs. team member

Already the rule, and the module must keep saying it plainly:

- A member is a **worker** once they belong to a **UNIT**. One unit per member per
  tenure, enforced by `enforce_single_unit_membership`, and conflicts queue a transfer
  for the VP Admin rather than failing.
- **TEAMs are unconstrained** — anyone can be on any number of teams, and team
  membership does not make somebody a worker.

### Features

**a. Full member details.** An exco should see their own member the way a level
coordinator sees theirs — bio, academics, contact, unit and teams, and the service
record built in migration 0014. Reuse `MemberDetailView`; gate on `canManageUnit` for
the member's unit rather than on the level.

**b. Birthdays this month.** `profiles.dob` exists and is now populated. A panel listing
the unit's members with a birthday in the current month, sorted by day, with today
highlighted. Server-side by month/day, not by fetching every DOB to the browser.

**c. Logs.** Unit membership currently has no audit trail: `addWorker` and
`removeWorker` write nothing. Add `membership_events` (profile, unit, tenure, action,
actor, timestamp) and a per-unit log view, so "who added this person, and when" has an
answer. Same shape as the existing `invite_events` / `login_events`.

**d. Update link — only when the level coordinator has one.**

This is the subtle one. The update link is `/register?invite=<token>&reason=update`, and
the token lives in `registration_invites`, scoped to a `class_set_id` and owned by that
**level coordinator**. A unit's members span every level, so there is no single token for
a unit.

So: resolve the link **per member**, from that member's own generation. If their level
coordinator has an active token (`is_active`, not revoked, not expired, uses remaining),
the exco can copy it. **If there is no active token, there is no link** — and the UI says
exactly that, naming the generation, rather than showing a dead button:

> *No update link for 300 Level — their coordinator has not issued one.*

The exco is **never** given the power to mint a token. The token is a credential scoped
to a generation, and it belongs to whoever coordinates it.

---

## 3. The Tenure page: how is the session actually faring?

### What exists today

`sessionStats` already returns `totalMembers`, `totalWorkers`, `totalMale`,
`totalFemale`, `totalUnspecified`, `totalUnits`, `totalTeams`, `totalGenerations`, and
`tenure-tab.tsx` shows four cards. It answers "how many", never "so what".

### The change

The page should let an admin see where the tenure needs attention. The example given is
exactly right and becomes the headline:

> **110 members · 45 registered workers (41%)**
> 65 members are not in any unit. Unit leaders may need to register their people, or the
> next induction needs planning.

Panels, each carrying its own "so what":

| panel | what it shows | why an admin looks |
|---|---|---|
| **Workforce coverage** | workers / members, as a bar, with the shortfall named | the induction conversation |
| **Units at a glance** | member count per unit, flagging empty ones and those with no Exco | a unit nobody has joined, or nobody leads |
| **Cabinet completeness** | offices filled / vacant, by tier | who still needs appointing |
| **Generations** | members per level, gender split, and how many of each level are workers | whether one generation is carrying the work |
| **Access** | how many hold an office that grants login, and how many have never set a password | leaders who cannot actually get in |
| **Coronation** | theme, text, banner, or "not yet coronated" | the identity of the session |
| **Transfers** | pending unit transfers awaiting the VP Admin | a queue nobody is watching |

Mobile-first: the coverage bar and headline first, panels stacked, no table wider than
the screen. Every number links to the screen where something can be done about it — a
statistic you cannot act on is decoration.

---

## Files

**New**
```
src/lib/tenure.ts                                   tenureLabel(), coronation helpers
src/lib/palette.ts                                  palette parsing + WCAG AA contrast check
src/app/dashboard/tenure/components/coronation-form.tsx
src/app/dashboard/tenure/components/session-insight.tsx
src/app/dashboard/units/components/birthdays-panel.tsx
src/app/dashboard/units/components/membership-log.tsx
src/app/dashboard/units/components/update-link.tsx
supabase/migrations/<ts>_tenure_theme_and_membership_events.sql
```

**Modified**
```
src/config/sidebar-items.tsx          drop comingSoon from Workforce
src/config/fellowship-units.ts        portalManaged: false on Secretariat
src/app/dashboard/layout.tsx          emit the palette as CSS custom properties
src/app/dashboard/tenure/actions.ts   tenure CRUD loses `name`, gains coronation; richer stats
src/app/dashboard/tenure/components/tenure-tab.tsx   the insight panels
src/app/dashboard/units/actions.ts    member detail, birthdays, log, per-member update link;
                                      refuse Secretariat
src/lib/fellowship.ts                 addWorker/removeWorker write membership_events
src/utils/action.ts, (overview)/page.tsx, settings/insurance/page.tsx,
  handover payloads                   tenure.name -> tenureLabel()
db/seed/default.sql                   regenerate after the Secretariat flag
```

---

## Order of work

1. **Migration + backfill.** Everything else reads these columns.
2. **`tenureLabel()` and the `name` removal** across the app. Mechanical, and it must
   land before any UI is written against the old shape.
3. **Coronation form + palette.** Ends with the portal wearing the session's colours.
4. **Activate Workforce** (drop `comingSoon`, Secretariat flag) — smallest change, and
   it unblocks people using the module while the rest is built.
5. **Workforce features** — details, birthdays, log, update link.
6. **Tenure insight page.**

Steps 4–6 are independent of 1–3 and can run in parallel with them.

---

## Verification

1. `pnpm lint` per touched file against a `git stash` baseline; `pnpm build`.
2. Migration replays from zero on `supabase/postgres:17.6.1.166` and is idempotent;
   the backfill moves names into themes and reports what it moved.
3. A tenure with no theme shows **"2026/2027 · Awaiting coronation"** everywhere a
   tenure is named — overview, insurance page, handover records.
4. Coronation with a full theme repaints the dashboard in the palette; removing the
   theme returns it to brand navy/gold. No row is written to `events` — the retreat is
   not an app-managed event.
4b. `theme_text` accepts `John 1:1-3` and `Isaiah 1:2-3`; rejects `John` and `1:1-3`.
5. A palette failing AA is refused at entry with the measured ratio.
6. A partial theme (banner but no icon) is refused by the CHECK.
7. **Assistants**: appoint an assistant to `exco-choir`, confirm they reach Workforce and
   can add a member — `is_lead` must not matter anywhere.
8. Secretariat Keeper sees the honour, no roster, and `addWorkerAction` refuses; its
    seeded description no longer claims it adds members, and `grants_login` is false.
9. Brothers'/Sisters' still show computed rosters and refuse additions.
10. Update link: with an active 300 Level token, an exco can copy it for a 300 Level
    member; revoke the token and the link disappears, naming the generation. An exco can
    never mint one.
11. Birthdays panel lists only the current month, sorted by day.
12. Adding and removing a member writes `membership_events` rows naming the actor.
13. Tenure page: workforce coverage matches
    `select count(distinct profile_id) from membership_units join units ... where type='UNIT'`.
14. 360px: the coverage bar, panels and log all stack with no horizontal scroll.

---

## Decisions taken

1. **`theme_text` is a Bible reference** — `John 1:1-3`, `Isaiah 1:2-3`. Not the verse
   text, not a description.
2. **The palette repaints the dashboard**, and is built so other areas can adopt it
   without rework. Public pages stay on brand colours for now.
3. **Coronation is NOT an app-managed event.** It is a retreat, held outside the portal,
   and there is no event record to create. The portal only records its *outcome* — the
   theme, its text, its assets, its palette, and when it happened.

   The custom matters here: **nothing really begins until the retreat is done.** So
   "awaiting coronation" is the honest headline state of a young tenure, not a warning
   or an error, and the Tenure page should read that way — a session waiting to start,
   not a record somebody forgot to finish. No feature is *gated* on coronation; the
   portal reports the state, it does not enforce the custom.
4. **The Secretariat Keeper is the one honorary office** (`exco-secretariat`, alias
   already "Secretariat Keeper" in `src/config/fellowship-units.ts:223`). More may follow;
   they take the same `portalManaged: false` flag.

   Two consequences to handle in the same change:

   - Its seeded description, *"Leads Secretariat. Adds and removes its members
     directly."*, becomes false. `gen-default-seed.mjs` builds that sentence from a
     template, so honorary offices need their own wording — something like *"An
     executive seat honouring the Secretariat Keeper. Manages nothing in the portal."*
   - **`grants_login` should be `false`** for an honorary office. A login provisioned for
     somebody with nothing to administer is an account that exists for no reason, and
     accounts that exist for no reason are the ones nobody notices being misused. This is
     a seed default, not a lock — the VP Admin owns the column per office and the change
     is retroactive, so it can be switched on if the Keeper turns out to need the portal
     after all.
