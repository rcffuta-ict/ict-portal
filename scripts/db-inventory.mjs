/**
 * Read-only inventory of every table, classified by which application owns it.
 *
 * WHY THIS MATTERS MORE THAN IT LOOKS
 *   This Supabase project is shared by five applications. Only some tables belong to
 *   the portal, and nothing in the database says which. Before a structural migration
 *   you want a picture to diff against afterwards, and the numbers that must NOT move
 *   are the FOREIGN ones.
 *
 *   It also lists UNCLASSIFIED tables — anything matching no known prefix and not on
 *   the portal's own list. `public.categories` shows up there: an orphan with the exact
 *   shape of `rw_categories` and no references in this repo. Nobody should delete it on
 *   a guess, which is exactly why it gets listed rather than cleaned.
 *
 * Usage:
 *   node scripts/db-inventory.mjs                  # pick an environment, print a report
 *   node scripts/db-inventory.mjs --env local      # skip the prompt
 *   node scripts/db-inventory.mjs --json > x.json  # machine-readable, for diffing
 *   node scripts/db-inventory.mjs --compare a.json # diff against an earlier snapshot
 *
 * WRITES NOTHING. Safe against production, and meant to be run there.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import {
    c, heading, section, table, kv, ok, warn, info, blank, progress,
    chooseEnvironment, flagValue, hasFlag, die,
} from "./lib/cli.mjs";

/** Tables this portal owns. Anything here is ours to migrate. */
const PORTAL_TABLES = [
    "schema_migrations",
    "class_sets", "residential_zones", "profiles", "tenures", "units", "leadership",
    "leadership_positions", "position_privileges", "membership_units", "unit_positions",
    "zone_pastors", "module_access",
    "profile_login", "auth_sessions", "login_events",
    "registration_invites", "invite_events",
    "events", "event_registrations", "event_questions", "question_stars",
    // question_flags is KEPT deliberately — the event_questions_with_details view
    // depends on it. See migration 0013.
    "question_flags",
    "testimonies", "testimony_amens", "lo_member_links", "lo_member_verify_attempts",
    "admin_audit_log", "unit_transfer_requests", "handover_intents", "handover_events",
];

/** Other applications sharing this database. NEVER ours to touch. */
const FOREIGN = {
    "ReadWrite store": ["rw_categories", "rw_products", "rw_product_variants",
        "rw_product_images", "rw_orders", "rw_order_items", "rw_payments", "rw_settings",
        "rw_audit_logs", "rw_admin_moderators", "rw_verdicts", "rw_verdict_orders",
        "rw_email_templates", "rw_email_logs", "rw_email_queue", "rw_sponsors",
        "rw_sponsor_leads"],
    "Final Year Brethren": ["fyb_registrations", "fyb_admins", "fyb_pair_intents",
        "fyb_settings", "fyb_consent_tokens", "fyb_email_templates", "fyb_email_queue",
        "fyb_email_logs", "fyb_token_attempts", "fyb_award_categories",
        "fyb_award_candidates", "fyb_award_votes", "fyb_award_candidate_members"],
    "E-library": ["elib_courses", "elib_materials", "elib_downloads"],
    "Games & engagement": ["game_sessions", "game_rounds", "game_participants",
        "trivia_questions", "trivia_answers", "bingo_calls", "bingo_cards", "bingo_marks",
        "bingo_wins", "buzzer_prompts", "buzzer_presses"],
};

/** Expected GONE after migration 0013. Listed so "still present" is visible. */
const DROPPED_IN_0013 = ["verification_codes", "question_references"];

/** Unknown owner. Listed, never touched. */
const UNCLASSIFIED = ["categories"];

function classify(name) {
    if (PORTAL_TABLES.includes(name)) return { group: "PORTAL", owner: "ICT Portal" };
    for (const [owner, tables] of Object.entries(FOREIGN)) {
        if (tables.includes(name)) return { group: "FOREIGN", owner };
    }
    if (DROPPED_IN_0013.includes(name)) return { group: "DROPPED", owner: "removed by 0013" };
    return { group: "UNCLASSIFIED", owner: "unknown - do not touch" };
}

async function main() {
    const json = hasFlag("json");
    const compareTo = flagValue("compare");

    // --json is a pipe; the banner would corrupt it.
    if (!json) heading("Database inventory", "read-only - nothing is written");

    const env = await chooseEnvironment({
        purpose: "inventory",
        envFlag: flagValue("env"),
    });

    const db = createClient(env.url, env.vars.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const names = [
        ...PORTAL_TABLES,
        ...Object.values(FOREIGN).flat(),
        ...DROPPED_IN_0013,
        ...UNCLASSIFIED,
    ];

    if (!json) {
        section("Counting");
        info(c.grey(`${names.length} known tables. A table nobody has heard of cannot be`));
        info(c.grey("inventoried, so this list is complete only as far as we know it."));
        blank();
    }

    const results = [];
    let done = 0;
    for (const name of names) {
        const { count, error } = await db.from(name).select("*", { count: "exact", head: true });
        results.push({ table: name, ...classify(name), count: error ? null : (count ?? 0), error: error?.message ?? null });
        if (!json) progress(++done, names.length, name);
    }

    const snapshot = { takenAt: new Date().toISOString(), environment: env.file, project: env.ref, tables: results };

    if (json) {
        console.log(JSON.stringify(snapshot, null, 2));
        return;
    }

    const groups = [
        ["PORTAL", c.cyan("PORTAL"), "ours to migrate"],
        ["FOREIGN", c.yellow("FOREIGN"), "other apps in this database - NEVER touch these"],
        ["UNCLASSIFIED", c.magenta("UNCLASSIFIED"), "unknown owner - confirm before acting"],
        ["DROPPED", c.grey("EXPECTED GONE"), "migration 0013 removes these"],
    ];

    for (const [group, label, note] of groups) {
        const rows = results.filter((r) => r.group === group);
        const present = rows.filter((r) => !r.error);
        if (group === "DROPPED" && present.length === 0) {
            section(`${label}  ${c.grey(note)}`);
            ok("All absent - 0013's drops have been applied.");
            continue;
        }
        if (rows.length === 0) continue;

        section(`${label}  ${c.grey(note)}`);
        table(
            rows.map((r) => ({
                table: r.table,
                owner: group === "FOREIGN" ? c.grey(r.owner) : "",
                rows: r.error ? c.grey("absent") : String(r.count),
            })),
            [
                { key: "table", label: "TABLE" },
                { key: "owner", label: "" },
                { key: "rows", label: "ROWS", align: "right" },
            ],
        );
        const total = present.reduce((n, r) => n + r.count, 0);
        info(c.grey(`${present.length} present, ${total.toLocaleString()} rows total`));
    }

    const missingPortal = results.filter((r) => r.group === "PORTAL" && r.error);
    if (missingPortal.length) {
        section("Portal tables that could not be read");
        warn("A migration may not be applied yet.");
        kv(missingPortal.map((m) => [m.table, c.grey(m.error.slice(0, 60))]));
    }

    if (compareTo) {
        section("Compared with the earlier snapshot");
        const before = JSON.parse(readFileSync(compareTo, "utf8"));
        const beforeBy = new Map(before.tables.map((t) => [t.table, t]));

        const changes = [];
        for (const now of results) {
            const then = beforeBy.get(now.table);
            if (!then) continue;
            if (then.count !== now.count) {
                changes.push({
                    table: now.table,
                    group: now.group,
                    before: then.count === null ? "absent" : String(then.count),
                    after: now.count === null ? "absent" : String(now.count),
                });
            }
        }

        if (changes.length === 0) {
            ok("Nothing changed.");
        } else {
            table(
                changes.map((ch) => ({
                    table: ch.group === "FOREIGN" ? c.red(ch.table) : ch.table,
                    group: ch.group === "FOREIGN" ? c.red("FOREIGN") : c.grey(ch.group),
                    before: ch.before,
                    after: ch.after,
                })),
                [
                    { key: "table", label: "TABLE" },
                    { key: "group", label: "" },
                    { key: "before", label: "BEFORE", align: "right" },
                    { key: "after", label: "AFTER", align: "right" },
                ],
            );
            const foreignMoved = changes.filter((ch) => ch.group === "FOREIGN");
            blank();
            if (foreignMoved.length) {
                console.log(`  ${c.red("!!  " + foreignMoved.length + " FOREIGN table(s) changed.")}`);
                info(c.red("    Another application's data moved. That should not happen"));
                info(c.red("    during a portal migration - investigate before continuing."));
            } else {
                ok("No foreign-app row count changed.");
            }
        }
        info(c.grey(`(before: ${before.environment ?? "?"} at ${before.takenAt})`));
    }

    blank();
    info(c.grey("Nothing was written."));
    blank();
}

main().catch(die);
