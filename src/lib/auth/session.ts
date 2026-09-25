/**
 * DB-backed, revocable sessions for leader logins.
 *
 * A random opaque token is stored in an httpOnly cookie; only its sha256 hash is
 * persisted in `auth_sessions`, so a DB leak can't be replayed as a live session.
 * Every request looks the token up (non-revoked, non-expired); `last_seen_at` is
 * refreshed at most every few minutes, after the response. Server-only.
 */
import { cache } from "react";
import { cookies } from "next/headers";
import { after } from "next/server";
import { randomBytes, createHash } from "crypto";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "rcf-session";
const SESSION_TTL_DAYS = 7;

function sha256(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

function cookieOptions(maxAgeSeconds: number) {
    return {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        maxAge: maxAgeSeconds,
    };
}

export interface SessionMeta {
    ip?: string | null;
    userAgent?: string | null;
}

/**
 * Create a new session row + set the cookie. Returns the raw token (rarely needed).
 */
export async function createSession(profileId: string, meta: SessionMeta = {}): Promise<string> {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    const { error } = await db.from("auth_sessions").insert({
        profile_id: profileId,
        token_hash: sha256(token),
        ip: meta.ip ?? null,
        user_agent: meta.userAgent ?? null,
        expires_at: expiresAt.toISOString(),
    });
    if (error) throw new Error(`Failed to create session: ${error.message}`);

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_DAYS * 24 * 60 * 60));

    return token;
}

/** How stale `last_seen_at` may get before a request refreshes it. */
const LAST_SEEN_EVERY_MS = 5 * 60 * 1000;

/**
 * Resolve the current session from the cookie. Returns the owning profile id, or
 * null if there is no valid, non-revoked, non-expired session.
 *
 * `cache`: once per request. A page's metadata, layout, and every action it calls all
 * resolve the session, and each lookup is a round trip to the database — on a slow
 * connection the repeats were most of the wait. React's cache is scoped to one
 * request, so nothing is shared between users or between requests; a revoked session
 * is refused on the very next request.
 *
 * `last_seen_at` used to be written, and awaited, on every call — a second round trip
 * on the critical path of every page and action. It is only an activity marker, so it
 * is now refreshed at most every five minutes, and after the response has been sent.
 */
export const getSessionProfileId = cache(async (): Promise<string | null> => {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const { data, error } = await db
        .from("auth_sessions")
        .select("id, profile_id, expires_at, revoked_at, last_seen_at")
        .eq("token_hash", sha256(token))
        .maybeSingle();

    if (error || !data) return null;
    if (data.revoked_at) return null;
    if (new Date(data.expires_at).getTime() < Date.now()) return null;

    const lastSeen = data.last_seen_at ? new Date(data.last_seen_at).getTime() : 0;
    if (Date.now() - lastSeen > LAST_SEEN_EVERY_MS) {
        // Best-effort; never fails or delays the request.
        after(async () => {
            await db
                .from("auth_sessions")
                .update({ last_seen_at: new Date().toISOString() })
                .eq("id", data.id);
        });
    }

    return data.profile_id as string;
});

/**
 * Delete the session cookie and nothing else.
 *
 * For a cookie that points at a session the database no longer has — expired, revoked,
 * or belonging to a database that has since been reset. There is no row to revoke and
 * no logout to audit; the cookie is simply stale.
 *
 * CLEARING IT IS NOT COSMETIC. `src/proxy.ts` decides redirect-vs-allow on the mere
 * PRESENCE of this cookie (by design — it is a UX layer, not an authorization
 * boundary). So a stale cookie puts the app in a redirect loop: the dashboard finds no
 * valid session and sends the user to /login, the proxy sees a cookie and sends them
 * back to /dashboard, forever. The user sees a loading screen that never resolves.
 * Removing the cookie is what breaks that cycle.
 */
export async function clearSessionCookie(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
}

/**
 * Revoke the current session (logout) and clear the cookie.
 * Returns the profile id that owned the session, for audit logging.
 */
export async function revokeCurrentSession(): Promise<string | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    cookieStore.delete(SESSION_COOKIE);

    if (!token) return null;

    // Setting revoked_at fires the `trg_audit_session_revoke` trigger, which
    // writes the 'logout' event to login_events (reason distinguishes it from an
    // admin-initiated revoke). No app-side audit call needed.
    const { data } = await db
        .from("auth_sessions")
        .update({ revoked_at: new Date().toISOString(), revoked_reason: "logout" })
        .eq("token_hash", sha256(token))
        .is("revoked_at", null)
        .select("profile_id")
        .maybeSingle();

    return (data?.profile_id as string) ?? null;
}
