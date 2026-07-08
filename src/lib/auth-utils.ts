/**
 * Auth utilities for session management.
 *
 * Supabase Auth is retired. Sessions are our own DB-backed opaque tokens
 * (`src/lib/auth/session.ts`). All authenticated DB access uses the service-role
 * client (`ictAdmin`), which bypasses RLS — authorization is enforced in the
 * server action layer, not by RLS.
 */
import { ictAdmin } from "@/lib/ict";
import { getSessionProfileId } from "@/lib/auth/session";

/** Minimal authenticated identity resolved from the session cookie. */
export interface SessionUser {
    id: string;
    email: string;
}

/**
 * Return the service-role client if there is a valid session, else null.
 * (Kept for backwards compatibility with existing callers.)
 */
export async function getAuthenticatedClient() {
    const profileId = await getSessionProfileId();
    if (!profileId) return null;
    return ictAdmin;
}

/**
 * Validate the session and return the owning user's id + email.
 * Use this to protect server actions and fetch fresh user data.
 */
export async function validateSession(): Promise<{ valid: boolean; user: SessionUser | null }> {
    const profileId = await getSessionProfileId();
    if (!profileId) return { valid: false, user: null };

    const { data, error } = await ictAdmin.supabase
        .from("profiles")
        .select("id, email")
        .eq("id", profileId)
        .maybeSingle();

    if (error || !data) return { valid: false, user: null };

    return { valid: true, user: { id: data.id as string, email: (data.email as string) || "" } };
}
