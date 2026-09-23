# Release versioning + structural database refresh

Target: the PRODUCTION Supabase project, ahead of handover to a successor.
Scope of THIS plan: **structure only.** No seed data, no truncation of live rows
beyond the dead objects being dropped. Seeding is a separate, later conversation.

## What the live dump changed about my assumptions

`.tmp/current-db-state.sql` (77 tables) corrects three things:

1. **Migrations 0010, 0011 and 0012 are already applied.** `admin_audit_log`,
   `unit_transfer_requests`, `handover_intents` and `handover_events` all exist in
   production. My earlier "apply these by hand" note is obsolete.
2. **The `auth.users` FK is already gone.** `profiles.id` is now
   `uuid DEFAULT gen_random_uuid()` with no FK — migration 0001 did its job. What
   remains is the *rows* still sitting in Supabase's `auth.users`, which are now
   orphaned and meaningless. That is a data purge, not a schema change.
3. **`db/db-schema.sql` is wrong in BOTH directions.** It is a dump taken before
   0001 with 0009-0012 hand-appended. It is missing 12 tables production has, and
   it still contains `fyb_pairings`, which production no longer has.

## Drift inventory

### A. Portal-owned and provably dead (0 references in `src/`, 0 in migrations)

| Object | Why it goes |
|---|---|
| `verification_codes` (table) | dead since the email feature was removed |
| `question_flags` (table) | built, never wired to any UI |
| `question_references` (table) | same |
| `leadership.can_manage_unit` (col) | superseded by privilege tags (0006) |
| `event_registrations.raffle_id` (col) | one-off for a single past event |

### B. Portal-owned legacy, still read — needs a code change before the drop

These are pre-privilege-tag leftovers on `leadership_positions`. `tenure/actions.ts:896`
now *writes* `category`/`is_central` purely to keep the old shape satisfied — the schema
is being maintained for its own sake.

| Column | Superseded by | Read sites to migrate |
|---|---|---|
| `category` | `tier` (display) + `position_privileges` (authz) | `utils/action.ts:71`, `tenure/actions.ts:56,896`, `settings/actions.ts:47`, `units/actions.ts:391`, `appoint-panel.tsx:302` |
| `is_central` | `CENTRAL` privilege tag | `tenure/actions.ts:56,896` |
| `is_default` | `is_protected` (0011) | `utils/action.ts:66,71`, `appoint-panel.tsx:302,306` |
| `alias` | `slug` (0004) | `settings/actions.ts:47,62` |

### C. NOT ours — do not touch, ever

Production hosts at least four other apps in the same `public` schema. None of these
appear in this repo's `src/` or in any migration:

```
rw_*        ReadWrite store (18 tables, incl. rw_sponsors, rw_sponsor_leads)
fyb_*       Final Year Brethren (14 tables; fyb_pairings is gone, fyb_pair_intents replaced it)
elib_*      E-library (3 tables)
game_*, trivia_*, bingo_*, buzzer_*   a games/engagement app (11 tables)
```

### D. Unknown — needs your call, I will not guess

`public.categories` — byte-for-byte identical in shape to `rw_categories`, zero
references in this repo, not in any migration. Almost certainly an early draft of the
store's category table that was never dropped. **I am not touching it.** Flagged for you
to confirm with whoever owns ReadWrite.

## Part 1 — Versioning (`MAJOR.MINOR.PATCH`)

Your rule, made mechanical:

- **PATCH** — code only. Nothing under `db/migrations/` changed.
- **MINOR** — any new migration. The database moved.
- **MAJOR** — a release that is not safely reversible: dropped columns/tables, or a
  migration requiring a manual data step. **This cleanup is `1.0.0`** — it drops
  objects, and it is the version the successor inherits.

### `schema_migrations` (migration 0013)

```sql
create table public.schema_migrations (
    id           text primary key,      -- '0013'
    version      text not null,         -- '1.0.0'  the release that shipped it
    name         text not null,         -- 'structural_cleanup'
    checksum     text not null,         -- sha256 of the file as applied
    applied_at   timestamptz not null default now(),
    applied_by   text                   -- whoever ran it
);
```

Every migration ends by recording itself. 0013 backfills 0001-0012 as applied, since
the live dump proves they were. This is the single most valuable artifact for the
successor: `select * from schema_migrations order by id` answers "what state is this
database in", which today is unanswerable.

### Automated CHANGELOG — `scripts/release.mjs`

No dependencies, same conventions as `bootstrap-admin.mjs`:

1. Diff `db/migrations/` between `HEAD` and the last `v*` tag → decides MINOR vs PATCH.
2. Read commits since that tag, group by conventional-commit prefix (`feat:`, `fix:`,
   `refactor:`), which this repo already uses consistently.
3. Bump `package.json`, prepend a `CHANGELOG.md` section listing the commits **and any
   migrations the release contains, named**, and write the version into the new
   migration's `schema_migrations` insert.
4. `--dry-run` by default. Prints the proposed version and entry; `--commit` tags.

Deliberately no runtime version check, per your answer.

## Part 2 — Migration 0013, structural cleanup

Ordered, one transaction, idempotent:

1. `create table schema_migrations`; backfill 0001-0012.
2. Code changes for section B land **first** (same PR, before the migration is run),
   then drop `category`, `is_central`, `is_default`, `alias`.
3. Drop section A: three tables, two columns.
4. **RLS audit** — assert every portal-owned table has RLS enabled AND forced. The live
   dump shows `zone_pastors` was added outside the migration series; it has never been
   through 0001's lockdown pass. A portal table readable by the anon key is a data leak,
   so this fails loudly rather than fixing silently.
5. Record itself as `0013` / `1.0.0`.

**Not in scope, flagged instead:** `profiles.entry_year` duplicates what `class_set_id`
already implies, but both are read in live code paths and collapsing them is a data
migration, not a structural one. It belongs in its own release.

## Part 3 — Tooling for the successor

```
scripts/db-inventory.mjs    row counts for every table, split into
                            PORTAL (ours) / FOREIGN (rw_, fyb_, elib_, game_*)
                            / UNCLASSIFIED (anything new — `categories` shows up here).
                            Read-only. Run it before and after any migration.
scripts/release.mjs         version + CHANGELOG, above.
scripts/purge-auth-users.mjs  deletes orphaned Supabase auth.users rows. Separate,
                            --dry-run default, and loud: it touches the `auth` schema.
```

### The auth.users trap — read before running anything

`public.auth_sessions` is **ours** (migration 0001, DB-backed opaque sessions). It has
nothing to do with Supabase Auth and must never be dropped as part of "removing
auth.users". The two names are close enough that a tired successor will conflate them;
`purge-auth-users.mjs` will refuse to touch any table in `public` for exactly that
reason.

## Order of operations against production

1. `pnpm build` green locally.
2. **Full backup first**, via the existing `/dashboard/tenure/backup` route —
   all tables, JSON, encrypted, `.rcfvault`. This is the undo.
3. `node scripts/db-inventory.mjs` → save the output as the before-picture.
4. Apply 0013 in the Supabase SQL editor.
5. Re-run inventory; diff against the before-picture. Only the five dropped objects
   should differ, and no FOREIGN row count may change.
6. Regenerate `db/db-schema.sql` from the live dump so it finally tells the truth.
7. `node scripts/release.mjs --commit` → `v1.0.0`, CHANGELOG written.

## Files

**New**
```
db/migrations/0013_structural_cleanup.sql
scripts/release.mjs
scripts/db-inventory.mjs
scripts/purge-auth-users.mjs
CHANGELOG.md
```

**Modified**
```
package.json                          version 0.1.0 -> 1.0.0
db/db-schema.sql                      regenerated from the live dump
src/utils/action.ts                   is_default/category -> is_protected/tier
src/app/dashboard/tenure/actions.ts   stop writing category/is_central
src/app/dashboard/settings/actions.ts alias -> slug
src/app/dashboard/units/actions.ts    drop category from the select
src/app/dashboard/units/components/appoint-panel.tsx
README.md                             document the version rule + migration workflow
```

## Verification

1. Per-file `npx eslint` against a `git stash` baseline; `pnpm build`.
2. Re-run 0013 immediately after itself — must be a no-op, not an error.
3. `grep -rn "category\|is_central\|is_default\|\.alias" src/` returns nothing pointing
   at `leadership_positions` before the drop runs.
4. Inventory diff shows zero change to any `rw_`/`fyb_`/`elib_`/`game_` row count.
5. `release.mjs --dry-run` on a migration-free commit proposes a PATCH; on this commit
   proposes MAJOR.

---

# REVISION — backup tiers, and the two seeds

## Part 0 (amended) — the backup that guards this work

There are now **two** backups, and they are not the same product:

| | Tenure backup (lite) | System insurance (full) |
|---|---|---|
| Who | VP Admin | System Admin / ICT Coord only |
| Scope | ONE tenure, tenure-scoped tables filtered | **Everything. Every tenure, every table, all history** |
| Where | `/dashboard/tenure/backup` (exists) | `/dashboard/settings/insurance` (new) |
| Purpose | the handover gate — proof this tenure was captured | the undo for a structural change to the database |
| Encryption | optional, defaults to the tenure president's name | **mandatory**, no `lock=0` escape |

The existing route stays exactly as it is; the wizard depends on it. The new one reuses
`buildBackup()` with tenure scoping switched off, plus an explicit **FOREIGN APPS** group
in the picker (`rw_*`, `fyb_*`, `elib_*`, `game_*`) that is **off by default and clearly
labelled as other teams' data**. Off by default because a portal admin exporting the
store's customer list by accident is a real privacy problem; available at all because
the whole point of insurance is that the successor can put the project back.

**This full backup is step 2 of the production runbook, not the lite one.** A tenure-scoped
backup cannot restore a dropped column.

## Part 4 (correction) — ICT Coordinator is an EXECUTIVE

You're right, and the current code has it wrong. `src/config/leadership-positions.ts`
declares `tier: "SYSTEM"` for `ict-coord`. It becomes:

```ts
{
    slug: "ict-coord",              // immutable
    title: "ICT Coordinator",
    alias: "ICT Coord",
    tier: "EXECUTIVE",              // was SYSTEM
    privileges: [
        { tag: "SYSADMIN", scope: null },
        { tag: "EXCO", scope: "ict" },
    ],
}
```

Being an executive is about *where they sit in the hierarchy*, which is `tier` — it does
not weaken `SYSADMIN`, because authorization has only ever read privilege tags. The
second tag is the substantive part: the ICT Coordinator leads the Information and
Communications Unit like any other exco, so they get that unit's `EXCO` scope and the
derived-position generator must **skip minting `exco-ict`**,
or that unit ends up with two leaders.

The `SYSTEM` tier itself is then unused and comes out of `POSITION_TIERS`.

**One thing to confirm when you see it:** this makes ICT Coord an exco *and* the System
Admin. If you would rather the ICT Coordinator hold SYSADMIN without leading the ICT
unit, say so and I'll drop the EXCO tag and keep the unit's own derived position.

## Part 5 — DEFAULT SEED (`db/seed/default.sql`, runs in production)

Bootstrap data, not test data. Idempotent, safe to re-run, and **re-runnable as a
"reset seed" that returns the catalogue to canonical state** without touching people.

### 5a. Units and teams

Slugs are auto-generated from the title, then **frozen** — a slug is an access-control
scope (`EXCO:choir`), so renaming an office must never move permissions.

```
UNIT   follow-up-and-counseling      Follow-up & Counselling Unit
UNIT   media-and-ambience            Media and Ambience Unit
UNIT   sanctuary-keeping             Sanctuary Keeping Unit
UNIT   library                       Library
UNIT   alumni-relations              Alumni Relations
UNIT   editorial                     Editorial Unit
UNIT   academic                      Academic Unit
TEAM   academic-counselling          Academic Counselling Team
UNIT   ushering                      Ushering Unit
UNIT   choir                         Choir Unit
UNIT   prayer                        Prayer Unit
UNIT   hall-reps                     Hall Reps Unit
UNIT   drama                         Drama Unit
UNIT   sport                         Sport Unit
UNIT   welfare                       Welfare Unit
UNIT   sisters                       Sisters' Unit
UNIT   bible-study                   Bible Study Unit
UNIT   organizing                    Organizing Unit
UNIT   evangelism                    Evangelism Unit
UNIT   ict                           Information and Communications Unit
```

Nineteen units + one team. I read "Academic Unit & Academic Counseling Team" as two
offices, since a team is a distinct type in this schema and members may hold several.
Say the word if it's meant to be one.

### 5b. Positions derived from the above

```
president            President                       PRESIDENT  tier PRESIDENT
vp-admin             Vice President Administration    CENTRAL    tier VP
vp-church-growth     Vice President Church Growth     CENTRAL    tier VP
ict-coord            ICT Coordinator                  SYSADMIN + EXCO:ict   tier EXECUTIVE
exco-<slug>          Executive — <Unit>               EXCO:<slug>   tier EXECUTIVE   (one per unit above, minus ICT)
level-coord-all      Level Coordinator — 500 Level    LEVEL:all     tier COORDINATOR ← authority over EVERY level
level-coord-400/300/200/100                           LEVEL:<n>00   tier COORDINATOR
level-coord-pds-uabs Level Coordinator — PDS/UABS     LEVEL:pds-uabs
```

You listed 500 / 300 / 200. I'm seeding all six anyway — the catalogue is frozen and
generating it from `LEVELS` keeps it consistent; an unfilled position is simply a
position nobody holds, which costs nothing. Assistants are `is_lead = false` rows and
need no extra positions.

### 5c. Also in the default seed

`module_access` defaults, and `residential_zones`. Explicitly **not** included:
tenures, profiles, leadership. Who holds an office is never seed data.

## Part 6 — TEST SEED (`scripts/seed-test.mjs`, BLOCKED in production)

### The guard, first

The script refuses to run unless **all** hold:

1. `--i-understand-this-is-not-production` passed explicitly.
2. `SUPABASE_URL` does not match a `PRODUCTION_SUPABASE_URL` env var, if set.
3. The target database has **zero rows** in `admin_audit_log` **or** an
   `app_settings.environment = 'development'` marker row exists.

Every seeded profile also gets `@rcffuta.test` as its email domain. `.test` is an
RFC 2606 reserved TLD — it can never resolve and no message can ever escape to a real
inbox, which `.com` could not promise. It also makes a single
`delete from profiles where email like '%@rcffuta.test'` unwinds the whole thing — which
is why that domain requirement is load-bearing, not cosmetic.

### What it creates

**Generations** — derived from the ACTIVE TENURE'S SESSION at runtime, never hardcoded.
Level is computed (`rcf_compute_level`), so a hardcoded entry year silently produces the
wrong level the moment the session rolls over — and rolling the session over is the exact
feature being tested. With an active `2026/2027`:

```
Army of Light  entry 2022 → 500 Level   (exists already; reused, not duplicated)
<name>         entry 2023 → 400 Level
<name>         entry 2024 → 300 Level
<name>         entry 2025 → 200 Level
<name>         entry 2026 → 100 Level
```

**Members** — 20 per level (100 total), Nigerian student names across the major ethnic
groups, realistic FUTA departments, `firstname.lastname<n>@rcffuta.test`, ~50/50 gender.

**5 of every 20 get an avatar**, matched to gender via `randomuser.me/api/portraits/
{men,women}/N.jpg`. That host is **not** in `next.config.ts`, so it gets added as a
development-only remote pattern:

```ts
remotePatterns: [
    { protocol: "https", hostname: "res.cloudinary.com" },
    ...(process.env.NODE_ENV !== "production"
        ? [{ protocol: "https" as const, hostname: "randomuser.me" }]
        : []),
],
```

Production keeps accepting Cloudinary only. The other 15 exercise the initials fallback,
which is the state most real members will actually be in.

**10 members with no `class_set_id`** — the register/update path you want to test.

**Leadership** — one lead per fixed office plus a handful of excos and the 500-Level
coordinator, so the handover wizard has real outgoing leaders to revoke and real
`profile_login` rows to deprovision. Without these the wizard's access step shows an
empty list and proves nothing.

`--reset` deletes every `@rcffuta.test` profile and its dependents first, so the seed is
repeatable while you test the handover more than once.

## Files (revised)

**New**
```
db/migrations/0013_structural_cleanup.sql
db/seed/default.sql                       bootstrap catalogue — prod-safe, re-runnable
scripts/seed-test.mjs                     dev-only, guarded, --reset
scripts/release.mjs
scripts/db-inventory.mjs
scripts/purge-auth-users.mjs
src/app/dashboard/settings/insurance/     full system backup (SysAdmin only)
CHANGELOG.md
```

**Modified (added to the earlier list)**
```
src/config/leadership-positions.ts   ict-coord → EXECUTIVE + EXCO tag; SYSTEM tier removed;
                                     derived generator skips the ICT unit
src/lib/backup-tables.ts             FOREIGN APPS group, off by default
next.config.ts                       dev-only randomuser.me remote pattern
```

## Verification (added)

6. Default seed run twice → identical row counts, no duplicate slugs.
7. Test seed against a URL that looks like production → refuses, exits non-zero.
8. Log in as the seeded 500-Level coordinator → every level visible and writable.
   As the 300-Level coordinator → only 300 Level.
9. Run the handover wizard end to end on the seeded data: 500 Level becomes Alumni,
   every other generation advances, the outgoing-access list names real people.
10. `seed-test.mjs --reset` → zero `@rcffuta.test` profiles, foreign-app counts unchanged.
