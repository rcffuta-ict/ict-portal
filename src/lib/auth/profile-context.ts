/**
 * Single-call profile resolution via the `rcf_profile_context` / `rcf_login_context`
 * Postgres RPCs. Returns the `FullUserProfile` shape the client store expects
 * (camelCase, matching @rcffuta/ict-lib) enriched with leadership/scope data that
 * ict-lib doesn't expose. Server-only (service-role RPC).
 */
import type { FullUserProfile } from "@rcffuta/ict-lib";
import { ictAdmin } from "@/lib/ict";

/** Enriched leadership row from the context RPC (superset of ict-lib's roles). */
export interface LeadershipContext {
    leadershipId: string;
    positionId: string;
    title: string;
    alias: string | null;
    slug: string | null;
    category: "PRESIDENT" | "CENTRAL" | "UNIT" | "TEAM" | "LEVEL" | "ZONE";
    isDefault: boolean;
    unitId: string | null;
    unitName: string | null;
    classSetId: string | null;
    residentialZoneId: string | null;
    tenureId: string;
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
    isAdmin: boolean;
    isVpAdmin: boolean;
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
    const { data, error } = await ictAdmin.supabase.rpc("rcf_profile_context", {
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
    passwordHash: string;
    isActive: boolean;
    failedAttempts: number | null;
    lockedUntil: string | null;
    context: ProfileContext | null;
}

/**
 * Resolve the login gate + profile context by email in one round-trip.
 * Returns null when the email has no profile or no login record.
 */
export async function getLoginContext(email: string): Promise<LoginContext | null> {
    const { data, error } = await ictAdmin.supabase.rpc("rcf_login_context", {
        p_email: email,
    });
    if (error || !data) {
        if (error) console.error("rcf_login_context failed:", error.message);
        return null;
    }
    return data as LoginContext;
}
