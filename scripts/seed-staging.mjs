/**
 * Make a freshly-built staging project USABLE — an active tenure, its generations, and
 * a System Admin to sign in as.
 *
 * WHY THIS IS NOT IN db/seed/default.sql
 *   That file runs in PRODUCTION. It seeds the fellowship's STRUCTURE — units, offices,
 *   privileges — and deliberately seeds no people, no tenures and no appointments,
 *   because who holds an office is the outcome of an appointment and inventing one
 *   would put somebody in the cabinet that nobody appointed.
 *
 *   The consequence is that a newly built project is structurally complete and
 *   operationally dead: no active tenure means no level can be computed, no leader can
 *   be appointed, and `pnpm db:ict-coord --seed` stops with "No active tenure".
 *   Production solves that with real people. Staging needs it solved automatically, or
 *   every rebuild starts with the same twenty minutes of clicking.
 *
 * REFUSES PRODUCTION, for the reason above: a fictional tenure in a live system is
 * worse than no tenure at all.
 *
 * Idempotent. Run it twice and nothing is duplicated — an existing active tenure is
 * kept and reported, not replaced.
 *
 * TWO SEEDS, AND THEY ARE NOT THE SAME THING
 *
 *   STRUCTURE  db/seed/default.sql — units, offices, privileges, module access. Runs
 *              in production. Additive and re-runnable: it restores an edited title or
 *              a deactivated office, and never deletes anything or touches a person.
 *
 *   DATA       this script. The people and the activity: a tenure, its generations, a
 *              System Admin. With --reset it first CLEARS every data table back to
 *              empty, so staging returns to a known state instead of accumulating
 *              whatever the last round of testing left behind.
 *
 * --reset never touches the structure tables, and never touches the migration ledger.
 * Wiping those would mean re-running migrations to get a usable database back, which
 * is a rebuild, not a reset.
 *
 * Usage:
 *   node scripts/seed-staging.mjs --env local
 *   node scripts/seed-staging.mjs --env local --session 2026/2027
 *   node scripts/seed-staging.mjs --env local --skip-coordinator
 *   node scripts/seed-staging.mjs --env local --reset          # DESTRUCTIVE
 */
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
    c, heading, section, table, ok, warn, info, blank, ask,
    chooseEnvironment, flagValue, hasFlag, die,
} from "./lib/cli.mjs";
import { PORTAL_TABLES } from "./lib/tables.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * The academic session for a given date.
 *
 * Nigerian university sessions start around August, so a date in September 2026 belongs
 * to 2026/2027, and one in March 2026 belongs to 2025/2026. Getting this wrong is not
 * cosmetic: `computeLevel()` derives every member's level from the session's start year,
 * so an off-by-one session moves the whole fellowship a level.
 */
function sessionFor(date = new Date()) {
    const year = date.getFullYear();
    const start = date.getMonth() >= 7 ? year : year - 1; // getMonth() is 0-based; 7 = August
    return `${start}/${start + 1}`;
}

/**
 * The generations that must exist for an active session, derived rather than listed.
 *
 * computeLevel() is `standing = sessionStartYear - entryYear + 1`, so for 2026/2027 the
 * 100 Level generation entered in 2026 and the finalists in 2022. Deriving it from the
 * session means this stays correct whenever the script is run, instead of being a table
 * that silently ages.
 */
function generationsFor(session) {
    const start = parseInt(session.slice(0, 4), 10);
    const rows = [];
    for (let standing = 1; standing <= 5; standing++) {
        const entryYear = start - standing + 1;
        rows.push({
            entry_year: entryYear,
            family_name: `${entryYear} Set`,
            is_foundation: false,
            level: `${standing * 100} Level`,
        });
    }
    // PDS/UABS sits outside the numeric progression: is_foundation short-circuits
    // computeLevel(), so the year is only a key. It is the NEXT intake's year rather
    // than a past one, so that if the flag were ever cleared by mistake the generation
    // reads "Pre-100" — true — instead of "Alumni", which would be badly wrong.
    rows.push({
        entry_year: start + 1,
        family_name: "PDS/UABS Set",
        is_foundation: true,
        level: "PDS/UABS",
    });
    return rows;
}


/**
 * What --reset must NOT delete.
 *
 * `schema_migrations` is the ledger: clearing it makes the database unable to say which
 * migrations it has, and `pnpm db:status` starts reporting a fresh install that is
 * anything but. The rest is the STRUCTURE seed's output — the fellowship's org chart —
 * which is not data and is not this script's to remove.
 *
 * residential_zones is here because nothing reseeds it. It is real fellowship geography
 * entered by hand, so deleting it would destroy something no script can put back.
 */
const PRESERVED_BY_RESET = [
    "schema_migrations",
    "units",
    "leadership_positions",
    "position_privileges",
    "module_access",
    "residential_zones",
];

const DATA_TABLES = PORTAL_TABLES.filter((t) => !PRESERVED_BY_RESET.includes(t));

/**
 * Empty every data table.
 *
 * DELETE, never TRUNCATE ... CASCADE. In the production database four other
 * applications hold foreign keys pointing AT `public.profiles`, and a CASCADE there
 * would silently empty the ReadWrite store. DELETE cannot: it raises a foreign-key
 * error instead, which is the correct outcome and the reason this is safe even if
 * someone points it at a database it was not meant for.
 *
 * Order is discovered rather than declared. Repeated passes delete what they can until
 * a pass achieves nothing; children go first because their parents refuse to. That
 * beats a hand-maintained ordering, which is one schema change away from being wrong.
 */
async function clearData(db) {
    const remaining = new Set(DATA_TABLES);
    const cleared = [];
    let lastError = null;

    for (let pass = 1; pass <= DATA_TABLES.length + 1 && remaining.size; pass++) {
        let progressed = false;

        for (const name of [...remaining]) {
            // Every portal table has a uuid `id` primary key; this matches all rows.
            const { error } = await db.from(name).delete().not("id", "is", null);
            if (error) {
                lastError = `${name}: ${error.message}`;
                continue;
            }
            remaining.delete(name);
            cleared.push(name);
            progressed = true;
        }

        if (!progressed) break;
    }

    return { cleared, stuck: [...remaining], lastError };
}

async function main() {
    heading("Seed staging", "an active tenure, its generations, and a System Admin");

    const env = await chooseEnvironment({
        purpose: "seed",
        refuseProduction: true,
        envFlag: flagValue("env"),
    });

    const db = createClient(env.url, env.vars.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    // --- 0. Reset -----------------------------------------------------------
    if (hasFlag("reset")) {
        section("0. Clear existing data");
        warn(`This DELETES every row from ${DATA_TABLES.length} tables in ${c.bold(env.ref)}.`);
        info(c.grey("Profiles, logins, sessions, appointments, events, testimonies, audit log."));
        info(c.grey(`Kept: ${PRESERVED_BY_RESET.join(", ")}.`));
        blank();

        if (!hasFlag("yes")) {
            // The project ref, typed in full — not y/N. The whole risk here is doing
            // this to the wrong project, and a yes/no prompt does nothing to catch that.
            const typed = await ask(`Type the project ref to confirm (${env.ref})`);
            if (typed.trim() !== env.ref) {
                throw new Error("That is not the ref. Nothing was deleted.");
            }
        }

        const { cleared, stuck, lastError } = await clearData(db);
        if (stuck.length) {
            warn(`Could not clear: ${stuck.join(", ")}`);
            info(c.grey(`Last error — ${lastError}`));
            throw new Error("Stopped with data still present. Nothing further was seeded.");
        }
        ok(`Cleared ${cleared.length} tables.`);
    }

    // --- 1. The tenure ------------------------------------------------------
    section("1. Active tenure");

    const session = flagValue("session") ?? sessionFor();
    const name = flagValue("name") ?? "Staging";

    const { data: existing, error: readError } = await db
        .from("tenures")
        .select("id, name, session, start_date")
        .eq("is_active", true)
        .maybeSingle();
    if (readError) throw new Error(`Could not read tenures: ${readError.message}`);

    let tenure = existing;
    if (tenure) {
        ok(`Already active: ${c.bold(tenure.name)} — ${tenure.session}`);
        info(c.grey("Kept as it is. This script never replaces an active tenure."));
        if (tenure.session !== session) {
            warn(`Its session (${tenure.session}) is not the current one (${session}).`);
            info(c.grey("That is fine if deliberate — levels are computed from the ACTIVE"));
            info(c.grey("tenure's session, so every generation shifts with it."));
        }
    } else {
        // start_date is a DATE column; the session's own start year, not today, so the
        // tenure reads correctly if this is run mid-session.
        const startDate = `${session.slice(0, 4)}-08-01`;
        const { data: created, error } = await db
            .from("tenures")
            .insert({ name, session, start_date: startDate, is_active: true })
            .select("id, name, session, start_date")
            .single();
        if (error) throw new Error(`Could not create the tenure: ${error.message}`);
        tenure = created;
        ok(`Created ${c.bold(tenure.name)} — ${tenure.session}, starting ${tenure.start_date}`);
    }

    // --- 2. Generations -----------------------------------------------------
    section("2. Generations");
    info(c.grey("Level is COMPUTED from entry year against the session — never stored."));
    blank();

    const wanted = generationsFor(tenure.session);
    const { data: haveRows } = await db.from("class_sets").select("entry_year");
    const have = new Set((haveRows ?? []).map((r) => r.entry_year));

    const toInsert = wanted.filter((g) => !have.has(g.entry_year));
    if (toInsert.length) {
        const { error } = await db.from("class_sets").insert(
            toInsert.map(({ entry_year, family_name, is_foundation }) => ({
                entry_year, family_name, is_foundation,
            })),
        );
        if (error) throw new Error(`Could not create generations: ${error.message}`);
    }

    table(
        wanted.map((g) => ({
            year: String(g.entry_year),
            family: g.family_name,
            level: g.level,
            state: have.has(g.entry_year) ? c.grey("already there") : c.green("created"),
        })),
        [
            { key: "year", label: "ENTRY" },
            { key: "family", label: "GENERATION" },
            { key: "level", label: "LEVEL THIS SESSION" },
            { key: "state", label: "" },
        ],
    );
    info(c.grey("Rename these from the Tenure screen — `<year> Set` is a placeholder,"));
    info(c.grey("not a fellowship name, and is meant to be replaced."));

    // --- 3. The System Admin ------------------------------------------------
    if (hasFlag("skip-coordinator")) {
        section("3. System Admin");
        info(c.grey("Skipped (--skip-coordinator). Run `pnpm db:ict-coord -- --seed` later."));
    } else {
        section("3. System Admin");
        info(c.grey("Delegated to scripts/ict-coord.mjs, which owns this and refuses production."));
        blank();
        const args = [join(HERE, "ict-coord.mjs"), "--seed", "--env", flagValue("env") ?? "local"];
        const password = flagValue("password");
        if (password) args.push("--password", password);
        execFileSync(process.execPath, args, { stdio: "inherit" });
    }

    section("Done");
    ok(`${env.ref} has an active tenure, its generations, and a System Admin.`);
    blank();
    info("Next:  pnpm dev   — sign in with the address and password above.");
    blank();
    info(c.grey("Not seeded, deliberately: residential zones and members. Zones are real"));
    info(c.grey("fellowship geography and members are real people — both belong to whoever"));
    info(c.grey("runs the tenure, not to a script."));
    blank();
    info(c.grey("Structure (units, offices, privileges) comes from db/seed/default.sql and"));
    info(c.grey("is untouched by this script, including by --reset."));
    blank();
}

main().catch(die);
