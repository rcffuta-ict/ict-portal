/**
 * Provisioning of leader logins (`profile_login`). Server-only.
 *
 * Appointing someone to an office that GRANTS ACCESS creates a `profile_login` row so
 * the person *can* sign in — with no password, which they set on first login; we never
 * invent one on their behalf.
 *
 * "That grants access" is the part worth reading twice. Most of the fellowship's
 * offices are in the catalogue as a record of service, not as a reason to sign in, and
 * `leadership_positions.grants_login` is what separates the two. So the invariant this
 * file maintains is not "who may log in == who has been appointed" but "who may log in
 * == who holds an office that needs the portal", which is the VP Admin's decision,
 * per office, on the cabinet screen.
 */
import { db } from "@/lib/db";
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
    const { data: existing } = await db
        .from("profile_login")
        .select("id")
        .eq("profile_id", profileId)
        .maybeSingle();

    if (existing) return { created: false };

    const { error } = await db.from("profile_login").insert({
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
    const { error } = await db
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

    const { data: existing } = await db
        .from("profile_login")
        .select("id")
        .eq("profile_id", profileId)
        .maybeSingle();

    if (existing) {
        const { error } = await db
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
        const { error } = await db.from("profile_login").insert({
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
    const { error } = await db
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
 * The test is "holds no ACCESS-GRANTING position in the active tenure", not "lost a
 * position": someone who leads two units and steps down from one still needs to sign in.
 * When they hold nothing that grants access, every session is revoked first (so an open tab dies immediately rather than
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
    const { data: tenure } = await db
        .from("tenures")
        .select("id")
        .eq("is_active", true)
        .maybeSingle();

    // With no active tenure there is nothing to measure "still appointed" against.
    // Leave access alone rather than locking everyone out on a half-finished handover.
    if (!tenure?.id) return { removed: false, reason: "no active tenure" };

    // "Still appointed" means "still holds an office that GRANTS ACCESS" — not merely
    // "still holds an office". Most of the fellowship's offices are on record without
    // carrying a login (see leadership_positions.grants_login), so someone who steps
    // down as Choir Coordinator and stays on as Transport Secretary has genuinely lost
    // their reason to sign in, and keeping the account open would be the drift this
    // function exists to prevent.
    const { data: stillHeld } = await db
        .from("leadership")
        .select("id, position:leadership_positions!inner(grants_login)")
        .eq("profile_id", profileId)
        .eq("tenure_id", tenure.id)
        // An ENDED appointment is service history, not an office still held. Without
        // this the first removal would keep someone signed in forever: the row stays,
        // so "still holds a position that grants access" would always be true.
        .is("ended_at", null)
        .eq("position.grants_login", true)
        .limit(1);

    if (stillHeld && stillHeld.length > 0) {
        return { removed: false, reason: "still holds a position that grants access" };
    }

    await revokeAllSessions(profileId, "leadership_removed");

    const { error } = await db
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
    const { data, error } = await db
        .from("auth_sessions")
        .update({ revoked_at: new Date().toISOString(), revoked_reason: reason })
        .eq("profile_id", profileId)
        .is("revoked_at", null)
        .select("id");
    if (error) throw new Error(`Failed to revoke sessions: ${error.message}`);
    return data?.length ?? 0;
}

/**
 * Apply an office's access setting to everyone currently holding it.
 *
 * Toggling `grants_login` has to be retroactive to mean anything: a VP Admin who
 * switches an office off expects its holders to stop being able to sign in, not for
 * the change to apply only to the next person appointed. So this runs over the active
 * tenure's holders and provisions or de-provisions each one.
 *
 * De-provisioning still goes through {@link deprovisionLoginIfUnappointed}, so a
 * holder who also leads a unit keeps their access — losing one office is not losing
 * every reason to sign in.
 *
 * @returns how many logins were created and removed. Reported rather than silent: on
 *          the cabinet screen "3 leaders lost portal access" is the consequence the
 *          VP Admin most needs to see.
 */
export async function applyPositionLoginPolicy(
    positionId: string,
    grantsLogin: boolean,
    actorId: string,
): Promise<{ provisioned: number; revoked: number }> {
    const { data: tenure } = await db
        .from("tenures")
        .select("id")
        .eq("is_active", true)
        .maybeSingle();

    if (!tenure?.id) return { provisioned: 0, revoked: 0 };

    const { data: holders } = await db
        .from("leadership")
        .select("profile_id")
        .eq("position_id", positionId)
        .eq("tenure_id", tenure.id)
        // Only CURRENT holders. Toggling grants_login must not mint a login for
        // somebody who left the office last term.
        .is("ended_at", null);

    let provisioned = 0;
    let revoked = 0;

    for (const { profile_id } of holders ?? []) {
        if (grantsLogin) {
            const { created } = await ensureLoginProvisioned(profile_id, actorId);
            if (created) provisioned += 1;
        } else {
            const { removed } = await deprovisionLoginIfUnappointed(profile_id);
            if (removed) revoked += 1;
        }
    }

    return { provisioned, revoked };
}
