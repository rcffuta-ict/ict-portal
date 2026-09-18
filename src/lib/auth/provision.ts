/**
 * Provisioning of leader logins (`profile_login`). Server-only.
 *
 * When a VP Admin appoints a member to a leadership position, we auto-create a
 * `profile_login` row so the person *can* log in — but with an unusable placeholder
 * hash until they set a real password through an admin-issued 'reset' invite. This
 * keeps "who may log in" == "who has been appointed", while never inventing a
 * password on the member's behalf.
 */
import { ictAdmin } from "@/lib/ict";
import { hashPassword } from "@/lib/auth/password";

/**
 * Ensure a `profile_login` row exists for a profile (idempotent).
 * Called when appointing a leader — the row is created with NO password
 * (`password_hash = null`), which the leader sets on their first login.
 * Does NOT overwrite an existing password.
 * @returns whether a new row was created.
 */
export async function ensureLoginProvisioned(
    profileId: string,
    grantedBy: string,
): Promise<{ created: boolean }> {
    const { data: existing } = await ictAdmin.supabase
        .from("profile_login")
        .select("id")
        .eq("profile_id", profileId)
        .maybeSingle();

    if (existing) return { created: false };

    const { error } = await ictAdmin.supabase.from("profile_login").insert({
        profile_id: profileId,
        password_hash: null, // set by the leader on first login
        is_active: true,
        granted_by: grantedBy,
    });
    if (error) throw new Error(`Failed to provision login: ${error.message}`);
    return { created: true };
}

/**
 * Reset a leader's login: clear the password so they set a new one on next login,
 * re-activate, and clear any lockout. This is the "forgot password" path, done by
 * a VP Admin / ICT Coordinator.
 */
export async function resetLoginPassword(profileId: string): Promise<void> {
    const { error } = await ictAdmin.supabase
        .from("profile_login")
        .update({
            password_hash: null,
            is_active: true,
            failed_attempts: 0,
            locked_until: null,
            updated_at: new Date().toISOString(),
        })
        .eq("profile_id", profileId);
    if (error) throw new Error(`Failed to reset login: ${error.message}`);
}

/**
 * Set (or reset) a leader's password. Creates the login row if missing, resets
 * lockout counters, and activates it.
 */
export async function setLoginPassword(
    profileId: string,
    newPassword: string,
    grantedBy?: string,
): Promise<void> {
    const password_hash = await hashPassword(newPassword);

    const { data: existing } = await ictAdmin.supabase
        .from("profile_login")
        .select("id")
        .eq("profile_id", profileId)
        .maybeSingle();

    if (existing) {
        const { error } = await ictAdmin.supabase
            .from("profile_login")
            .update({
                password_hash,
                is_active: true,
                failed_attempts: 0,
                locked_until: null,
                updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        if (error) throw new Error(`Failed to set password: ${error.message}`);
    } else {
        const { error } = await ictAdmin.supabase.from("profile_login").insert({
            profile_id: profileId,
            password_hash,
            is_active: true,
            granted_by: grantedBy ?? profileId,
        });
        if (error) throw new Error(`Failed to set password: ${error.message}`);
    }
}

/** Enable/disable a leader's login without deleting the audit history. */
export async function setLoginActive(profileId: string, isActive: boolean): Promise<void> {
    const { error } = await ictAdmin.supabase
        .from("profile_login")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("profile_id", profileId);
    if (error) throw new Error(`Failed to update login status: ${error.message}`);
}

/**
 * Revoke portal access when someone is no longer a leader.
 *
 * Appointment IS the grant of access (see {@link ensureLoginProvisioned}), so removal
 * has to be the revocation — otherwise "who may log in" drifts away from "who has been
 * appointed" one departure at a time, and last tenure's cabinet keeps its keys.
 *
 * The test is "holds NO position in the active tenure", not "lost a position": someone
 * who leads two units and steps down from one still needs to sign in. When they do hold
 * nothing, every session is revoked first (so an open tab dies immediately rather than
 * lasting until its cookie expires) and the `profile_login` row is deleted.
 *
 * `login_events` is untouched — it references `profiles`, not `profile_login`, so the
 * authentication audit trail survives the person losing access. That record is the one
 * you would want if an account were ever misused, and it should not be erasable by an
 * ordinary personnel change.
 *
 * @returns whether a login row was actually removed.
 */
export async function deprovisionLoginIfUnappointed(
    profileId: string,
): Promise<{ removed: boolean; reason?: string }> {
    const { data: tenure } = await ictAdmin.supabase
        .from("tenures")
        .select("id")
        .eq("is_active", true)
        .maybeSingle();

    // With no active tenure there is nothing to measure "still appointed" against.
    // Leave access alone rather than locking everyone out on a half-finished handover.
    if (!tenure?.id) return { removed: false, reason: "no active tenure" };

    const { data: stillHeld } = await ictAdmin.supabase
        .from("leadership")
        .select("id")
        .eq("profile_id", profileId)
        .eq("tenure_id", tenure.id)
        .limit(1);

    if (stillHeld && stillHeld.length > 0) {
        return { removed: false, reason: "still holds a position" };
    }

    await revokeAllSessions(profileId, "leadership_removed");

    const { error } = await ictAdmin.supabase
        .from("profile_login")
        .delete()
        .eq("profile_id", profileId);
    if (error) throw new Error(`Failed to remove login: ${error.message}`);

    return { removed: true };
}

/**
 * Revoke every live session for a profile.
 *
 * Setting `revoked_at` (rather than deleting the rows) is what the audit trigger from
 * migration 0001 watches — it turns each revocation into a `session_revoked` event.
 */
export async function revokeAllSessions(
    profileId: string,
    reason: string,
): Promise<number> {
    const { data, error } = await ictAdmin.supabase
        .from("auth_sessions")
        .update({ revoked_at: new Date().toISOString(), revoked_reason: reason })
        .eq("profile_id", profileId)
        .is("revoked_at", null)
        .select("id");
    if (error) throw new Error(`Failed to revoke sessions: ${error.message}`);
    return data?.length ?? 0;
}
