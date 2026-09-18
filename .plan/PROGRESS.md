# Progress — v1.0.0 structural refresh

Live checklist. Updated as each item lands. Full plan: `.plan/db-refresh.md`.

- [x] **1. Section-B code migration**
      - [x] `is_central` removed from all 4 write/read sites (`tenure/actions.ts`)
      - [x] `isCentral` removed from `PositionSpec`
      - [~] `category` + `is_default` **DEFERRED** — see note below
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
- [ ] **4. `db/seed/default.sql`** (generated from TS; prod-safe, re-runnable)
- [ ] **5. `scripts/seed-test.mjs`** (guarded, `--reset`, `@rcffuta.test`)
- [ ] **6. `next.config.ts`** dev-only avatar host
- [ ] **7. System insurance backup** (SysAdmin, full-scope, mandatory encryption)
- [ ] **8. `scripts/db-inventory.mjs`**
- [ ] **9. `scripts/purge-auth-users.mjs`**
- [ ] **10. `scripts/release.mjs` + `CHANGELOG.md` + version 1.0.0**
- [ ] **11. Regenerate `db/db-schema.sql`; README**
- [ ] **12. Verify — lint vs baseline, `pnpm build`**

## Deferred, with reason

**`leadership_positions.category` and `.is_default` are NOT dropped in 1.0.0.**
I scoped these as "4 read sites" in the plan. They are not. Both are baked into
`rcf_profile_context` — the RPC that resolves every session's permissions — at
`0001:322`, `0004:181` and `0006`, including the admin test
`lp.is_default OR lp.category = 'PRESIDENT'`. `category` also drives UNIT/TEAM/LEVEL
branching across ~15 call sites in `units/actions.ts` and `appoint-panel.tsx`.
Dropping them means rewriting the auth RPC. That is its own release, not a footnote
in a cleanup. Everything else in section B shipped.

## Applied-to-production status

Nothing here has been run against any database yet. Migration 0013 is written but
**not applied**. The full system backup must come first.
