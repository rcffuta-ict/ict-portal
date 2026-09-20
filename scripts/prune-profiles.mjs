/**
 * Prune bad profile records — safely.
 *
 * DELETING A PROFILE IS THE MOST DANGEROUS OPERATION IN THIS DATABASE.
 *
 *   `public.profiles` is the shared identity table for FIVE applications. 45 foreign
 *   keys point at it, and 17 of those belong to apps that are not this portal:
 *   rw_* (ReadWrite store), fyb_* (Final Year Brethren), elib_*, and the games app.
 *
 *   So "delete this member" can quietly mean "delete another team's award votes". This
 *   script therefore does three things before it will remove anything:
 *
 *     1. Counts every reference to each candidate, across ALL 45 foreign keys.
 *     2. Splits them into PORTAL references (ours to cascade) and FOREIGN ones.
 *     3. REFUSES to touch any profile with a foreign reference unless you pass
 *        --include-foreign-apps, having seen exactly what that destroys.
 *
 *   Dry run is the default and always will be.
 *
 * Usage:
 *   node scripts/prune-profiles.mjs --email-like '%@fyb-test.local'
 *   node scripts/prune-profiles.mjs --email-like '%@rcffuta.test' --commit
 *   node scripts/prune-profiles.mjs --no-email --dangling
 *   node scripts/prune-profiles.mjs --id <uuid> --id <uuid>
 *
 * Selectors (combine freely; a profile must match ALL given):
 *   --email-like PATTERN  SQL LIKE against email, e.g. '%@fyb-test.local'
 *   --name-like  PATTERN  SQL LIKE against first or last name
 *   --no-email            profiles with no email at all
 *   --dangling            profiles with NO references anywhere (safest to remove)
 *   --id UUID             an explicit profile (repeatable)
 *
 * Flags:
 *   --env NAME              skip the environment prompt
 *   --commit                actually delete (default is a dry run)
 *   --include-foreign-apps  allow deleting profiles other apps reference. Read the
 *                           report first; this destroys data you do not own.
 *   --yes                   skip the confirmation (scripted runs)
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import {
    c, heading, section, table, kv, ok, warn, fail, info, step, blank, progress,
    chooseEnvironment, confirm, ask, flagValue, hasFlag, die,
} from "./lib/cli.mjs";

/**
 * Every foreign key into public.profiles, as { table, column, owner }.
 *
 * Mirrors db/db-schema.sql. When a migration adds a new reference to profiles, ADD IT
 * HERE — a missing entry means this script deletes a parent whose child it never
 * counted, and the delete fails mid-run or, worse, cascades silently.
 */
const REFERENCES = [
    // --- the portal's own ---
    ["leadership", "profile_id", "portal"],
    ["membership_units", "profile_id", "portal"],
    ["profile_login", "profile_id", "portal"],
    ["profile_login", "granted_by", "portal"],
    ["auth_sessions", "profile_id", "portal"],
    ["login_events", "profile_id", "portal"],
    ["invite_events", "profile_id", "portal"],
    ["registration_invites", "target_profile_id", "portal"],
    ["registration_invites", "created_by", "portal"],
    ["unit_transfer_requests", "profile_id", "portal"],
    ["unit_transfer_requests", "requested_by", "portal"],
    ["unit_transfer_requests", "decided_by", "portal"],
    ["zone_pastors", "profile_id", "portal"],
    ["module_access", "updated_by", "portal"],
    ["admin_audit_log", "actor_profile_id", "portal"],
    ["admin_audit_log", "target_profile_id", "portal"],
    ["handover_intents", "initiated_by", "portal"],
    ["handover_intents", "completed_by", "portal"],
    ["handover_events", "actor_id", "portal"],
    ["event_questions", "asked_by_profile_id", "portal"],
    ["event_questions", "answered_by_profile_id", "portal"],
    ["question_stars", "profile_id", "portal"],
    ["question_flags", "flagged_by_profile_id", "portal"],
    ["question_flags", "resolved_by_profile_id", "portal"],
    ["testimonies", "author_profile_id", "portal"],
    ["testimonies", "reviewed_by_profile_id", "portal"],
    ["testimony_amens", "profile_id", "portal"],
    ["lo_member_links", "profile_id", "portal"],
    // --- other applications: NOT OURS ---
    ["rw_admin_moderators", "profile_id", "ReadWrite store"],
    ["rw_admin_moderators", "added_by", "ReadWrite store"],
    ["rw_audit_logs", "profile_id", "ReadWrite store"],
    ["rw_settings", "updated_by", "ReadWrite store"],
    ["rw_verdicts", "issued_by_profile_id", "ReadWrite store"],
    ["rw_verdicts", "fulfilled_by_profile_id", "ReadWrite store"],
    ["fyb_registrations", "profile_id", "Final Year Brethren"],
    ["fyb_admins", "profile_id", "Final Year Brethren"],
    ["fyb_award_votes", "voter_profile_id", "Final Year Brethren"],
    ["fyb_pair_intents", "approved_by", "Final Year Brethren"],
    ["elib_downloads", "user_id", "E-library"],
    ["elib_materials", "uploaded_by", "E-library"],
    ["game_participants", "profile_id", "Games & engagement"],
    ["bingo_cards", "profile_id", "Games & engagement"],
    ["bingo_wins", "profile_id", "Games & engagement"],
    ["buzzer_presses", "profile_id", "Games & engagement"],
    ["trivia_answers", "profile_id", "Games & engagement"],
];

/**
 * Portal child rows to delete, in FK-safe order, before the profile itself.
 *
 * Deliberately NOT everything above. `admin_audit_log.actor_profile_id` and the
 * handover actor columns are HISTORY — who did what. They are nullable and deleting the
 * rows would erase the audit trail to tidy up a profile, which is backwards. Those are
 * nulled instead.
 */
const CASCADE_DELETE = [
    "auth_sessions.profile_id",
    "profile_login.profile_id",
    "lo_member_links.profile_id",
    "testimony_amens.profile_id",
    "question_stars.profile_id",
    "membership_units.profile_id",
    "unit_transfer_requests.profile_id",
    "zone_pastors.profile_id",
    "leadership.profile_id",
];

/** Portal columns to NULL rather than delete — history that must survive. */
const NULL_OUT = [
    "login_events.profile_id",
    "invite_events.profile_id",
    "admin_audit_log.actor_profile_id",
    "admin_audit_log.target_profile_id",
    "handover_intents.initiated_by",
    "handover_intents.completed_by",
    "handover_events.actor_id",
    "event_questions.asked_by_profile_id",
    "event_questions.answered_by_profile_id",
    "testimonies.author_profile_id",
    "testimonies.reviewed_by_profile_id",
    "question_flags.flagged_by_profile_id",
    "question_flags.resolved_by_profile_id",
    "registration_invites.target_profile_id",
    "registration_invites.created_by",
    "profile_login.granted_by",
    "module_access.updated_by",
    "unit_transfer_requests.requested_by",
    "unit_transfer_requests.decided_by",
];

const fullName = (p) => [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "(no name)";

/** Repeatable --id flags. */
function idFlags() {
    return process.argv.reduce((acc, a, i, all) => (a === "--id" ? [...acc, all[i + 1]] : acc), []);
}

async function selectCandidates(db) {
    const emailLike = flagValue("email-like");
    const nameLike = flagValue("name-like");
    const ids = idFlags();

    let q = db.from("profiles").select("*");
    if (emailLike) q = q.like("email", emailLike);
    if (hasFlag("no-email")) q = q.is("email", null);
    if (ids.length) q = q.in("id", ids);
    if (nameLike) q = q.or(`first_name.ilike.${nameLike},last_name.ilike.${nameLike}`);

    const { data, error } = await q.order("created_at");
    if (error) throw new Error(`Selecting profiles: ${error.message}`);
    return data ?? [];
}

/** Count every reference to these profiles, grouped by owner. */
async function countReferences(db, ids) {
    const perProfile = new Map(ids.map((id) => [id, { portal: 0, foreign: 0, detail: [] }]));
    const totals = [];

    let n = 0;
    for (const [tableName, column, owner] of REFERENCES) {
        progress(++n, REFERENCES.length, `${tableName}.${column}`);

        const { data, error } = await db.from(tableName).select(`${column}`).in(column, ids);
        // A table that does not exist here (another app not installed) is not an error.
        if (error) continue;
        if (!data?.length) continue;

        totals.push({ table: tableName, column, owner, count: data.length });
        for (const row of data) {
            const entry = perProfile.get(row[column]);
            if (!entry) continue;
            if (owner === "portal") entry.portal += 1;
            else {
                entry.foreign += 1;
                entry.detail.push(owner);
            }
        }
    }
    return { perProfile, totals };
}

async function main() {
    const commit = hasFlag("commit");
    heading(
        "Prune profiles",
        commit ? "COMMIT - records will be deleted" : "dry run - nothing will be deleted",
    );

    section("Why this is careful");
    info(c.grey("public.profiles is the shared identity table for five applications."));
    info(c.grey(`${REFERENCES.length} foreign keys point at it; ${REFERENCES.filter((r) => r[2] !== "portal").length} belong to apps that are not this portal.`));
    info(c.grey("Deleting a member can mean deleting another team's data."));

    const env = await chooseEnvironment({ purpose: "prune", envFlag: flagValue("env") });
    const db = createClient(env.url, env.vars.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const hasSelector = ["email-like", "name-like"].some(flagValue)
        || hasFlag("no-email") || hasFlag("dangling") || idFlags().length;
    if (!hasSelector) {
        throw new Error(
            "No selector given. Choose what to prune, e.g.\n"
            + "    --email-like '%@fyb-test.local'\n"
            + "    --no-email --dangling\n"
            + "    --id <uuid>",
        );
    }

    section("Candidates");
    let candidates = await selectCandidates(db);
    if (candidates.length === 0) {
        ok("Nothing matched. Nothing to do.");
        blank();
        return;
    }
    info(`${candidates.length} profile(s) matched.`);

    section("Counting references");
    const { perProfile, totals } = await countReferences(db, candidates.map((p) => p.id));

    if (hasFlag("dangling")) {
        const before = candidates.length;
        candidates = candidates.filter((p) => {
            const r = perProfile.get(p.id);
            return r.portal === 0 && r.foreign === 0;
        });
        info(`--dangling: ${before} -> ${candidates.length} with no references at all.`);
        if (candidates.length === 0) {
            ok("None are dangling. Nothing to do.");
            blank();
            return;
        }
    }

    section("What references them");
    if (totals.length === 0) {
        ok("Nothing references these profiles anywhere.");
    } else {
        table(
            totals.sort((a, b) => (a.owner === "portal" ? 1 : -1) - (b.owner === "portal" ? 1 : -1)).map((t) => ({
                table: t.owner === "portal" ? t.table : c.red(t.table),
                column: c.grey(t.column),
                owner: t.owner === "portal" ? c.grey("portal") : c.red(t.owner),
                rows: String(t.count),
            })),
            [
                { key: "table", label: "TABLE" },
                { key: "column", label: "COLUMN" },
                { key: "owner", label: "OWNER" },
                { key: "rows", label: "ROWS", align: "right" },
            ],
        );
    }

    const withForeign = candidates.filter((p) => perProfile.get(p.id).foreign > 0);
    const foreignTotals = totals.filter((t) => t.owner !== "portal");

    section("The profiles");
    table(
        candidates.slice(0, 40).map((p) => {
            const r = perProfile.get(p.id);
            return {
                name: fullName(p),
                email: c.grey(p.email ?? "(none)"),
                portal: String(r.portal),
                foreign: r.foreign ? c.red(String(r.foreign)) : "0",
                apps: c.red([...new Set(r.detail)].join(", ")),
            };
        }),
        [
            { key: "name", label: "NAME" },
            { key: "email", label: "EMAIL" },
            { key: "portal", label: "PORTAL", align: "right" },
            { key: "foreign", label: "FOREIGN", align: "right" },
            { key: "apps", label: "" },
        ],
    );
    if (candidates.length > 40) info(c.grey(`... and ${candidates.length - 40} more`));

    // --- the gate ---
    const includeForeign = hasFlag("include-foreign-apps");
    if (withForeign.length > 0) {
        blank();
        fail(`${withForeign.length} of these are referenced by ANOTHER APPLICATION.`);
        for (const t of foreignTotals) {
            info(c.red(`    ${t.owner}: ${t.count} row(s) in ${t.table}.${t.column}`));
        }
        blank();
        if (!includeForeign) {
            warn("Refusing to delete them. That is not this portal's data to remove.");
            info(c.grey("If you are certain (you own that app, or it is disposable test data):"));
            info(`  ${c.cyan("--include-foreign-apps")}`);
            blank();
            const safe = candidates.filter((p) => perProfile.get(p.id).foreign === 0);
            if (safe.length) {
                info(`${safe.length} of the matched profiles have NO foreign references and could`);
                info("be pruned on their own. Narrow your selector to those, or add --dangling.");
            }
            blank();
            return;
        }
        warn("--include-foreign-apps was passed. Their rows WILL be deleted too.");
    }

    if (!commit) {
        blank();
        info(c.grey("Dry run. Re-run with --commit to delete."));
        blank();
        return;
    }

    // --- confirmation ---
    blank();
    if (!hasFlag("yes")) {
        console.log(`  ${c.red(c.bold(`About to delete ${candidates.length} profile(s) from ${env.ref ?? env.file}.`))}`);
        if (withForeign.length) {
            console.log(`  ${c.red(c.bold(`This includes ${foreignTotals.reduce((n, t) => n + t.count, 0)} row(s) belonging to other applications.`))}`);
        }
        const typed = await ask(`  Type ${c.bold("delete")} to proceed`);
        if (typed !== "delete") {
            info("Did not match. Nothing was done.");
            return;
        }
    }

    // --- a record of what is about to go ---
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logPath = `.tmp/pruned-profiles-${stamp}.json`;
    try {
        writeFileSync(logPath, JSON.stringify({
            takenAt: new Date().toISOString(),
            environment: env.file,
            project: env.ref,
            profiles: candidates,
        }, null, 2));
        ok(`Wrote the full records to ${logPath} before deleting.`);
    } catch (e) {
        warn(`Could not write ${logPath}: ${e.message}`);
        if (!await confirm("Continue without that local record?")) return;
    }

    const ids = candidates.map((p) => p.id);

    section("Nulling history references");
    for (const spec of NULL_OUT) {
        const [t, col] = spec.split(".");
        const { error, count } = await db.from(t).update({ [col]: null }, { count: "exact" }).in(col, ids);
        if (error) { warn(`${spec}: ${error.message}`); continue; }
        if (count) info(`${spec}: ${count} row(s) nulled ${c.grey("(history preserved)")}`);
    }

    if (includeForeign) {
        section("Deleting other applications' rows");
        for (const [t, col, owner] of REFERENCES.filter((r) => r[2] !== "portal")) {
            const { error, count } = await db.from(t).delete({ count: "exact" }).in(col, ids);
            if (error) { warn(`${t}.${col}: ${error.message}`); continue; }
            if (count) info(`${c.red(t)}.${col}: ${count} row(s) deleted ${c.grey(`(${owner})`)}`);
        }
    }

    section("Deleting portal rows");
    for (const spec of CASCADE_DELETE) {
        const [t, col] = spec.split(".");
        const { error, count } = await db.from(t).delete({ count: "exact" }).in(col, ids);
        if (error) { warn(`${spec}: ${error.message}`); continue; }
        if (count) info(`${spec}: ${count} row(s) deleted`);
    }

    section("Deleting the profiles");
    const { error, count } = await db.from("profiles").delete({ count: "exact" }).in("id", ids);
    if (error) throw new Error(`Deleting profiles: ${error.message}`);

    blank();
    ok(`Deleted ${count} profile(s) from ${c.bold(env.file)}.`);
    info(c.grey(`Their full records are in ${logPath} if you need them back.`));
    blank();
}

main().catch(die);
