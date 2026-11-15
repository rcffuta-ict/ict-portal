/**
 * WHO MAY MODERATE LO! — the one place it is decided.
 *
 * Two kinds of people moderate Lo! (testimonies and the Q&A):
 *
 *   - The portal's admin write tier — the System Admin and the VP Admin, the same rule
 *     as `checkEnhancedAdminWriteAccess`. The President reads everything but writes
 *     nothing, here as everywhere.
 *   - Lo! admins — leaders the System Admin appointed in Settings (`lo_admins`). A
 *     grant only counts while ALL of these hold:
 *       1. it is for the ACTIVE tenure (so it lapses by itself at handover),
 *       2. it has not been revoked,
 *       3. its holder still holds an office in that tenure, and
 *       4. its holder still has an active portal login.
 *     It gives nothing outside Lo!: no ADMIN/MODERATOR role, no dashboard module.
 *
 * Lo! member recognition (`src/lib/lo-member.ts`) is never accepted here — a
 * recognition link is not a session. Server-only: reads the session and the
 * service-role client.
 */
import { db } from "@/lib/db";
import { getCurrentContext } from "@/lib/access-control";
import { getSessionProfileId } from "@/lib/auth/session";
import type { ProfileContext } from "@/lib/auth/profile-context";

export interface LoAccess {
    /** May see the moderation queue and every testimony's status. */
    canRead: boolean;
    /** May approve, edit, feature, hide; answer and hide questions. */
    canModerate: boolean;
    /** The signed-in profile, or null for a visitor. */
    profileId: string | null;
    /** True when access comes from a Lo! admin grant rather than a portal admin role. */
    viaLoAdmin: boolean;
}

const NONE: LoAccess = { canRead: false, canModerate: false, profileId: null, viaLoAdmin: false };

/** Is this profile a Lo! admin right now? Checks all four conditions above. */
export async function isActiveLoAdmin(ctx: ProfileContext): Promise<boolean> {
    // ctx.leadership is already limited to the active tenure by rcf_profile_context.
    const tenureId = ctx.leadership[0]?.tenureId;
    if (!tenureId) return false;

    const [grant, login] = await Promise.all([
        db
            .from("lo_admins")
            .select("id")
            .eq("profile_id", ctx.profile.id)
            .eq("tenure_id", tenureId)
            .is("revoked_at", null)
            .maybeSingle(),
        db
            .from("profile_login")
            .select("id")
            .eq("profile_id", ctx.profile.id)
            .eq("is_active", true)
            .maybeSingle(),
    ]);

    if (grant.error) console.error("lo_admins lookup failed:", grant.error.message);
    return !!grant.data && !!login.data;
}

/** The current request's Lo! access. Never throws; a visitor gets no access. */
export async function getLoAccess(): Promise<LoAccess> {
    try {
        // Most Lo! readers are visitors with no session. Answer them from the cookie
        // alone, before getCurrentContext's handover check and profile RPC — the
        // public feed shouldn't pay two database calls per load to learn "nobody".
        if (!(await getSessionProfileId())) return NONE;

        const ctx = await getCurrentContext();
        if (!ctx) return NONE;

        const portalWriter = (ctx.isSysAdmin || ctx.isVpAdmin) && !ctx.isPresident;
        if (portalWriter) {
            return { canRead: true, canModerate: true, profileId: ctx.profile.id, viaLoAdmin: false };
        }

        if (await isActiveLoAdmin(ctx)) {
            return { canRead: true, canModerate: true, profileId: ctx.profile.id, viaLoAdmin: true };
        }

        // The President (and the rest of the admin read tier) sees, but cannot act.
        return { canRead: ctx.isAdmin, canModerate: false, profileId: ctx.profile.id, viaLoAdmin: false };
    } catch (error) {
        console.error("getLoAccess failed:", error);
        return NONE;
    }
}
