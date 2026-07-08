/**
 * DB-backed, revocable sessions for leader logins.
 *
 * A random opaque token is stored in an httpOnly cookie; only its sha256 hash is
 * persisted in `auth_sessions`, so a DB leak can't be replayed as a live session.
 * Every request looks the token up (non-revoked, non-expired) and refreshes
 * `last_seen_at`. Server-only.
 */
import { cookies } from "next/headers";
import { randomBytes, createHash } from "crypto";
import { ictAdmin } from "@/lib/ict";

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

    const { error } = await ictAdmin.supabase.from("auth_sessions").insert({
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

/**
 * Resolve the current session from the cookie. Returns the owning profile id, or
 * null if there is no valid, non-revoked, non-expired session. Touches
 * `last_seen_at` on success.
 */
export async function getSessionProfileId(): Promise<string | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const { data, error } = await ictAdmin.supabase
        .from("auth_sessions")
        .select("id, profile_id, expires_at, revoked_at")
        .eq("token_hash", sha256(token))
        .maybeSingle();

    if (error || !data) return null;
    if (data.revoked_at) return null;
    if (new Date(data.expires_at).getTime() < Date.now()) return null;

    // Best-effort activity timestamp; don't fail the request if it errors.
    await ictAdmin.supabase
        .from("auth_sessions")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", data.id);

    return data.profile_id as string;
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
    const { data } = await ictAdmin.supabase
        .from("auth_sessions")
        .update({ revoked_at: new Date().toISOString(), revoked_reason: "logout" })
        .eq("token_hash", sha256(token))
        .is("revoked_at", null)
        .select("profile_id")
        .maybeSingle();

    return (data?.profile_id as string) ?? null;
}
