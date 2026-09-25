# Progress — v1.0.0 structural refresh + ict-lib removal

Live checklist. Updated as each item lands. Full plan: `.plan/db-refresh.md`.

- [x] **1. Section-B code migration**
      - [x] `is_central` removed from all 4 write/read sites (`tenure/actions.ts`)
      - [x] `isCentral` removed from `PositionSpec`
      - [x] `category` **DROPPED** — now derived (`rcf_position_kind` / `derivePositionKind`)
      - [x] `is_default` **DROPPED** — replaced by immutable-slug protection
      - [x] `rcf_profile_context` **REWRITTEN**; VP Admin matched by slug, not title
      - [x] 4 ict-lib SDK calls replaced (they still read the dropped column)
      - [x] `alias` **KEPT** — it is the display name, not legacy (confirmed w/ user)
- [x] **2. ICT Coord → EXECUTIVE**
      - [x] `tier: "SYSTEM"` → `"EXECUTIVE"`; `SYSTEM` removed from tier vocabulary
      - [x] gains `EXCO:ict` alongside `SYSADMIN`
      - [x] `ICT_UNIT_SLUG` added; `buildCatalogue()` skips minting `exco-ict`
      - [x] `src/config/fellowship-units.ts` — 19 units + 1 team, popular aliases
      - [x] `excoPositionFor()` uses the popular alias
- [x] **3. Migration 0013** — `db/migrations/0013_structural_cleanup.sql`
      - [x] `schema_migrations` ledger + backfill of 0001–0012
      - [x] fixes 0011's idempotency bug (duplicate scoped privileges)
      - [x] retiers ict-coord, grants EXCO:ict, retires any `exco-ict`
      - [x] drops 3 tables + 3 columns
      - [x] RLS sweep over all portal tables
- [x] **4. `db/seed/default.sql`** — GENERATED from the TS config by
      `scripts/gen-default-seed.mjs` (`--check` mode for CI). 20 units, 29 positions,
      30 privilege rows, module_access defaults. No people.
- [x] **5. `scripts/seed-test.mjs`** — 3 guards (all verified firing), 110 members,
      generations derived from the active session, seeded cabinet + logins,
      `--reset` / `--reset-only` / `--password`
- [x] **6. `next.config.ts`** dev-only avatar host (`randomuser.me`, NODE_ENV-gated)
- [x] **7. System insurance backup** — `/dashboard/settings/insurance`, SysAdmin only,
      `scope=system`, encryption mandatory, foreign-app group off by default
- [x] **8. `scripts/db-inventory.mjs`** — read-only, PORTAL/FOREIGN/UNCLASSIFIED
- [x] **9. `scripts/purge-auth-users.mjs`** — dry-run default, refuses to touch `public`
- [x] **10. `scripts/release.mjs`** — dry-run verified. CHANGELOG + version bump happen
      when you run it with `--major --commit` (see below)
- [x] **11. `db/db-schema.sql` regenerated** from the live dump with 0013 applied
      (75 tables); README documents versioning, seeds, tools and the two traps
- [x] **12. Verified** — `tsc` clean, `pnpm build` clean, lint at baseline (1 pre-existing
      warning, unchanged), seed generator `--check` passes, both seed guards fire

## Done: the auth RPC rewrite

`category` and `is_default` are gone, on your instruction. What it took:

* **`rcf_position_kind(uuid)`** — new SQL function deriving the position's kind from
  its privilege tags. Exact twin of `derivePositionKind()` in `src/lib/privileges.ts`.
* **`rcf_profile_context` rewritten** in 0013 — `roles[].scope` and
  `leadership[].category` now derived; `isDefault` replaced by `tier` + `isProtected`;
  a `slug` added to `roles[]`.
* **Latent bug closed:** the RPC identified the VP Admin by
  `lp.title = 'Vice President Administration'`. Title is EDITABLE — renaming that
  office in the UI would have silently stripped the VP Admin of `isVpAdmin`, and with
  it the handover, the catalogue and every transfer approval. Now matched on the
  immutable `lp.slug = 'vp-admin'`.
* **Four ict-lib SDK calls replaced.** `@rcffuta/ict-lib` still selects and writes
  `leadership_positions.category`; its `assignLeader()` gates the single-President
  rule on it. Left alone, dropping the column would have broken EVERY appointment,
  including the handover. New `src/lib/positions.ts` reads the catalogue directly.
* Build green, typecheck green.

## 13. @rcffuta/ict-lib REMOVED — done

The dependency is gone from `package.json` and `node_modules`. `@supabase/supabase-js`
is now a DIRECT dependency (it was only ever transitive, through the library).

**New modules, all replacing library surface:**

| File | Replaces |
|---|---|
| `src/lib/db.ts` | `RcfIctClient.asAdmin()` — a plain service-role client |
| `src/lib/types/portal.ts` | `FullUserProfile`, `Tenure`, `UserBio`, … |
| `src/lib/departments.ts` | `DepartmentUtils` + 57 FUTA departments, 11 faculties |
| `src/lib/fellowship.ts` | `ictAdmin.unit.*`, `.zone.*`, `setFamilyName`, `updateLocationInfo` |
| `src/lib/events-data.ts` | `ictAdmin.event.*` |
| `src/lib/qa.ts` | `QAService` (5 of its 15 methods — the rest were never called) |
| `src/lib/positions.ts` | `ictAdmin.admin.*` (from the earlier 0013 work) |

**Deleted as dead code** — nothing imported either, and both were built on the Supabase
Auth model retired in migration 0001:
`src/app/dashboard/actions.ts`, `src/app/actions/data.ts`, plus
`getAuthenticatedClient()` in `auth-utils.ts` and the `src/lib/ict.ts` shim.

**Two types were WRONG and are now right:**
* `Tenure` was declared camelCase (`startDate`, `isActive`) but every value assigned to
  it is a snake_case PostgREST row. It annotated something that never existed.
* Nullability throughout — `phoneNumber`, `avatarUrl`, `currentLevel` are genuinely
  nullable and the library claimed otherwise. Display code now coalesces instead of
  rendering a blank field with no explanation.

**Hidden dependency now documented:** `src/lib/qa.ts` needs the
`event_questions_with_details` VIEW and the `search_questions` /
`toggle_question_visibility` FUNCTIONS. These exist in the live database but are in NO
migration in this repo — invisible while buried in a package. Noted at the top of
`qa.ts`. A from-scratch rebuild would need them recreated.

**`src/lib/db.ts` accepts the URL under `SUPABASE_URL` *or* `NEXT_PUBLIC_SUPABASE_URL`**
because both were in use. The service-role KEY deliberately has no NEXT_PUBLIC fallback.

Verified: `tsc` clean, `pnpm build` clean, lint identical to baseline on every touched
file (two files improved).

## 14. Migration 0013 FIXED after a failed apply

`question_flags` was NOT dead. Applying 0013 failed with:

```
ERROR: cannot drop table question_flags because other objects depend on it
DETAIL: view event_questions_with_details depends on table question_flags
        function search_questions(text,uuid) depends on type ...
        view flagged_questions depends on table question_flags
```

**The lesson, now written into the migration itself:** grepping `src/` is not evidence
a table is unused. Views, functions and triggers reference tables too, and none of them
show up in a TypeScript search. `event_questions_with_details` is the view the whole Q&A
feature reads through.

Changes:
* `question_flags` **stays.** The earlier claim was wrong.
* New `pg_temp.drop_table_if_unused()` — refuses to drop anything with dependents, names
  what depends on it, and **never uses CASCADE**. Also catches
  `dependent_objects_still_exist` so a surprise reports instead of aborting the migration.
* `question_references` still dropped, but through the same guard.
* `db/db-schema.sql` restored `question_flags` (76 tables).

**Verified against the live dev database: 0013 rolled back cleanly. Nothing partially
applied.** `category`, `is_default`, `is_central`, `can_manage_unit`, `raffle_id` all
still present; `schema_migrations` does not exist.

## 15. Scripts rebuilt — interactive, with an environment picker

New `scripts/lib/cli.mjs`: colour (dropped when not a TTY or `NO_COLOR`), headings,
tables, key/value blocks, progress bars, arrow-key menus, and **environment discovery**.

**The environment picker is the point.** This repo has `.env.local`,
`.env.development` and `.env.production` side by side. Every script now lists them with
the Supabase project each points at, marks production in red, and:

* `seed-test.mjs` **will not even offer** a production environment.
* Anything else requires you to **type the project ref** before it proceeds.

Verified live: `.env.local` and `.env.development` both point at `kcyylplbizwgttqjdezf`;
`.env.production` is a genuinely different project, `izofyqiaazidryoejsot`.

**New `scripts/db-status.mjs`** — answers "has migration N been applied here?" by
fingerprinting the SCHEMA, not just reading the ledger. The ledger is a claim; the schema
is the fact, and it flags any disagreement between them.

npm scripts added: `db:status`, `db:inventory`, `db:seed-test`, `db:purge-auth`,
`db:gen-seed`, `release`.

## 16. APPLIED AND VERIFIED against the dev project (kcyylplbizwgttqjdezf)

Migration 0013 is applied. Checked directly, not assumed:

| Check | Result |
|---|---|
| `schema_migrations` ledger | 13 rows — 0001–0012 backfilled, 0013 recorded |
| `pnpm db:status` | every migration on disk reconciles with the schema |
| Columns dropped | `category`, `is_default`, `is_central`, `can_manage_unit`, `raffle_id` — all gone |
| Tables dropped | `verification_codes`, `question_references` — both gone (`PGRST205`) |
| `question_flags` | **still present**, as intended — the Q&A view depends on it |
| `ict-coord` | `tier: EXECUTIVE`, privileges `SYSADMIN` + `EXCO:ict` |
| `rcf_profile_context` | returns derived `category`, plus `tier` / `isProtected` / `roles[].slug`; `isSysAdmin` and `isAdmin` still resolve |
| **Foreign apps** | **zero row-count change across all 44 `rw_`/`fyb_`/`elib_`/`game_` tables** |

Only three portal counts moved, all expected: `schema_migrations` 0→13,
`position_privileges` 12→13 (ict-coord's new `EXCO:ict`), `verification_codes` 1→absent.

### A tooling bug found and fixed during verification

`db-inventory.mjs` reported a dropped table as `0 rows` instead of absent. A
`head: true` count request against a missing table returns **no error and a null count**
— PostgREST has no body to send — and the script read that as zero. It now treats a null
count as ABSENT, which is the distinction the whole script exists to make.

## NOT YET DONE — this is where you pick up

Everything above is code-complete, built and linted. **Nothing has been run against any
database.** In order:

1. **Full system backup** — Settings -> System insurance. Not the handover one; a
   tenure-scoped file cannot restore a dropped column.
2. `pnpm db:inventory --env local --json > before.json`
3. `pnpm db:status` to confirm what is outstanding, then apply
   `db/migrations/0013_structural_cleanup.sql` in the Supabase SQL editor. Watch the
   NOTICEs: the RLS sweep names any table it locked down, and `drop_table_if_unused`
   names anything it KEPT because something depended on it.
4. Apply `db/seed/default.sql`.
5. `pnpm db:inventory --env local --json > after.json`, then
   `pnpm db:inventory --env local --compare after.json` — it diffs and shouts if any
   **FOREIGN** row count moved.
6. Dev only: `pnpm db:seed-test --password '...'`  (production is not offered)
7. `node scripts/release.mjs --major --commit --tag` -> v1.0.0

Still open, needing your decision:

* **`public.categories`** — orphan with `rw_categories`' exact shape, referenced nowhere.
  Untouched pending its owner's confirmation.
* **`profiles.entry_year` duplicates `class_set_id`.** Both are read in live paths;
  collapsing them is a data migration, so it belongs in its own release.
* **Set `PRODUCTION_SUPABASE_URL` in `.env.local`** — without it, one of the three test-seed
  guards is skipped (the script warns, loudly).
