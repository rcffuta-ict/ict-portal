/**
 * Role-based utilities for user permissions.
 *
 * Roles are derived from a member's LEADERSHIP POSITIONS (from `FullUserProfile.roles`),
 * NOT from department or an email whitelist:
 *   - ADMIN     → holds a default position (VP Admin / ICT Coordinator) or a PRESIDENT-scope role.
 *   - MODERATOR → holds any other active leadership position (unit/team/level head, etc.).
 *   - USER      → has login but no position (edge case; normally can't reach the portal).
 *
 * `FullUserProfile.roles` only exposes { title, scope, contextName }, so admin detection
 * here is title/scope based. Precise scope checks (which unit/level a leader manages) live
 * in `src/lib/access-control.ts`, which queries the DB.
 */

import type { FullUserProfile } from '@rcffuta/ict-lib';

export type UserRole = 'USER' | 'ADMIN' | 'MODERATOR';

/**
 * The two protected, seeded leadership positions that grant full admin rights.
 * Kept in sync with db/migrations/0001_auth_rework.sql and the seeded titles.
 */
export const DEFAULT_ADMIN_TITLES = [
    'Vice President Administration',
    'ICT Coordinator',
] as const;

export interface AuthUser {
    id: string;
    email: string;
    role: UserRole;
    user: FullUserProfile; // ICT lib profile with academics, personal info, roles, etc.
}

function roleTitles(profile: FullUserProfile | null | undefined): string[] {
    return (profile?.roles ?? []).map((r) => r.title);
}

/**
 * Whether the profile holds one of the default admin positions (VP Admin / ICT Coord)
 * or a PRESIDENT-scope role.
 *
 * NOTE: this is a CLIENT-side heuristic over the plain profile (title/scope based). The
 * server-side source of truth for authorization is the PRIVILEGE TAGS on the enriched
 * ProfileContext (isSysAdmin / isPresident / isAdmin) — see src/lib/access-control.ts.
 */
export function isDefaultAdminProfile(profile: FullUserProfile | null | undefined): boolean {
    if (!profile?.roles) return false;
    const titles = roleTitles(profile);
    if (titles.some((t) => DEFAULT_ADMIN_TITLES.includes(t as (typeof DEFAULT_ADMIN_TITLES)[number]))) {
        return true;
    }
    return profile.roles.some((r) => r.scope === 'PRESIDENT');
}

/** VP Admin specifically (the appointer of leaders). */
export function isVpAdmin(profile: FullUserProfile | null | undefined): boolean {
    return roleTitles(profile).includes('Vice President Administration');
}

/**
 * Determine user role based on leadership positions.
 */
export function determineUserRole(profile: FullUserProfile): UserRole {
    if (isDefaultAdminProfile(profile)) return 'ADMIN';
    if (profile.roles && profile.roles.length > 0) return 'MODERATOR';
    return 'USER';
}

/**
 * Client-friendly admin check from a full profile (used by client components that
 * can't query the DB — they rely on the profile in the store).
 */
export function isProfileAdmin(profile: FullUserProfile | null | undefined): boolean {
    return isDefaultAdminProfile(profile);
}

/**
 * Check if user has admin privileges.
 */
export function isAdmin(user: AuthUser | FullUserProfile): boolean {
    if ('role' in user) {
        return user.role === 'ADMIN';
    }
    return determineUserRole(user) === 'ADMIN';
}

/**
 * Check if user has moderator or higher privileges.
 */
export function isModerator(user: AuthUser | FullUserProfile): boolean {
    if ('role' in user) {
        return ['ADMIN', 'MODERATOR'].includes(user.role);
    }
    const role = determineUserRole(user);
    return ['ADMIN', 'MODERATOR'].includes(role);
}

/**
 * Convert FullUserProfile to AuthUser.
 */
export function createAuthUser(profile: FullUserProfile, email: string): AuthUser {
    return {
        id: profile.profile.id,
        email: email || profile.profile.email || '',
        role: determineUserRole(profile),
        user: profile,
    };
}

/**
 * Permission checks for specific actions.
 */
export const permissions = {
    canManageUsers: (user: AuthUser) => isAdmin(user),
    canEditProfile: (user: AuthUser, profileId: string) =>
        isAdmin(user) || user.id === profileId,
    canViewAdminDashboard: (user: AuthUser) => isAdmin(user),
    canManageEvents: (user: AuthUser) => isModerator(user),
    canViewReports: (user: AuthUser) => isModerator(user),
} as const;
