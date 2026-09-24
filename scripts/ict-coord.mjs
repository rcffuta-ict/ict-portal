/**
 * Verify — and on staging, create — the ICT Coordinator.
 *
 * WHY THIS IS ITS OWN SCRIPT
 *   The ICT Coordinator is the only position carrying the SYSADMIN privilege tag. If
 *   nobody holds it in the active tenure, or the holder has no login, there is no
 *   System Admin: Settings, the Oracle and the full-system backup are all unreachable,
 *   and no amount of database access from a terminal fixes it for the people who need
 *   the UI. That is a silent failure -- the portal works perfectly for everyone else --
 *   so it is worth a check you can run deliberately.
 *
 *   It matters most right after a reset or a handover, which is exactly when nobody is
 *   thinking about it.
 *
 * TWO VERBS
 *   (default)  CHECK. Read-only. Safe against production, and meant to be run there.
 *              Exits non-zero when the chain is broken, so it works in CI or a cron.
 *
 *   --seed     CREATE the default coordinator. REFUSES PRODUCTION. Staging needs a
 *              known sysadmin to test with; production needs a real human being, and
 *              seeding a fictional one there would put a working System Admin login
 *              into a live system under a name nobody can hold accountable.
 *
 * Usage:
 *   node scripts/ict-coord.mjs                         # check; pick an environment
 *   node scripts/ict-coord.mjs --env production        # check production
 *   node scripts/ict-coord.mjs --seed                  # staging default, random password
 *   node scripts/ict-coord.mjs --seed --password 'x'   # staging default, chosen password
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes, scrypt as _scrypt } from "node:crypto";
import { promisify } from "node:util";
import {
    c, heading, section, table, kv, ok, fail, info, blank,
    chooseEnvironment, flagValue, hasFlag, die,
} from "./lib/cli.mjs";

const scrypt = promisify(_scrypt);
const KEYLEN = 64;

const POSITION_SLUG = "ict-coord";

/**
 * The staging default.
 *
 * `@rcffuta.test` is an RFC 2606 reserved TLD: it can never resolve and can never
 * receive mail, so this address cannot reach a real inbox even if staging data escapes
 * into something that sends email. Same reasoning as scripts/seed-test.mjs.
 */
const DEFAULT_COORD = {
    firstName: "Melchizedek",
    lastName: "Oracle",
    email: "oracle@rcffuta.test",
};

/** Same scrypt format as src/lib/auth/password.ts, so the portal accepts it. */
async function hashPassword(password) {
    const secret = process.env.SESSION_SECRET;
    if (!secret) throw new Error("SESSION_SECRET is required — it is the pepper the hash is derived with.");
    const salt = randomBytes(16);
    const derived = await scrypt(`${password}${secret}`, salt, KEYLEN);
    return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/**
 * Read the whole chain in one place.
 *
 * Matched by SLUG, never by title. `leadership_positions.title` is editable from the
 * UI -- rename the office and a title-matching script silently stops finding it. The
 * slug is the immutable machine handle, which is why migration 0013 rewrote
 * rcf_profile_context to match VP Admin the same way.
 */
async function inspect(db) {
    const { data: position } = await db
        .from("leadership_positions")
        .select("id, slug, title, alias, tier, is_active, is_protected")
        .eq("slug", POSITION_SLUG)
        .maybeSingle();

    const { data: tenure } = await db
        .from("tenures")
        .select("id, session, is_active")
        .eq("is_active", true)
        .maybeSingle();

    if (!position) return { position: null, tenure, privileges: [], holders: [] };

    const { data: privileges } = await db
        .from("position_privileges")
        .select("privilege, scope")
        .eq("position_id", position.id);

    let holders = [];
    if (tenure) {
        const { data, error } = await db
            .from("leadership")
            // `profiles!leadership_profile_id_fkey`, not plain `profiles`: `ended_by`
            // is a second FK to profiles, and the bare embed is ambiguous (PGRST201).
            // Ended appointments are service history and confer nothing, so skip them.
            .select("id, is_lead, profiles!leadership_profile_id_fkey(id, first_name, last_name, email)")
            .eq("position_id", position.id)
            .eq("tenure_id", tenure.id)
            .is("ended_at", null);
        if (error) throw error;
        holders = data ?? [];

        for (const h of holders) {
            const { data: login } = await db
                .from("profile_login")
                .select("is_active, password_hash, last_login_at")
                .eq("profile_id", h.profiles.id)
                .maybeSingle();
            h.login = login ?? null;
        }
    }

    return { position, tenure, privileges: privileges ?? [], holders };
}

function report({ position, tenure, privileges, holders }) {
    const checks = [];

    checks.push({
        check: `Position \`${POSITION_SLUG}\` exists`,
        pass: Boolean(position),
        note: position ? `${position.title} (${position.alias ?? "no alias"})` : "run db/seed/default.sql",
    });

    if (position) {
        checks.push({
            check: "Position is active",
            pass: position.is_active === true,
            note: position.is_active ? "" : "reactivate it — a disabled position grants nothing",
        });
        checks.push({
            check: "Carries the SYSADMIN tag",
            pass: privileges.some((p) => p.privilege === "SYSADMIN"),
            note: privileges.map((p) => p.privilege + (p.scope ? `:${p.scope}` : "")).join(", ") || "no privileges at all",
        });
    }

    checks.push({
        check: "An active tenure exists",
        pass: Boolean(tenure),
        note: tenure ? tenure.session : "nothing is active — leadership is tenure-scoped",
    });

    const lead = holders.find((h) => h.is_lead) ?? holders[0];
    checks.push({
        check: "Somebody holds it this tenure",
        pass: Boolean(lead),
        note: lead ? `${lead.profiles.first_name} ${lead.profiles.last_name} <${lead.profiles.email}>` : "nobody — there is no System Admin",
    });

    if (lead) {
        checks.push({
            check: "The holder can sign in",
            pass: Boolean(lead.login?.is_active && lead.login?.password_hash),
            note: !lead.login
                ? "no profile_login row"
                : !lead.login.is_active
                    ? "login is deactivated"
                    : lead.login.last_login_at
                        ? `last signed in ${new Date(lead.login.last_login_at).toISOString().slice(0, 10)}`
                        : "never signed in (password set on first login)",
        });
    }

    table(
        checks.map((x) => ({
            result: x.pass ? c.green("PASS") : c.red("FAIL"),
            check: x.check,
            note: c.grey(x.note),
        })),
        [{ key: "result", label: "" }, { key: "check", label: "CHECK" }, { key: "note", label: "" }],
    );

    return checks.every((x) => x.pass);
}

async function seed(db, password) {
    const { position, tenure } = await inspect(db);
    if (!position) throw new Error(`No \`${POSITION_SLUG}\` position. Apply db/seed/default.sql first.`);
    if (!tenure) throw new Error("No active tenure. Create and activate one first.");

    const email = DEFAULT_COORD.email.toLowerCase();

    let { data: profile } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
    if (!profile) {
        const { data, error } = await db
            .from("profiles")
            .insert({ first_name: DEFAULT_COORD.firstName, last_name: DEFAULT_COORD.lastName, email })
            .select("id")
            .single();
        if (error) throw error;
        profile = data;
        ok(`Created profile for ${DEFAULT_COORD.firstName} ${DEFAULT_COORD.lastName}`);
    } else {
        info(`Reusing existing profile ${c.grey(profile.id)}`);
    }

    const { data: existing } = await db
        .from("leadership")
        .select("id")
        .eq("tenure_id", tenure.id)
        .eq("position_id", position.id)
        .eq("profile_id", profile.id)
        .is("ended_at", null)
        .maybeSingle();

    if (!existing) {
        const { error } = await db
            .from("leadership")
            .insert({ tenure_id: tenure.id, position_id: position.id, profile_id: profile.id, is_lead: true });
        if (error) throw error;
        ok(`Assigned ICT Coordinator for ${tenure.session}`);
    } else {
        info("Already holds the position this tenure");
    }

    const password_hash = await hashPassword(password);
    const { data: login } = await db.from("profile_login").select("id").eq("profile_id", profile.id).maybeSingle();
    if (login) {
        const { error } = await db
            .from("profile_login")
            .update({ password_hash, is_active: true, failed_attempts: 0, locked_until: null })
            .eq("id", login.id);
        if (error) throw error;
        ok("Password reset");
    } else {
        const { error } = await db
            .from("profile_login")
            .insert({ profile_id: profile.id, password_hash, is_active: true, granted_by: profile.id });
        if (error) throw error;
        ok("Login provisioned");
    }

    return { email, password };
}

async function main() {
    const wantSeed = hasFlag("seed");

    heading(
        "ICT Coordinator",
        wantSeed ? c.yellow("--seed — staging only") : "checking that a System Admin exists",
    );

    // refuseProduction hides production entirely when seeding. The check is read-only
    // and is offered every environment, including production.
    const env = await chooseEnvironment({
        purpose: wantSeed ? "seed" : "check",
        refuseProduction: wantSeed,
        envFlag: flagValue("env"),
    });

    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    if (wantSeed) {
        section("Seeding the default coordinator");
        kv([
            ["Name", `${DEFAULT_COORD.firstName} ${DEFAULT_COORD.lastName}`],
            ["Email", DEFAULT_COORD.email],
            ["Domain", c.grey("@rcffuta.test — RFC 2606 reserved, can never receive mail")],
        ]);
        blank();

        const password = flagValue("password") ?? randomBytes(9).toString("base64url");
        const result = await seed(db, password);

        blank();
        section("Sign in with");
        kv([["Email", c.bold(result.email)], ["Password", c.bold(result.password)]]);
        if (!flagValue("password")) {
            info(c.grey("Randomly generated — copy it now, it is not stored anywhere in readable form."));
        }
        blank();
    }

    section("Status");
    const healthy = report(await inspect(db));
    blank();

    if (healthy) {
        ok(`System Admin is in place on ${c.bold(env.ref ?? env.file)}.`);
        return;
    }

    fail("There is no working System Admin on this project.");
    blank();
    info("Settings, the Oracle and full-system backup are unreachable until this passes.");
    if (env.isProduction) {
        info("On production this must be a real person:");
        info(c.grey("  appoint them in the portal (Tenure -> Cabinet), or, if nobody can sign in at all,"));
        info(c.grey("  node scripts/bootstrap-admin.mjs <email> <password>   # mints a VP Admin who can"));
    } else {
        info(c.grey("  node scripts/ict-coord.mjs --seed --env " + (env.file.replace(/^\.env\.?/, "") || "local")));
    }
    process.exitCode = 1;
}

// PostgREST errors arrive as objects, and `die` on a bare object prints
// "[object Object]" -- which is what a `leadership_one_lead_per_position` collision
// looked like from the outside. Unwrap to the message before handing it over.
main().catch((e) => die(e?.message ? e : new Error(
    typeof e === "object" ? JSON.stringify(e) : String(e),
)));
