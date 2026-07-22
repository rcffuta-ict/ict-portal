/**
 * Registration / credential invite links. Server-only.
 *
 * These back three flows (see `registration_invites.purpose`):
 *   - 'create' / 'update' : level-coordinator links to add/edit a member in their
 *                           generation (class_set).
 *   - 'reset'             : VP-Admin / ICT-Coordinator links for a leader to (re)set
 *                           their own password (the "forgot password" path).
 *
 * Authorization (who may create which kind of invite) is enforced in the server
 * actions that call `createInvite` — this module is the mechanism, not the policy.
 */
import { randomBytes } from "crypto";
import { ictAdmin } from "@/lib/ict";

export type InvitePurpose = "create" | "update" | "reset" | "level";

/** What was done with a token (see `invite_events`). */
export type InviteAction = "generated" | "revoked" | "register" | "update";

export interface InviteInput {
    createdBy: string;
    purpose: InvitePurpose;
    classSetId?: string | null;
    targetProfileId?: string | null;
    expiresAt?: string | null;
    maxUses?: number | null;
    label?: string | null;
}

export interface ValidatedInvite {
    id: string;
    token: string;
    purpose: InvitePurpose;
    classSetId: string | null;
    targetProfileId: string | null;
    classSet?: { id: string; entryYear: number | null; familyName: string | null; isFoundation: boolean } | null;
    targetProfile?: { id: string; firstName: string; lastName: string; email: string | null } | null;
}

/** Cryptographically-random, URL-safe token. */
function generateToken(): string {
    return randomBytes(24).toString("base64url");
}

/**
 * Create an invite and return its token. Reuses an existing active invite of the
 * same (purpose, class_set/target) where sensible so coordinators get a stable link.
 */
export async function createInvite(input: InviteInput): Promise<{ token: string; id: string }> {
    const token = generateToken();
    const { data, error } = await ictAdmin.supabase
        .from("registration_invites")
        .insert({
            token,
            purpose: input.purpose,
            class_set_id: input.classSetId ?? null,
            target_profile_id: input.targetProfileId ?? null,
            created_by: input.createdBy,
            expires_at: input.expiresAt ?? null,
            max_uses: input.maxUses ?? null,
            label: input.label ?? null,
        })
        .select("id, token")
        .single();

    if (error || !data) throw new Error(`Failed to create invite: ${error?.message}`);
    return { token: data.token as string, id: data.id as string };
}

/**
 * Validate a token and return the resolved invite (with class_set / target profile),
 * or a reason it's invalid. Read-only.
 */
export async function getInviteByToken(
    token: string,
): Promise<{ valid: boolean; reason?: string; invite?: ValidatedInvite }> {
    if (!token) return { valid: false, reason: "Missing invite token." };

    const { data, error } = await ictAdmin.supabase
        .from("registration_invites")
        .select(`
            id, token, purpose, class_set_id, target_profile_id, is_active,
            expires_at, use_count, max_uses, revoked_at,
            class_set:class_sets(id, entry_year, family_name, is_foundation),
            target:profiles!registration_invites_target_profile_id_fkey(id, first_name, last_name, email)
        `)
        .eq("token", token)
        .maybeSingle();

    if (error || !data) return { valid: false, reason: "This link is invalid." };
    if (!data.is_active || data.revoked_at) return { valid: false, reason: "This link has been revoked." };
    if (data.expires_at && new Date(data.expires_at as string).getTime() < Date.now()) {
        return { valid: false, reason: "This link has expired." };
    }
    if (data.max_uses != null && (data.use_count as number) >= (data.max_uses as number)) {
        return { valid: false, reason: "This link has already been used." };
    }

    const cs = Array.isArray(data.class_set) ? data.class_set[0] : data.class_set;
    const tp = Array.isArray(data.target) ? data.target[0] : data.target;

    return {
        valid: true,
        invite: {
            id: data.id as string,
            token: data.token as string,
            purpose: data.purpose as InvitePurpose,
            classSetId: (data.class_set_id as string) ?? null,
            targetProfileId: (data.target_profile_id as string) ?? null,
            classSet: cs
                ? { id: cs.id, entryYear: cs.entry_year, familyName: cs.family_name, isFoundation: !!cs.is_foundation }
                : null,
            targetProfile: tp
                ? { id: tp.id, firstName: tp.first_name, lastName: tp.last_name, email: tp.email }
                : null,
        },
    };
}

/** Record a use of an invite (increments use_count). */
export async function consumeInvite(inviteId: string): Promise<void> {
    // Atomic increment via RPC-less update: read-modify-write is acceptable here
    // because invites are low-contention; max_uses is also enforced at read time.
    const { data } = await ictAdmin.supabase
        .from("registration_invites")
        .select("use_count")
        .eq("id", inviteId)
        .maybeSingle();
    const next = ((data?.use_count as number) ?? 0) + 1;
    await ictAdmin.supabase
        .from("registration_invites")
        .update({ use_count: next })
        .eq("id", inviteId);
}

/** Revoke an invite (idempotent). */
export async function revokeInvite(inviteId: string): Promise<void> {
    const { error } = await ictAdmin.supabase
        .from("registration_invites")
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq("id", inviteId);
    if (error) throw new Error(`Failed to revoke invite: ${error.message}`);
}

/**
 * Append one entry to a token's activity log. Name/email are SNAPSHOTS — the log has to
 * stay readable after a profile is edited or deleted. Never throws: an audit write must
 * not be able to fail the user-facing operation it describes (it is logged instead).
 */
export async function logInviteEvent(input: {
    inviteId: string;
    action: InviteAction;
    profileId?: string | null;
    actorName?: string | null;
    actorEmail?: string | null;
}): Promise<void> {
    const { error } = await ictAdmin.supabase.from("invite_events").insert({
        invite_id: input.inviteId,
        action: input.action,
        profile_id: input.profileId ?? null,
        actor_name: input.actorName ?? null,
        actor_email: input.actorEmail ?? null,
    });
    if (error) console.error("logInviteEvent failed:", error.message);
}

/** A generation's token activity, newest first (the Activity tab). */
export async function listInviteEventsByClassSet(classSetId: string, limit = 200) {
    const { data } = await ictAdmin.supabase
        .from("invite_events")
        .select(`
            id, action, actor_name, actor_email, created_at, profile_id,
            invite:registration_invites!inner(id, token, label, class_set_id)
        `)
        .eq("invite.class_set_id", classSetId)
        .order("created_at", { ascending: false })
        .limit(limit);
    return data ?? [];
}

/**
 * List every invite attached to a generation, whoever created it. Level links belong to
 * the LEVEL, not to the person who happened to click "generate" — so a hand-over of the
 * coordinator role doesn't orphan links the new coordinator can neither see nor revoke.
 * Callers must have already checked `canManageLevel` for this class_set.
 */
export async function listInvitesByClassSet(classSetId: string) {
    const { data } = await ictAdmin.supabase
        .from("registration_invites")
        .select("id, token, label, purpose, class_set_id, target_profile_id, is_active, use_count, max_uses, expires_at, created_at, created_by, revoked_at")
        .eq("class_set_id", classSetId)
        .order("created_at", { ascending: false });
    return data ?? [];
}

/** List a creator's active invites (for the coordinator/admin dashboards). */
export async function listInvitesByCreator(createdBy: string) {
    const { data } = await ictAdmin.supabase
        .from("registration_invites")
        .select("id, token, purpose, class_set_id, target_profile_id, is_active, use_count, max_uses, expires_at, created_at, revoked_at")
        .eq("created_by", createdBy)
        .order("created_at", { ascending: false });
    return data ?? [];
}
