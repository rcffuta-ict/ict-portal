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
 *
 * Dry run is the default and always will be.
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

async function main() {
    loadEnv();
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

    const commit = process.argv.includes("--commit");
    const keep = new Set(
        process.argv.reduce((acc, arg, i, all) => (arg === "--keep" ? [...acc, all[i + 1]] : acc), []),
    );

    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

    console.log(`\nTarget: ${url}`);
    console.log(commit ? "Mode:   COMMIT — rows WILL be deleted" : "Mode:   DRY RUN — nothing will be deleted");
    console.log("Scope:  auth.users only. public.auth_sessions is NOT touched.\n");

    // Confirm the portal's own session table is intact and say so out loud, so anyone
    // running this can see the thing they were worried about is untouched.
    const { count: sessionCount, error: sessionErr } = await db
        .from("auth_sessions")
        .select("id", { count: "exact", head: true });
    if (sessionErr) {
        console.log(`  public.auth_sessions: could not read (${sessionErr.message})`);
    } else {
        console.log(`  public.auth_sessions holds ${sessionCount} live portal session(s) — untouched by this script.\n`);
    }

    // Page through the Admin API.
    const users = [];
    for (let page = 1; ; page++) {
        const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw new Error(`Could not list auth users: ${error.message}`);
        users.push(...data.users);
        if (data.users.length < 200) break;
    }

    if (users.length === 0) {
        console.log("No auth.users rows. Nothing to do.\n");
        return;
    }

    const doomed = users.filter((u) => !keep.has(u.email));
    console.log(`Found ${users.length} auth.users row(s); ${doomed.length} would be removed:\n`);
    for (const u of doomed.slice(0, 40)) {
        console.log(`  ${(u.email ?? "(no email)").padEnd(40)} ${u.id}`);
    }
    if (doomed.length > 40) console.log(`  … and ${doomed.length - 40} more`);
    for (const k of keep) console.log(`\n  keeping: ${k}`);

    if (!commit) {
        console.log("\nDry run. Re-run with --commit to delete these.\n");
        return;
    }

    let removed = 0;
    const failures = [];
    for (const u of doomed) {
        const { error } = await db.auth.admin.deleteUser(u.id);
        if (error) failures.push(`${u.email ?? u.id}: ${error.message}`);
        else removed += 1;
    }

    console.log(`\nRemoved ${removed} of ${doomed.length}.`);
    if (failures.length) {
        console.log(`Failed (${failures.length}):`);
        for (const f of failures) console.log(`  ${f}`);
    }
    console.log("");
}

main().catch((e) => {
    console.error(`\n${e.message}\n`);
    process.exit(1);
});
