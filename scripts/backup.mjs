/**
 * Take a full system backup from the terminal, as an authenticated System Admin.
 *
 * WHAT "AUTHENTICATED" MEANS HERE, AND WHAT IT DOES NOT
 *   This script already holds the service-role key — that is how it reaches the
 *   database at all — so the sign-in below is NOT a security boundary in the sense of
 *   making exfiltration impossible. Anyone with .env.local can write their own script.
 *
 *   What it does buy, and why it is worth having:
 *     * The bundle is STAMPED with a real person. `takenBy` ends up in the manifest and
 *       in admin_audit_log, so a year later the file answers "who took this, and when".
 *     * It honours the same account state the portal does — deactivated logins, lockout
 *       windows, failed-attempt counters — so a revoked leader's credentials do not
 *       quietly keep working from a terminal.
 *     * It refuses anyone without the SYSADMIN tag, which makes "I ran the backup
 *       script" a deliberate, attributable act rather than an ambient capability of
 *       whoever happens to have the env file.
 *
 *   Treat the service-role key as the real boundary. This is accountability, not
 *   access control, and it is documented that way so nobody mistakes it for the latter.
 *
 * WHY IT IMPORTS THE PORTAL'S OWN TYPESCRIPT
 *   It calls the same `buildBackup()` the download button calls, through a small path
 *   alias hook (scripts/lib/alias-hook.mjs) and Node's native type stripping. A
 *   reimplementation in .mjs would drift from the real one — different table list,
 *   different redactions, a bundle restore-backup.mjs cannot read — and the drift would
 *   only show up the day someone needed the backup.
 *
 * Usage:
 *   node scripts/backup.mjs                      # JSON bundle into .backups/
 *   node scripts/backup.mjs --encrypt            # .rcfvault, AES-256-GCM
 *   node scripts/backup.mjs --env production
 *   node scripts/backup.mjs --out /path/to/dir
 *
 * Run it BEFORE any migration that drops or rewrites data. The Free plan has no
 * automatic backups and no point-in-time recovery; this file is the only undo.
 */
import { register } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

register("./lib/alias-hook.mjs", import.meta.url);

const {
    ROOT, c, heading, section, table, kv, ok, warn, info, step, blank,
    ask, askSecret, chooseEnvironment, flagValue, hasFlag, die,
} = await import("./lib/cli.mjs");

/** Mirrors the portal's login policy exactly — see src/app/(auth)/login/actions.ts. */
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const INVALID = "Email or password is incorrect.";

/**
 * Verify a portal login, applying the same rules the web login applies.
 *
 * Deliberately returns the same message for "no such account", "wrong password" and
 * "login deactivated": distinguishing them turns this into an oracle for which
 * addresses are leaders.
 */
async function authenticate(db, verifyPassword, recordAttempt) {
    const email = (await ask("Email")).trim().toLowerCase();
    const password = await askSecret("Password");

    if (!email || !password) throw new Error("Email and password are required.");

    const { data: profile } = await db
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("email", email)
        .maybeSingle();

    const { data: login } = profile
        ? await db
            .from("profile_login")
            .select("id, password_hash, is_active, failed_attempts, locked_until")
            .eq("profile_id", profile.id)
            .maybeSingle()
        : { data: null };

    if (!profile || !login || !login.is_active || login.password_hash == null) {
        await recordAttempt("login_fail", { email, profileId: profile?.id });
        throw new Error(INVALID);
    }

    if (login.locked_until && new Date(login.locked_until).getTime() > Date.now()) {
        const mins = Math.ceil((new Date(login.locked_until).getTime() - Date.now()) / 60000);
        throw new Error(`Account is locked for another ${mins} minute(s) after repeated failures.`);
    }

    if (!(await verifyPassword(password, login.password_hash))) {
        const attempts = (login.failed_attempts || 0) + 1;
        const lockedUntil = attempts >= MAX_FAILED_ATTEMPTS
            ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
            : null;
        await db
            .from("profile_login")
            .update({ failed_attempts: attempts, locked_until: lockedUntil })
            .eq("id", login.id);
        await recordAttempt("login_fail", { email, profileId: profile.id });

        throw new Error(
            lockedUntil
                ? `${INVALID} Account now locked for ${LOCK_MINUTES} minutes.`
                : `${INVALID} ${MAX_FAILED_ATTEMPTS - attempts} attempt(s) before lockout.`,
        );
    }

    await db.from("profile_login").update({ failed_attempts: 0, locked_until: null }).eq("id", login.id);
    await recordAttempt("login_success", { email, profileId: profile.id });

    return { ...profile, loginId: login.id };
}

/**
 * Does this person hold SYSADMIN in the ACTIVE tenure?
 *
 * Tenure-scoped on purpose: last session's coordinator is not this session's System
 * Admin, and the portal's own authorization reads privileges the same way.
 */
async function requireSysAdmin(db, profile) {
    const { data: tenure } = await db
        .from("tenures")
        .select("id, session")
        .eq("is_active", true)
        .maybeSingle();
    if (!tenure) throw new Error("No active tenure, so no leadership is in force. Cannot authorise a backup.");

    const { data: roles } = await db
        .from("leadership")
        .select("position_id, leadership_positions(slug, title, is_active)")
        .eq("profile_id", profile.id)
        .eq("tenure_id", tenure.id);

    const active = (roles ?? []).filter((r) => r.leadership_positions?.is_active);
    if (!active.length) throw new Error(`${profile.first_name} holds no active position in ${tenure.session}.`);

    const { data: privileges } = await db
        .from("position_privileges")
        .select("privilege, scope, position_id")
        .in("position_id", active.map((r) => r.position_id));

    const sysadmin = (privileges ?? []).find((p) => p.privilege === "SYSADMIN");
    if (!sysadmin) {
        const held = active.map((r) => r.leadership_positions.title).join(", ");
        throw new Error(
            `A system-wide backup needs the SYSADMIN privilege.\n` +
            `  ${profile.first_name} ${profile.last_name} holds: ${held}.\n` +
            `  That is the ICT Coordinator's tag — check with: pnpm db:ict-coord`,
        );
    }

    const position = active.find((r) => r.position_id === sysadmin.position_id);
    return { tenure, positionTitle: position?.leadership_positions?.title ?? "System Admin" };
}

async function main() {
    const encrypt = hasFlag("encrypt");

    heading("System backup", "full system insurance — every tenure, all history");

    const env = await chooseEnvironment({ purpose: "back up", envFlag: flagValue("env") });

    // Imported only AFTER the environment is loaded: @/lib/db reads SUPABASE_URL and
    // SUPABASE_SERVICE_ROLE_KEY at module load and throws when they are absent.
    const { db } = await import("@/lib/db");
    const { verifyPassword } = await import("@/lib/auth/password");
    const { buildBackup, backupFilename } = await import("@/lib/backup");
    const { encryptBackup } = await import("@/lib/backup-crypto");

    const recordAttempt = async (event, ctx) => {
        // Best-effort: a backup must not fail because the audit insert did.
        try {
            await db.from("login_events").insert({
                profile_id: ctx.profileId ?? null,
                email: ctx.email ?? null,
                event,
                ip: null,
                user_agent: "cli:scripts/backup.mjs",
            });
        } catch { /* ignore */ }
    };

    section("Sign in");
    info("The service-role key gets this script to the database; signing in is what puts");
    info("your name on the bundle and in the audit log.");
    blank();

    const profile = await authenticate(db, verifyPassword, recordAttempt);
    const { tenure, positionTitle } = await requireSysAdmin(db, profile);

    const name = `${profile.first_name} ${profile.last_name}`.trim();
    blank();
    ok(`${c.bold(name)} — ${positionTitle}, ${tenure.session}`);

    section("Building the bundle");
    kv([
        ["Project", env.ref ?? env.file],
        ["Scope", "system — no tenure filter, every tenure and all history"],
        ["Encrypted", encrypt ? c.green("yes — AES-256-GCM") : c.yellow("no — plain JSON")],
    ]);
    blank();
    step("Reading tables…");

    const backup = await buildBackup({
        takenBy: { id: profile.id, name },
        scope: "system",
    });

    const counts = Object.entries(backup.manifest.counts ?? {});
    const total = counts.reduce((sum, [, n]) => sum + n, 0);

    blank();
    table(
        counts.filter(([, n]) => n > 0).map(([t, n]) => ({ table: t, rows: String(n) })),
        [{ key: "table", label: "TABLE" }, { key: "rows", label: "ROWS" }],
    );

    if (backup.manifest.skipped?.length) {
        blank();
        warn(`${backup.manifest.skipped.length} table(s) could not be read and were recorded as skipped:`);
        for (const s of backup.manifest.skipped) info(c.grey(`  ${s.table}: ${s.reason}`));
    }

    section("Writing");
    const dir = flagValue("out") ?? join(ROOT, ".backups");
    mkdirSync(dir, { recursive: true });

    let filename = backupFilename(backup.manifest, false);
    let payload = JSON.stringify(backup, null, 2);

    if (encrypt) {
        const passphrase = await askSecret("Passphrase for the vault");
        const again = await askSecret("Confirm passphrase");
        if (passphrase !== again) throw new Error("Passphrases did not match. Nothing was written.");
        if (passphrase.length < 8) throw new Error("Use at least 8 characters.");

        payload = await encryptBackup(payload, passphrase, {
            payload: "json",
            tenure: backup.manifest.tenure,
            label: backup.manifest.label,
            takenAt: backup.manifest.takenAt,
        });
        backup.manifest.encrypted = true;
        filename = backupFilename(backup.manifest, true);
    }

    const path = join(dir, filename);
    writeFileSync(path, payload);

    // The audit trail the sign-in exists for.
    try {
        await db.from("admin_audit_log").insert({
            actor_profile_id: profile.id,
            actor_name: name,
            action: "system_backup.cli",
            field: "scope",
            new_value: `system; ${total} rows; ${filename}`,
        });
    } catch (e) {
        warn(`Backup written, but the audit log entry failed: ${e.message}`);
    }

    blank();
    ok(`${c.bold(path)}`);
    kv([
        ["Rows", String(total)],
        ["Size", `${(Buffer.byteLength(payload) / 1024 / 1024).toFixed(2)} MB`],
        ["Taken by", name],
    ]);

    blank();
    info("Not in this file, by design:");
    for (const r of backup.manifest.redactions ?? []) info(c.grey(`  - ${r}`));
    blank();
    info(`Restore with: ${c.grey("node scripts/restore-backup.mjs " + path)}`);
    if (!encrypt) {
        blank();
        warn("This is plain JSON — every member's name, email and phone number in one file.");
        info(c.grey("  Use --encrypt if it is going anywhere other than this machine."));
    }
}

main().catch(die);
