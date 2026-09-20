/**
 * Append-only authentication audit trail (`login_events`).
 * Best-effort: auditing must never break the auth flow, so failures are logged
 * and swallowed. Server-only.
 */
import { db } from "@/lib/db";

export type LoginEvent =
    | "login_success"
    | "login_fail"
    | "logout"
    | "session_revoked";

export interface AuditContext {
    profileId?: string | null;
    email?: string | null;
    ip?: string | null;
    userAgent?: string | null;
}

export async function recordLoginEvent(event: LoginEvent, ctx: AuditContext): Promise<void> {
    try {
        await db.from("login_events").insert({
            profile_id: ctx.profileId ?? null,
            email: ctx.email ?? null,
            event,
            ip: ctx.ip ?? null,
            user_agent: ctx.userAgent ?? null,
        });
    } catch (e) {
        console.error("Failed to record login event:", e);
    }
}
