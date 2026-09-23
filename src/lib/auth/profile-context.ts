/**
 * Single-call profile resolution via the `rcf_profile_context` / `rcf_login_context`
 * Postgres RPCs. Returns the `FullUserProfile` shape the client store expects
 * (camelCase, defined in src/lib/types/portal.ts) enriched with leadership/scope data
 * ict-lib doesn't expose. Server-only (service-role RPC).
 */
import type { FullUserProfile } from "@/lib/types/portal";
import { db } from "@/lib/db";
import type { Privilege } from "@/lib/modules";
import type { PositionKind } from "@/lib/privileges";

/** Enriched leadership row from the context RPC (superset of ict-lib's roles). */
export interface LeadershipContext {
    leadershipId: string;
    positionId: string;
    title: string;
    alias: string | null;
    slug: string | null;
    /**
     * What KIND of office this is — for display and grouping only.
     *
     * DERIVED, not stored: migration 0013 dropped `leadership_positions.category` and
     * the RPC now computes this with `rcf_position_kind()`, the SQL twin of
     * `derivePositionKind()` in src/lib/privileges.ts. It therefore cannot drift out of
     * step with the privilege tags below, which is what the stored column kept doing.
     */
    category: PositionKind;
    /** Hierarchy rank — presentation and ordering only (migration 0011). */
    tier: "PRESIDENT" | "VP" | "EXECUTIVE" | "COORDINATOR" | null;
    /** Part of the frozen catalogue, so it may not be deleted (migration 0011). */
    isProtected: boolean;
    unitId: string | null;
    unitName: string | null;
    classSetId: string | null;
    residentialZoneId: string | null;
    tenureId: string;
    /**
     * Privilege tags (+ scopes) held by this leadership's POSITION — the SINGLE source
     * of truth for authorization (see src/lib/module-access.ts + access-control.ts).
     * `category` and `tier` above are presentation, and are derived from these.
     */
    privileges: Privilege[];
}

/**
 * `FullUserProfile` plus the enriched fields our own RPC adds. Client code that
 * only knows `FullUserProfile` keeps working; new code can read the extras.
 */
export type ProfileContext = FullUserProfile & {
    classSet: {
        id: string;
        entryYear: number | null;
        familyName: string | null;
        isFoundation: boolean;
        currentLevel: string | null;
    } | null;
    leadership: LeadershipContext[];
    /** READ-bypass tier: SysAdmin, President, or VP Admin (see the RPC). */
    isAdmin: boolean;
    isVpAdmin: boolean;
    /** Holds the SYSADMIN privilege (the ICT Coordinator) — full read+write incl. Settings. */
    isSysAdmin: boolean;
    /** Holds the PRESIDENT privilege — sees all incl. Settings, but is globally write-blocked. */
    isPresident: boolean;
    /**
     * Tool modules this profile may READ, resolved from `module_access` config at
     * login (see src/lib/module-access.ts). NOT part of the RPC payload — app code
     * attaches it before handing the context to the client so the sidebar can gate
     * Tools without shipping the config/slug list to the browser.
     */
    accessibleModules?: string[];
};

/**
 * Resolve the full, enriched profile context for a profile id in one round-trip.
 */
export async function getProfileContext(profileId: string): Promise<ProfileContext | null> {
    const { data, error } = await db.rpc("rcf_profile_context", {
        p_profile_id: profileId,
    });
    if (error || !data) {
        if (error) console.error("rcf_profile_context failed:", error.message);
        return null;
    }
    return data as ProfileContext;
}

/** Shape returned by the `rcf_login_context` RPC (auth gate + profile context). */
export interface LoginContext {
    profileId: string;
    email: string | null;
    loginId: string;
    /**
     * NULL when no password has been set — the first-login signal. Normalised in
     * {@link getLoginContext}, so a blank hash never reaches the callers.
     */
    passwordHash: string | null;
    isActive: boolean;
    failedAttempts: number | null;
    lockedUntil: string | null;
    context: ProfileContext | null;
}

/**
 * Resolve the login gate + profile context by email in one round-trip.
 * Returns null when the email has no profile or no login record.
 *
 * A BLANK `password_hash` is normalised to null, because "not set yet" is what the
 * login flow branches on and an empty string is the same thing wearing a disguise.
 * Clearing the cell from the Supabase table editor writes `''` rather than NULL, and
 * without this the leader is sent to the "enter your password" step with a hash that
 * nothing can ever verify — locked out, with no way to reach set-password.
 */
export async function getLoginContext(email: string): Promise<LoginContext | null> {
    const { data, error } = await db.rpc("rcf_login_context", {
        p_email: email,
    });
    if (error || !data) {
        if (error) console.error("rcf_login_context failed:", error.message);
        return null;
    }
    const login = data as LoginContext;
    return {
        ...login,
        passwordHash: login.passwordHash?.trim() ? login.passwordHash : null,
    };
}
