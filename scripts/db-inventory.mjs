/**
 * Read-only inventory of every table in the database, classified by owner.
 *
 * WHY THIS MATTERS MORE THAN IT LOOKS
 *   This Supabase project is shared by at least five applications. Only some of the
 *   tables belong to the portal, and nothing in the database says which. Before a
 *   structural migration you want a picture you can diff against afterwards, and the
 *   one number that must not move is any FOREIGN row count.
 *
 *   It also surfaces UNCLASSIFIED tables — anything matching no known prefix and not on
 *   the portal's own list. `public.categories` shows up there: an orphan with the exact
 *   shape of `rw_categories` and no references in this repo. Nobody should delete it on
 *   a guess, which is precisely why it gets listed rather than cleaned.
 *
 * Usage:
 *   node scripts/db-inventory.mjs               # human-readable
 *   node scripts/db-inventory.mjs --json        # machine-readable, for diffing
 *
 * WRITES NOTHING. Safe against production, and meant to be run there.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv() {
    try {
        const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
        for (const line of raw.split("\n")) {
            const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
            if (!m) continue;
            let val = m[2].trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            if (!(m[1] in process.env)) process.env[m[1]] = val;
        }
    } catch {
        /* fall back to real env */
    }
}

/** Tables this portal owns. Anything here is ours to migrate. */
const PORTAL_TABLES = [
    "schema_migrations",
    "class_sets", "residential_zones", "profiles", "tenures", "units", "leadership",
    "leadership_positions", "position_privileges", "membership_units", "unit_positions",
    "zone_pastors", "module_access",
    "profile_login", "auth_sessions", "login_events",
    "registration_invites", "invite_events",
    "events", "event_registrations", "event_questions", "question_stars",
    "testimonies", "testimony_amens", "lo_member_links", "lo_member_verify_attempts",
    "admin_audit_log", "unit_transfer_requests", "handover_intents", "handover_events",
];

/** Other applications sharing this database. NEVER ours to touch. */
const FOREIGN_PREFIXES = {
    "rw_": "ReadWrite store",
    "fyb_": "Final Year Brethren",
    "elib_": "E-library",
    "game_": "Games/engagement",
    "trivia_": "Games/engagement",
    "bingo_": "Games/engagement",
    "buzzer_": "Games/engagement",
};

/** Dropped by migration 0013. Listed so a "still present" result is visible. */
const DROPPED_IN_0013 = ["verification_codes", "question_flags", "question_references"];

function classify(name) {
    if (PORTAL_TABLES.includes(name)) return { group: "PORTAL", owner: "ICT Portal" };
    for (const [prefix, owner] of Object.entries(FOREIGN_PREFIXES)) {
        if (name.startsWith(prefix)) return { group: "FOREIGN", owner };
    }
    if (DROPPED_IN_0013.includes(name)) return { group: "DROPPED", owner: "removed by 0013" };
    return { group: "UNCLASSIFIED", owner: "unknown — do not touch" };
}

async function countRows(db, table) {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
    if (error) return { error: error.message };
    return { count: count ?? 0 };
}

async function main() {
    loadEnv();
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    const db = createClient(url, key);

    // Every table we know how to ask about. PostgREST exposes no catalogue listing
    // through the JS client, so the names come from our own lists plus the dropped set —
    // a table nobody has ever heard of cannot be inventoried, and saying so is more
    // honest than implying the list is exhaustive.
    const names = [
        ...PORTAL_TABLES,
        ...DROPPED_IN_0013,
        "categories",
        ...Object.keys(FOREIGN_PREFIXES).flatMap((p) =>
            ({
                "rw_": ["rw_categories", "rw_products", "rw_product_variants", "rw_product_images",
                        "rw_orders", "rw_order_items", "rw_payments", "rw_settings", "rw_audit_logs",
                        "rw_admin_moderators", "rw_verdicts", "rw_verdict_orders", "rw_email_templates",
                        "rw_email_logs", "rw_email_queue", "rw_sponsors", "rw_sponsor_leads"],
                "fyb_": ["fyb_registrations", "fyb_admins", "fyb_pair_intents", "fyb_settings",
                         "fyb_consent_tokens", "fyb_email_templates", "fyb_email_queue", "fyb_email_logs",
                         "fyb_token_attempts", "fyb_award_categories", "fyb_award_candidates",
                         "fyb_award_votes", "fyb_award_candidate_members"],
                "elib_": ["elib_courses", "elib_materials", "elib_downloads"],
                "game_": ["game_sessions", "game_rounds", "game_participants"],
                "trivia_": ["trivia_questions", "trivia_answers"],
                "bingo_": ["bingo_calls", "bingo_cards", "bingo_marks", "bingo_wins"],
                "buzzer_": ["buzzer_prompts", "buzzer_presses"],
            })[p] ?? []),
    ];

    const results = [];
    for (const name of names) {
        const { count, error } = await countRows(db, name);
        results.push({ table: name, ...classify(name), count: count ?? null, error: error ?? null });
    }

    if (process.argv.includes("--json")) {
        console.log(JSON.stringify(
            { takenAt: new Date().toISOString(), target: url, tables: results },
            null, 2,
        ));
        return;
    }

    const groups = ["PORTAL", "FOREIGN", "UNCLASSIFIED", "DROPPED"];
    console.log(`\nDatabase inventory — ${url}`);
    console.log(`Taken ${new Date().toISOString()}\n`);

    for (const group of groups) {
        const rows = results.filter((r) => r.group === group && !(group === "DROPPED" && r.error));
        if (rows.length === 0) continue;

        const banner = {
            PORTAL: "PORTAL — ours to migrate",
            FOREIGN: "FOREIGN — other apps in this database. NEVER touch these.",
            UNCLASSIFIED: "UNCLASSIFIED — unknown owner. Confirm before acting.",
            DROPPED: "STILL PRESENT but expected gone after migration 0013.",
        }[group];

        console.log(`${banner}`);
        console.log("-".repeat(banner.length));
        let total = 0;
        for (const r of rows.sort((a, b) => a.table.localeCompare(b.table))) {
            if (r.error) {
                console.log(`  ${r.table.padEnd(32)} —        (${r.error.slice(0, 48)})`);
            } else {
                total += r.count;
                console.log(`  ${r.table.padEnd(32)} ${String(r.count).padStart(8)}`);
            }
        }
        console.log(`  ${"".padEnd(32)} ${String(total).padStart(8)}  total\n`);
    }

    const missing = results.filter((r) => r.group === "PORTAL" && r.error);
    if (missing.length) {
        console.log("Portal tables that could not be read (migration not applied?):");
        for (const m of missing) console.log(`  ${m.table} — ${m.error}`);
        console.log("");
    }
    console.log("Nothing was written.\n");
}

main().catch((e) => {
    console.error(`\n${e.message}\n`);
    process.exit(1);
});
