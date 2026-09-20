/**
 * What state is this database in, and what is safe to run next?
 *
 * Migrations here are applied BY HAND in the Supabase SQL editor. That makes one
 * question constant and, until now, unanswerable without poking at tables: has
 * migration N actually been applied to the database in front of me?
 *
 * This checks three things and reconciles them:
 *   1. The migration files on disk.
 *   2. The `schema_migrations` ledger, once 0013 has created it.
 *
 * SCOPE: this reports on the ARCHIVED 0001-0013 series in db/migrations/, which is
 * the state every environment was brought to by hand before CI existed. Migrations
 * written from now on live in supabase/migrations/ and are tracked by the CLI's own
 * ledger (supabase_migrations.schema_migrations) -- `supabase migration list` is the
 * tool for those. See docs/DATABASE-CICD.md.
 *   3. The SCHEMA ITSELF — the columns and tables each migration adds or removes.
 *
 * (3) is the one that matters when the ledger does not exist yet, or when a migration
 * half-applied. The ledger can be missing while the changes are present, and a ledger
 * row is only a claim; the schema is the fact.
 *
 * Usage:
 *   node scripts/db-status.mjs              # pick an environment
 *   node scripts/db-status.mjs --env local  # skip the prompt
 *
 * WRITES NOTHING.
 */
import { createClient } from "@supabase/supabase-js";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
    c, heading, section, table, ok, warn, fail, info, step, blank,
    chooseEnvironment, flagValue, die, ROOT,
} from "./lib/cli.mjs";

/**
 * A schema fingerprint per migration: things that must EXIST once it is applied, and
 * things that must be GONE. Empty arrays mean "no cheap fingerprint" — those are
 * reported as unknown rather than guessed at.
 */
const FINGERPRINTS = {
    "0001": { present: [["profile_login", "*"], ["auth_sessions", "*"]], absent: [] },
    "0002": { present: [["registration_invites", "*"]], absent: [] },
    "0003": { present: [], absent: [] },
    "0004": { present: [["leadership_positions", "slug"], ["module_access", "*"]], absent: [] },
    "0005": { present: [["tenures", "theme"], ["leadership", "is_lead"]], absent: [] },
    "0006": { present: [["position_privileges", "*"], ["units", "slug"]], absent: [] },
    "0007": { present: [["invite_events", "*"]], absent: [] },
    "0008": { present: [["testimonies", "*"], ["testimony_amens", "*"]], absent: [] },
    "0009": { present: [], absent: [] },
    "0010": { present: [["admin_audit_log", "*"]], absent: [] },
    "0011": { present: [["leadership_positions", "tier"], ["unit_transfer_requests", "*"]], absent: [] },
    "0012": { present: [["handover_intents", "*"], ["handover_events", "*"]], absent: [] },
    "0013": {
        present: [["schema_migrations", "*"]],
        absent: [
            ["leadership_positions", "category"],
            ["leadership_positions", "is_default"],
            ["leadership_positions", "is_central"],
            ["leadership", "can_manage_unit"],
            ["event_registrations", "raffle_id"],
            ["verification_codes", "*"],
            ["question_references", "*"],
        ],
    },
};

/** Does this table (and optionally column) exist? */
async function exists(db, tableName, column) {
    const { error } = await db.from(tableName).select(column === "*" ? "*" : column).limit(1);
    if (!error) return true;

    // "Absent" arrives in three different shapes, and only these three may be read as
    // absent — anything else (permissions, network) is a real failure and must not be
    // silently reported as "migration not applied".
    //   42P01 / 42703  Postgres: undefined_table / undefined_column
    //   PGRST205       PostgREST: table missing from its schema cache
    //   PGRST204       PostgREST: column missing from its schema cache
    const absentCodes = ["42P01", "42703", "PGRST205", "PGRST204"];
    if (absentCodes.includes(error.code) || /does not exist|schema cache/i.test(error.message)) {
        return false;
    }
    throw new Error(`Checking ${tableName}.${column}: ${error.message}`);
}

async function main() {
    heading("Migration status", "read-only - nothing is written");

    const env = await chooseEnvironment({ purpose: "inspect", envFlag: flagValue("env") });
    const db = createClient(env.url, env.vars.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    // --- files on disk ---
    const files = readdirSync(join(ROOT, "db", "migrations"))
        .filter((f) => f.endsWith(".sql"))
        .sort();

    // --- the ledger, if it exists yet ---
    let ledger = null;
    let ledgerNote = "";
    try {
        const { data, error } = await db.from("schema_migrations").select("id, version, name, applied_at");
        if (error) throw error;
        ledger = new Map((data ?? []).map((r) => [r.id, r]));
    } catch (e) {
        ledgerNote = e.message ?? String(e);
    }

    // --- the schema itself ---
    section("Checking the schema");
    const rows = [];
    for (const file of files) {
        const id = file.slice(0, 4);
        const fp = FINGERPRINTS[id];
        let state;
        let detail = "";

        if (!fp || (fp.present.length === 0 && fp.absent.length === 0)) {
            state = "unknown";
            detail = "no cheap fingerprint";
        } else {
            const presentResults = [];
            for (const [t, col] of fp.present) presentResults.push(await exists(db, t, col));
            const absentResults = [];
            for (const [t, col] of fp.absent) absentResults.push(await exists(db, t, col));

            const allPresent = presentResults.every(Boolean);
            const allAbsent = absentResults.every((x) => x === false);

            if (allPresent && allAbsent) {
                state = "applied";
            } else if (presentResults.every((x) => x === false) && absentResults.every(Boolean)) {
                state = "not applied";
            } else {
                state = "PARTIAL";
                const missing = fp.present.filter((_, i) => !presentResults[i]).map(([t, col]) => `${t}.${col}`);
                const lingering = fp.absent.filter((_, i) => absentResults[i]).map(([t, col]) => `${t}.${col}`);
                detail = [
                    missing.length ? `missing ${missing.join(", ")}` : null,
                    lingering.length ? `still there: ${lingering.join(", ")}` : null,
                ].filter(Boolean).join("; ");
            }
        }

        const recorded = ledger?.get(id);
        rows.push({ id, file, state, detail, recorded });
        step(`${file}  ${c.grey(state)}`);
    }

    // --- report ---
    section("Result");
    table(
        rows.map((r) => ({
            migration: r.file.replace(/\.sql$/, ""),
            schema: r.state === "applied" ? c.green("applied")
                : r.state === "not applied" ? c.yellow("not applied")
                : r.state === "PARTIAL" ? c.red("PARTIAL")
                : c.grey("unknown"),
            ledger: ledger === null ? c.grey("-")
                : r.recorded ? c.green("recorded")
                : c.grey("absent"),
            note: c.grey(r.detail),
        })),
        [
            { key: "migration", label: "MIGRATION" },
            { key: "schema", label: "SCHEMA" },
            { key: "ledger", label: "LEDGER" },
            { key: "note", label: "" },
        ],
    );

    blank();
    if (ledger === null) {
        warn("No `schema_migrations` ledger yet - it arrives with 0013.");
        info(c.grey(`  (${ledgerNote.slice(0, 70)})`));
    }

    // Disagreement between the ledger and the schema is worth shouting about: it means
    // somebody recorded a migration that did not fully take, or edited the table.
    const lying = rows.filter((r) => r.recorded && r.state === "not applied");
    if (lying.length) {
        fail(`${lying.length} migration(s) are RECORDED but not present in the schema:`);
        for (const r of lying) info(c.red(`    ${r.file}`));
        info(c.grey("    The ledger is a claim; the schema is the fact. Trust the schema."));
    }

    const partial = rows.filter((r) => r.state === "PARTIAL");
    if (partial.length) {
        fail(`${partial.length} migration(s) are PARTIALLY applied:`);
        for (const r of partial) info(c.red(`    ${r.file} - ${r.detail}`));
    }

    // --- what to do next ---
    const pending = rows.filter((r) => r.state === "not applied" || r.state === "PARTIAL");
    section("Next");
    if (pending.length === 0) {
        ok("The schema is up to date with every migration on disk.");
    } else {
        info(`${pending.length} migration(s) to apply, in this order:`);
        blank();
        for (const r of pending) {
            console.log(`    ${c.cyan(r.file)}`);
        }
        blank();
        info(c.grey("Paste each into the Supabase SQL editor, oldest first."));
        info(c.grey("Take a full system backup first: Settings -> System insurance."));
    }
    blank();
}

main().catch(die);
