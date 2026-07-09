/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { getSessionProfileId, revokeCurrentSession } from "@/lib/auth/session";
import { getProfileContext } from "@/lib/auth/profile-context";
import { attachAccessibleModules } from "@/lib/module-access";

/**
 * Verify the current session and return fresh profile data (single RPC call).
 * Sessions are DB-backed opaque tokens (no Supabase Auth / token refresh).
 */
export async function verifySession() {
    try {
        const profileId = await getSessionProfileId();
        if (!profileId) {
            return { success: false, error: "Session expired or invalid" };
        }

        const context = await getProfileContext(profileId);
        if (!context) {
            return { success: false, error: "Failed to fetch user profile" };
        }

        return { success: true, data: await attachAccessibleModules(context) };
    } catch (error: any) {
        console.error("Session verification failed:", error);
        return { success: false, error: error.message || "Session verification failed" };
    }
}

/**
 * Re-validate the session. Kept for backwards compatibility with callers that
 * used to refresh Supabase tokens; opaque sessions don't need a token exchange.
 */
export async function refreshSessionAction() {
    const profileId = await getSessionProfileId();
    if (!profileId) {
        return { success: false, error: "No active session" };
    }
    return { success: true };
}

/**
 * Log out: revoke the current session and clear the cookie.
 */
export async function logoutAction() {
    try {
        // Revoking the session fires the DB audit trigger (logs the 'logout' event).
        await revokeCurrentSession();
        return { success: true };
    } catch (error: any) {
        console.error("Logout failed:", error);
        return { success: false, error: error.message || "Logout failed" };
    }
}
