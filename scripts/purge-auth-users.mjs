/**
 * Purge the orphaned Supabase Auth users.
 *
 * *** READ THIS BEFORE RUNNING ANYTHING ***
 *
 *   `public.auth_sessions` is OURS. It is the portal's own table of opaque, hashed,
 *   DB-backed sessions, created by migration 0001, and it is what every logged-in leader
 *   is currently holding. It has NOTHING to do with Supabase Auth.
 *
 *   `auth.users` is SUPABASE'S. The portal stopped using Supabase Auth when 0001 dropped
 *   the `profiles.id -> auth.users(id)` foreign key. The rows left behind are inert.
 *
 *   The names are close enough that a tired person will conflate them, and deleting the
 *   wrong one logs out every leader in the fellowship. So this script REFUSES to touch
 *   anything in the `public` schema at all — it can only ever delete `auth.users` rows,
 *   through the Admin API, one at a time.
 *
 * Usage:
 *   node scripts/purge-auth-users.mjs                 # dry run: list what would go
 *   node scripts/purge-auth-users.mjs --commit        # actually delete
 *   node scripts/purge-auth-users.mjs --commit --keep me@example.com
 *   node scripts/purge-auth-users.mjs --env local     # skip the environment prompt
 *
 * Dry run is the default and always will be.
 */
import { createClient } from "@supabase/supabase-js";
import {
    c, heading, section, table, kv, ok, warn, info, blank, progress,
    chooseEnvironment, confirm, flagValue, hasFlag, die,
} from "./lib/cli.mjs";

async function main() {
    const commit = hasFlag("commit");

    heading(
        "Purge orphaned Supabase Auth users",
        commit ? "COMMIT - rows will be deleted" : "dry run - nothing will be deleted",
    );

    section("What this touches");
    kv([
        [c.green("auth.users"), "Supabase's own table. Inert since migration 0001. THIS is purged."],
        [c.red("public.auth_sessions"), "OURS. Every leader's live session. NEVER touched."],
    ]);
    blank();
    info(c.grey("The names are close enough to confuse at 2am, so this script physically"));
    info(c.grey("cannot reach anything in the public schema - only the Admin API."));

    const env = await chooseEnvironment({ purpose: "purge", envFlag: flagValue("env") });
    const db = createClient(env.url, env.vars.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const keep = new Set(
        process.argv.reduce((acc, arg, i, all) => (arg === "--keep" ? [...acc, all[i + 1]] : acc), []),
    );

    // Show the portal's own session table is intact, so the thing anyone running this
    // is worried about is visibly untouched.
    section("Portal sessions (not touched)");
    const { count: sessionCount, error: sessionErr } = await db
        .from("auth_sessions")
        .select("id", { count: "exact", head: true });
    if (sessionErr) {
        warn(`Could not read public.auth_sessions (${sessionErr.message})`);
    } else {
        ok(`public.auth_sessions holds ${c.bold(sessionCount)} live portal session(s).`);
    }

    section("Supabase Auth users");
    const users = [];
    for (let page = 1; ; page++) {
        const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
        if (error) {
            // A project that never used Supabase Auth, or whose auth schema was never
            // provisioned, answers this way. That is not a failure of this script — it
            // means there is nothing here to purge.
            throw new Error(
                `Could not list auth.users: ${error.message}\n`
                + "  This usually means the project's auth schema is empty or was never\n"
                + "  provisioned — in which case there is nothing to purge. Check the\n"
                + "  Authentication tab in the Supabase dashboard to confirm.",
            );
        }
        users.push(...data.users);
        if (data.users.length < 200) break;
    }

    if (users.length === 0) {
        ok("None. Nothing to do.");
        blank();
        return;
    }

    const doomed = users.filter((u) => !keep.has(u.email));
    info(`${users.length} row(s) found; ${c.bold(doomed.length)} would be removed.`);
    blank();
    table(
        doomed.slice(0, 30).map((u) => ({ email: u.email ?? c.grey("(no email)"), id: c.grey(u.id) })),
        [{ key: "email", label: "EMAIL" }, { key: "id", label: "ID" }],
    );
    if (doomed.length > 30) info(c.grey(`... and ${doomed.length - 30} more`));
    for (const k of keep) info(`${c.green("keeping")} ${k}`);

    if (!commit) {
        blank();
        info(c.grey("Dry run. Re-run with --commit to delete these."));
        blank();
        return;
    }

    blank();
    if (!hasFlag("yes") && !await confirm(`Delete ${doomed.length} auth.users row(s) from ${c.bold(env.ref ?? env.file)}?`)) {
        info("Nothing was done.");
        return;
    }

    section("Deleting");
    let removed = 0;
    const failures = [];
    let n = 0;
    for (const u of doomed) {
        const { error } = await db.auth.admin.deleteUser(u.id);
        if (error) failures.push(`${u.email ?? u.id}: ${error.message}`);
        else removed += 1;
        progress(++n, doomed.length, u.email ?? u.id);
    }

    blank();
    ok(`Removed ${removed} of ${doomed.length}.`);
    if (failures.length) {
        warn(`${failures.length} failed:`);
        for (const f of failures) info(c.red(`  ${f}`));
    }
    blank();
}

main().catch(die);
