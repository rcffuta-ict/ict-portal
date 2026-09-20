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

## NOT YET DONE — this is where you pick up

Everything above is code-complete, built and linted. **Nothing has been run against any
database.** In order:

1. **Full system backup** — Settings -> System insurance. Not the handover one; a
   tenure-scoped file cannot restore a dropped column.
2. `node scripts/db-inventory.mjs --json > before.json`
3. Apply `db/migrations/0013_structural_cleanup.sql` in the Supabase SQL editor.
   Watch for the RLS sweep's NOTICE — it names any table it had to lock down.
4. Apply `db/seed/default.sql`.
5. `node scripts/db-inventory.mjs --json > after.json` and diff. **No FOREIGN row count
   may change.**
6. Dev only: `node scripts/seed-test.mjs --i-understand-this-is-not-production --password '...'`
7. `node scripts/release.mjs --major --commit --tag` -> v1.0.0

Still open, needing your decision:

* **`public.categories`** — orphan with `rw_categories`' exact shape, referenced nowhere.
  Untouched pending its owner's confirmation.
* **`profiles.entry_year` duplicates `class_set_id`.** Both are read in live paths;
  collapsing them is a data migration, so it belongs in its own release.
* **Set `PRODUCTION_SUPABASE_URL` in `.env.local`** — without it, one of the three test-seed
  guards is skipped (the script warns, loudly).
