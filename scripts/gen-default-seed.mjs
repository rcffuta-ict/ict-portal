/**
 * Generate db/seed/default.sql from the TypeScript catalogue.
 *
 * The fellowship's structure is defined in two files that the APP reads at runtime:
 *   src/config/fellowship-units.ts      — the units and teams
 *   src/config/leadership-positions.ts  — the offices and their privileges
 *
 * The DATABASE needs the same structure seeded into it, and hand-keeping a .sql file in
 * step with two .ts files is a guarantee that they will disagree eventually — usually
 * noticed when someone's permissions are quietly wrong. So the SQL is generated, and
 * committed alongside its source.
 *
 * Usage:
 *   node scripts/gen-default-seed.mjs            # write db/seed/default.sql
 *   node scripts/gen-default-seed.mjs --check    # fail if the file is out of date (CI)
 *
 * No dependencies: the two config files are plain data, so they are parsed rather than
 * imported (importing TypeScript would mean pulling in a compiler for a seed script).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "db", "seed", "default.sql");

/** Single-quote escaping for SQL string literals. */
const q = (v) => (v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);

// ---------------------------------------------------------------------------
// Parse src/config/fellowship-units.ts
// ---------------------------------------------------------------------------
function readUnits() {
    const src = readFileSync(join(ROOT, "src/config/fellowship-units.ts"), "utf8");
    const body = src.slice(src.indexOf("export const FELLOWSHIP_UNITS"));
    const units = [];

    // Each entry is a { ... } object literal with the five known keys.
    const entry = /\{\s*(?:\/\/[^\n]*\n\s*)*slug:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*type:\s*"(UNIT|TEAM)",\s*positionAlias:\s*"([^"]+)",\s*description:\s*\n?\s*"([^"]*)",?\s*\}/g;
    let m;
    while ((m = entry.exec(body)) !== null) {
        units.push({ slug: m[1], name: m[2], type: m[3], positionAlias: m[4], description: m[5] });
    }
    if (units.length === 0) throw new Error("Parsed zero units — the config format changed.");
    return units;
}

// ---------------------------------------------------------------------------
// Parse the FIXED offices out of src/config/leadership-positions.ts
// ---------------------------------------------------------------------------
function readFixedPositions() {
    const src = readFileSync(join(ROOT, "src/config/leadership-positions.ts"), "utf8");
    const start = src.indexOf("export const FIXED_POSITIONS");
    const body = src.slice(start, src.indexOf("\n// ---", start));
    const out = [];

    // Split on each `slug:` so comments between entries don't confuse the match.
    const chunks = body.split(/\n    \{\n/).slice(1);
    for (const chunk of chunks) {
        const slug = /slug:\s*"([^"]+)"/.exec(chunk)?.[1];
        const title = /title:\s*"([^"]+)"/.exec(chunk)?.[1];
        const alias = /alias:\s*"([^"]+)"/.exec(chunk)?.[1];
        const tier = /tier:\s*"([^"]+)"/.exec(chunk)?.[1];
        if (!slug || !title || !tier) continue;

        // description may be a single string or a `+`-joined pair over two lines.
        const desc = /description:\s*\n?\s*"((?:[^"\\]|\\.)*)"/.exec(chunk)?.[1] ?? "";

        const privileges = [];
        const privBlock = /privileges:\s*\[([\s\S]*?)\],/.exec(chunk)?.[1] ?? "";
        const priv = /\{\s*tag:\s*"([A-Z]+)",\s*scope:\s*([^}]+?)\s*\}/g;
        let p;
        while ((p = priv.exec(privBlock)) !== null) {
            const rawScope = p[2].trim();
            let scope = null;
            if (rawScope !== "null") {
                scope = /^"(.*)"$/.exec(rawScope)?.[1] ?? "ict"; // ICT_UNIT_SLUG
            }
            privileges.push({ tag: p[1], scope });
        }
        // Mirrors defaultGrantsLogin(): an explicit `grantsLogin` wins, otherwise an
        // office with at least one privilege tag has something to administer and gets
        // a login. Offices with no tags are on record only.
        const explicit = /grantsLogin:\s*(true|false)/.exec(chunk)?.[1];
        const grantsLogin = explicit ? explicit === "true" : privileges.length > 0;

        out.push({ slug, title, alias, tier, description: desc.replace(/\\"/g, '"'), privileges, grantsLogin });
    }
    if (out.length === 0) throw new Error("Parsed zero fixed positions — the config format changed.");
    return out;
}

// ---------------------------------------------------------------------------
// Level coordinators — mirrors levelCoordinatorFor() / levelScopeToken()
// ---------------------------------------------------------------------------
const LEVELS = ["PDS/UABS", "100 Level", "200 Level", "300 Level", "400 Level", "500 Level"];

function levelScopeToken(level) {
    if (level === "500 Level") return "all";       // THE 500-LEVEL SPECIALTY
    if (level === "PDS/UABS") return "pds-uabs";
    const m = /^(\d)00 Level$/.exec(level);
    return m ? `${m[1]}00` : "all";
}

function levelCoordinators() {
    return LEVELS.map((level) => {
        const token = levelScopeToken(level);
        const slugPart = level === "PDS/UABS" ? "pds-uabs" : token;
        const finalist = level === "500 Level";
        return {
            slug: `level-coord-${slugPart}`,
            title: `Level Coordinator — ${level}`,
            alias: `${level} Coord`,
            tier: "COORDINATOR",
            description: finalist
                ? "Coordinates the finalists, and holds coordinator authority over EVERY level in the fellowship."
                : `Coordinates ${level}. Authority is limited to that generation.`,
            privileges: [{ tag: "LEVEL", scope: token }],
            grantsLogin: true,
        };
    });
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function render() {
    const units = readUnits();
    const fixed = readFixedPositions();
    const ICT = "ict";

    // One Executive per unit/team, EXCEPT the ICT unit — `ict-coord` already carries
    // EXCO:ict, and a second position would give that unit two leads.
    const excos = units
        .filter((u) => u.slug !== ICT)
        .map((u) => ({
            slug: `exco-${u.slug}`,
            title: `Executive — ${u.name}`,
            alias: u.positionAlias,
            tier: "EXECUTIVE",
            description: `Leads ${u.name}. Adds and removes its members directly.`,
            privileges: [{ tag: "EXCO", scope: u.slug }],
            grantsLogin: true,
        }));

    const positions = [...fixed, ...excos, ...levelCoordinators()];

    const L = [];
    L.push("-- ============================================================================");
    L.push("-- DEFAULT SEED — the fellowship's bootstrap structure.          RELEASE v1.0.0");
    L.push("--");
    L.push("-- GENERATED FILE — do not edit by hand.");
    L.push("--   Source:    src/config/fellowship-units.ts");
    L.push("--              src/config/leadership-positions.ts");
    L.push("--   Regenerate: node scripts/gen-default-seed.mjs");
    L.push("--");
    L.push("-- THIS RUNS IN PRODUCTION. It is bootstrap data, not test data: the offices and");
    L.push("-- units that exist in every tenure regardless of who fills them.");
    L.push("--");
    L.push("-- IT SEEDS NO PEOPLE. No profiles, no tenures, no leadership rows. Who holds an");
    L.push("-- office is never seed data — it is the outcome of an appointment, and inventing");
    L.push("-- one would put a person in the cabinet that nobody appointed.");
    L.push("--");
    L.push("-- RE-RUNNABLE, and that is its second job: running it again is the RESET SEED,");
    L.push("-- returning the catalogue to canonical state after someone has edited a title or");
    L.push("-- deactivated an office by mistake. It restores names and privileges; it never");
    L.push("-- deletes a position (somebody may hold it) and never touches a person.");
    L.push("--");
    L.push("-- SLUGS ARE IMMUTABLE. A slug IS an access-control scope: `EXCO:choir` is the");
    L.push("-- privilege, `exco-choir` the position, `choir` the unit. Titles and aliases are");
    L.push("-- free to change; changing a slug moves permissions and is never done here.");
    L.push("--");
    L.push("-- Depends on supabase/migrations being applied first — in particular the");
    L.push("-- grants_login column from 20260920162209_tighten_office_catalogue.sql.");
    L.push("-- ============================================================================");
    L.push("");
    L.push("BEGIN;");
    L.push("");

    // --- units ---
    L.push("-- ----------------------------------------------------------------------------");
    L.push(`-- 1. Units and teams (${units.length}: ${units.filter((u) => u.type === "UNIT").length} units, ${units.filter((u) => u.type === "TEAM").length} team).`);
    L.push("--");
    L.push("-- A member belongs to exactly ONE unit (the enforce_single_unit_membership");
    L.push("-- trigger from 0001) but to any number of teams. That is the whole distinction:");
    L.push("-- a team is something you take on in ADDITION to your unit.");
    L.push("--");
    L.push("-- Matched on slug, so re-running restores an edited name without minting a");
    L.push("-- duplicate unit.");
    L.push("-- ----------------------------------------------------------------------------");
    L.push("INSERT INTO public.units (slug, name, type, description, is_workforce)");
    L.push("VALUES");
    L.push(units.map((u) => `    (${q(u.slug)}, ${q(u.name)}, ${q(u.type)}, ${q(u.description)}, true)`).join(",\n"));
    L.push("ON CONFLICT (slug) DO UPDATE");
    L.push("    SET name        = EXCLUDED.name,");
    L.push("        type        = EXCLUDED.type,");
    L.push("        description = EXCLUDED.description;");
    L.push("");

    // --- positions ---
    L.push("-- ----------------------------------------------------------------------------");
    L.push(`-- 2. The frozen position catalogue (${positions.length} offices).`);
    L.push("--");
    L.push("-- `category` is NOT set: migration 0013 dropped the column and the kind is now");
    L.push("-- derived from the privilege tags below by rcf_position_kind().");
    L.push("--");
    L.push("-- is_protected = true marks these as catalogue rows, which the");
    L.push("-- enforce_frozen_position_catalogue trigger (0011) refuses to DELETE.");
    L.push("--");
    L.push("-- grants_login says whether appointment to the office comes with a PORTAL");
    L.push("-- LOGIN. Most of the fellowship's offices are here as a record of service and");
    L.push("-- administer nothing in the portal, so they grant none. It is set on INSERT");
    L.push("-- only: once the row exists the column belongs to the VP Admin, and re-running");
    L.push("-- this seed must not overrule an access decision they made deliberately.");
    L.push("-- ----------------------------------------------------------------------------");
    L.push("INSERT INTO public.leadership_positions");
    L.push("    (slug, title, alias, description, tier, is_active, is_protected, grants_login)");
    L.push("VALUES");
    L.push(positions.map((p) =>
        `    (${q(p.slug)}, ${q(p.title)}, ${q(p.alias)},\n     ${q(p.description)},\n     ${q(p.tier)}, true, true, ${p.grantsLogin ? "true" : "false"})`).join(",\n"));
    L.push("ON CONFLICT (slug) DO UPDATE");
    L.push("    SET title        = EXCLUDED.title,");
    L.push("        alias        = EXCLUDED.alias,");
    L.push("        description  = EXCLUDED.description,");
    L.push("        tier         = EXCLUDED.tier,");
    L.push("        is_active    = true,");
    L.push("        is_protected = true;");
    L.push("");

    // --- privileges ---
    L.push("-- ----------------------------------------------------------------------------");
    L.push("-- 3. Privilege tags — the ONLY thing that decides authorization.");
    L.push("--");
    L.push("-- Note `level-coord-all`: the 500-Level coordinator is scoped 'all', not '500'.");
    L.push("-- Finalist coordinators hold authority over EVERY level in the fellowship, and");
    L.push("-- that rule lives here as DATA rather than as a branch in the resolver, because");
    L.push("-- canManageLevel() already treats an 'all' scope as every generation.");
    L.push("--");
    L.push("-- Note `ict-coord`: two tags. SYSADMIN is the portal-wide System Admin right;");
    L.push("-- EXCO:ict is leading the ICT unit like any other exco.");
    L.push("-- ----------------------------------------------------------------------------");
    for (const p of positions) {
        for (const pr of p.privileges) {
            L.push("INSERT INTO public.position_privileges (position_id, privilege, scope)");
            L.push(`SELECT id, ${q(pr.tag)}, ${q(pr.scope)} FROM public.leadership_positions WHERE slug = ${q(p.slug)}`);
            L.push("ON CONFLICT DO NOTHING;");
        }
    }
    L.push("");

    // --- module access ---
    L.push("-- ----------------------------------------------------------------------------");
    L.push("-- 4. Module access defaults.");
    L.push("--");
    L.push("-- Inserted ONLY where absent: this is the System Admin's runtime configuration,");
    L.push("-- and a reset seed that overwrote a deliberate access decision would be a");
    L.push("-- security regression dressed up as housekeeping.");
    L.push("-- ----------------------------------------------------------------------------");
    L.push("INSERT INTO public.module_access (module, read_slugs, write_slugs, write_scope)");
    L.push("VALUES");
    L.push("    ('tenure',    ARRAY['CENTRAL'],          ARRAY['CENTRAL'], 'ALL'),");
    L.push("    ('zones',     ARRAY['CENTRAL','ZONE'],   ARRAY['ZONE'],    'OWN'),");
    L.push("    ('workforce', ARRAY['CENTRAL','EXCO'],   ARRAY['EXCO'],    'OWN'),");
    L.push("    ('level',     ARRAY['CENTRAL','LEVEL'],  ARRAY['LEVEL'],   'OWN')");
    L.push("ON CONFLICT (module) DO NOTHING;");
    L.push("");
    L.push("COMMIT;");
    L.push("");
    return L.join("\n");
}

const sql = render();
const check = process.argv.includes("--check");

if (check) {
    const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
    if (current !== sql) {
        console.error("db/seed/default.sql is out of date. Run: node scripts/gen-default-seed.mjs");
        process.exit(1);
    }
    console.log("db/seed/default.sql is up to date.");
} else {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, sql);
    console.log(`Wrote ${OUT}`);
}
