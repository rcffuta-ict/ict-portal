/**
 * Sign in as a System Admin from the terminal.
 *
 * Shared by scripts/backup.mjs and scripts/audit.mjs. The script already holds the
 * service-role key, so this is ACCOUNTABILITY, not access control: it stamps a real
 * person on what the script does, honours the same account state the portal does
 * (deactivated logins, lockouts, failed-attempt counters), and refuses anyone without
 * the SYSADMIN privilege in the active tenure. See the note at the top of backup.mjs.
 */
import { ask, askSecret } from "./cli.mjs";

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
export async function authenticate(db, verifyPassword, recordAttempt) {
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
export async function requireSysAdmin(db, profile, purpose = "a system-wide backup") {
    const { data: tenure } = await db
        .from("tenures")
        .select("id, session")
        .eq("is_active", true)
        .maybeSingle();
    if (!tenure) throw new Error(`No active tenure, so no leadership is in force. Cannot authorise ${purpose}.`);

    const { data: roles } = await db
        .from("leadership")
        .select("position_id, leadership_positions(slug, title, is_active)")
        .eq("profile_id", profile.id)
        .eq("tenure_id", tenure.id)
        // An ENDED appointment is service history, not an office held. Without this,
        // someone removed as ICT Coordinator could still pass as System Admin here.
        .is("ended_at", null);

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
            `${purpose[0].toUpperCase()}${purpose.slice(1)} needs the SYSADMIN privilege.\n` +
            `  ${profile.first_name} ${profile.last_name} holds: ${held}.\n` +
            `  That is the ICT Coordinator's tag — check with: pnpm db:ict-coord`,
        );
    }

    const position = active.find((r) => r.position_id === sysadmin.position_id);
    return { tenure, positionTitle: position?.leadership_positions?.title ?? "System Admin" };
}

