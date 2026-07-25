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
import { canReadModule, canWriteModule, getModuleAccessConfig, type ModuleId } from "@/lib/module-access";
import { ictAdmin } from "@/lib/ict";
import { computeLevel } from "@/lib/levels";

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
 * Require the current session to have WRITE access to a Tool module per the
 * `module_access` config (admins always pass). Returns the enriched context so
 * callers can apply OWN-scope narrowing (via canManageUnit / canManageLevel).
 * @throws when unauthenticated or not permitted.
 */
export async function requireModuleWrite(module: ModuleId): Promise<ProfileContext> {
    const ctx = await requireContext();
    const config = await getModuleAccessConfig();
    if (!canWriteModule(ctx, module, config)) {
        throw new Error("Access denied: insufficient module access");
    }
    return ctx;
}

/**
 * Require the current session to hold the SYSADMIN privilege (the ICT Coordinator).
 * Gates writing the app-config Settings module — the System Admin manages who can
 * read/write each module. Intentionally narrower than the READ-bypass tier (VP Admin
 * and the President are admins for reads but are NOT the System Admin).
 * @throws when unauthenticated or not the System Admin.
 */
export async function requireSysAdmin(): Promise<ProfileContext> {
    const ctx = await requireContext();
    if (!ctx.isSysAdmin) {
        throw new Error("Access denied: System Admin only");
    }
    return ctx;
}

/**
 * Require the current session to be able to READ Settings: the System Admin (manages
 * it) or the President (sees everything, incl. Settings, read-only).
 * @throws when unauthenticated or neither.
 */
export async function requirePresidentOrSysAdmin(): Promise<ProfileContext> {
    const ctx = await requireContext();
    if (!ctx.isSysAdmin && !ctx.isPresident) {
        throw new Error("Access denied: System Admin or President only");
    }
    return ctx;
}

/**
 * @deprecated Renamed to {@link requireSysAdmin} (the ICT Coordinator IS the System
 * Admin). Kept as an alias while callers migrate.
 */
export async function requireIctCoord(): Promise<ProfileContext> {
    return requireSysAdmin();
}

// NOTE: this module is `'use server'`, so these scope checks are async (all exports
// of a server-action module must be async).

/** Every privilege tag+scope the context holds, flattened across positions. */
function heldPrivileges(ctx: ProfileContext): { tag: string; scope: string | null }[] {
    return (ctx.leadership ?? []).flatMap((l) => l.privileges ?? []);
}

/** True for the WRITE-bypass tier: System Admin or VP Admin (NOT the President). */
function hasWriteBypass(ctx: ProfileContext): boolean {
    return ctx.isSysAdmin || ctx.isVpAdmin;
}

/**
 * Map a LEVEL scope token to its canonical level label (what computeLevel produces):
 *   '100'..'500' → '<n> Level';  'pds-uabs' → 'PDS/UABS'.
 */
function levelTokenToLabel(token: string): string | null {
    const t = token.trim().toLowerCase();
    if (t === "pds-uabs" || t === "pds/uabs") return "PDS/UABS";
    if (/^[1-5]00$/.test(t)) return `${t} Level`;
    return null;
}

/**
 * WRITE capability over a generation. True for the write-bypass tier, or when the
 * context holds a LEVEL privilege whose scope resolves to this generation for the
 * active session (a level token → the generation CURRENTLY at that level; no scope /
 * 'all' → any generation). CENTRAL is read-only and does NOT grant this.
 */
export async function canManageLevel(ctx: ProfileContext, classSetId: string): Promise<boolean> {
    if (hasWriteBypass(ctx)) return true;

    const levelScopes = heldPrivileges(ctx)
        .filter((p) => p.tag === "LEVEL")
        .map((p) => p.scope);
    if (levelScopes.length === 0) return false;
    // An un-scoped (or explicit 'all') LEVEL grants every generation.
    if (levelScopes.some((s) => s == null || s.toLowerCase() === "all")) return true;

    const { data: cs } = await ictAdmin.supabase
        .from("class_sets")
        .select("entry_year, is_foundation, level_override")
        .eq("id", classSetId)
        .maybeSingle();
    if (!cs) return false;

    const { data: tenure } = await ictAdmin.supabase
        .from("tenures").select("session").eq("is_active", true).maybeSingle();
    const effective = cs.level_override
        || computeLevel(cs.entry_year, cs.is_foundation, tenure?.session ?? null);

    return levelScopes.some((s) => s != null && levelTokenToLabel(s) === effective);
}

/**
 * WRITE capability over a unit/team. True for the write-bypass tier, or when the
 * context holds an EXCO privilege scoped to this unit's slug (or an un-scoped / 'all'
 * EXCO, which is central-equivalent). CENTRAL is read-only and does NOT grant this.
 */
export async function canManageUnit(ctx: ProfileContext, unitId: string): Promise<boolean> {
    if (hasWriteBypass(ctx)) return true;

    const excoScopes = heldPrivileges(ctx)
        .filter((p) => p.tag === "EXCO")
        .map((p) => p.scope);
    if (excoScopes.length === 0) return false;
    if (excoScopes.some((s) => s == null || s.toLowerCase() === "all")) return true;

    const { data: unit } = await ictAdmin.supabase
        .from("units").select("slug").eq("id", unitId).maybeSingle();
    if (!unit?.slug) return false;

    return excoScopes.some((s) => s === unit.slug);
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
