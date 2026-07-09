/**
 * Access control for protected server actions.
 *
 * Admin/moderator status is derived from the user's LEADERSHIP POSITIONS
 * (see src/lib/auth-roles.ts), resolved from the DB-backed session. The old
 * ADMIN_EMAILS whitelist is gone.
 */

'use server'

import { type AuthUser, createAuthUser } from "@/lib/auth-roles";
import { getSessionProfileId } from "@/lib/auth/session";
import { getProfileContext, type ProfileContext } from "@/lib/auth/profile-context";
import { canReadModule, getModuleAccessConfig, type ModuleId } from "@/lib/module-access";

/**
 * Resolve the current session's enriched profile context (single RPC), or null.
 * Prefer this in server actions that need scope data (managed units/levels).
 */
export async function getCurrentContext(): Promise<ProfileContext | null> {
    const profileId = await getSessionProfileId();
    if (!profileId) return null;
    return getProfileContext(profileId);
}

/** Like getCurrentContext but throws when unauthenticated. */
export async function requireContext(): Promise<ProfileContext> {
    const ctx = await getCurrentContext();
    if (!ctx) throw new Error("Authentication required");
    return ctx;
}

/**
 * Require the current session to have READ access to a Tool module per the
 * `module_access` config (admins always pass). Returns the enriched context.
 * @throws when unauthenticated or not permitted.
 */
export async function requireModuleRead(module: ModuleId): Promise<ProfileContext> {
    const ctx = await requireContext();
    const config = await getModuleAccessConfig();
    if (!canReadModule(ctx, module, config)) {
        throw new Error("Access denied: insufficient module access");
    }
    return ctx;
}

/**
 * Require the current session to hold the ICT Coordinator position (by stable slug
 * `ict-coord`). Gates the app-config Settings module — the ICT Coordinator manages
 * who can read/write each module, so this is intentionally narrower than ADMIN
 * (VP Admin is an admin but is NOT the ICT Coordinator).
 * @throws when unauthenticated or not the ICT Coordinator.
 */
export async function requireIctCoord(): Promise<ProfileContext> {
    const ctx = await requireContext();
    const isIct = (ctx.leadership ?? []).some((l) => l.slug === "ict-coord");
    if (!isIct) {
        throw new Error("Access denied: ICT Coordinator only");
    }
    return ctx;
}

// NOTE: this module is `'use server'`, so these scope checks are async (all exports
// of a server-action module must be async). They are pure over the passed context.

/** True if the context holds a LEVEL position for the given generation. */
export async function canManageLevel(ctx: ProfileContext, classSetId: string): Promise<boolean> {
    if (ctx.isAdmin) return true;
    return ctx.leadership.some((l) => l.category === "LEVEL" && l.classSetId === classSetId);
}

/** True if the context holds a leadership role over the given unit/team. */
export async function canManageUnit(ctx: ProfileContext, unitId: string): Promise<boolean> {
    if (ctx.isAdmin) return true;
    return ctx.leadership.some((l) => (l.category === "UNIT" || l.category === "TEAM") && l.unitId === unitId);
}

/**
 * Resolve the current session into a full AuthUser (with derived role), or null.
 * Single RPC call (no ict-lib / N+1).
 */
async function resolveAuthUser(): Promise<AuthUser | null> {
    const profileId = await getSessionProfileId();
    if (!profileId) return null;

    const context = await getProfileContext(profileId);
    if (!context) return null;

    return createAuthUser(context, context.profile.email || "");
}

/**
 * Admin = holds a default admin position (VP Admin / ICT Coordinator) or PRESIDENT scope.
 */
export async function checkEnhancedAdminAccess(): Promise<{
    isAdmin: boolean;
    user: AuthUser | null;
    error?: string;
}> {
    try {
        const authUser = await resolveAuthUser();
        if (!authUser) {
            return { isAdmin: false, user: null, error: "Invalid session" };
        }

        const hasAdminAccess = authUser.role === 'ADMIN';
        return {
            isAdmin: hasAdminAccess,
            user: authUser,
            error: hasAdminAccess ? undefined : "Access denied: Not authorized for admin access",
        };
    } catch (error: unknown) {
        console.error("Admin access check failed:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return { isAdmin: false, user: null, error: errorMessage };
    }
}

/**
 * Moderator = admin OR holds any active leadership position.
 */
export async function checkModeratorAccess(): Promise<{
    isModerator: boolean;
    user: AuthUser | null;
    error?: string;
}> {
    try {
        const authUser = await resolveAuthUser();
        if (!authUser) {
            return { isModerator: false, user: null, error: "Invalid session" };
        }

        const isModerator = ['ADMIN', 'MODERATOR'].includes(authUser.role);
        return {
            isModerator,
            user: authUser,
            error: isModerator ? undefined : "Access denied: Moderator access required",
        };
    } catch (error: unknown) {
        console.error("Moderator access check failed:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return { isModerator: false, user: null, error: errorMessage };
    }
}

/**
 * Reusable access control for protected server actions.
 * @param requiredLevel - 'USER' | 'MODERATOR' | 'ADMIN'
 */
export async function requireAccess(requiredLevel: 'USER' | 'MODERATOR' | 'ADMIN'): Promise<AuthUser> {
    const authUser = await resolveAuthUser();
    if (!authUser) {
        throw new Error("Authentication required");
    }

    if (requiredLevel === 'ADMIN' && authUser.role !== 'ADMIN') {
        throw new Error("Admin access required");
    }
    if (requiredLevel === 'MODERATOR' && !['ADMIN', 'MODERATOR'].includes(authUser.role)) {
        throw new Error("Moderator access required");
    }

    return authUser;
}
