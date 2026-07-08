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
import { getProfileContext } from "@/lib/auth/profile-context";

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
