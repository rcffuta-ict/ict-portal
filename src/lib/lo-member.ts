/**
 * MEMBER RECOGNITION FOR THE LO! APP — deliberately not authentication.
 *
 * Lo! is open to everyone with no login, and only leaders have `profile_login`
 * rows, so "are you one of us?" can't be answered by the portal session. Instead a
 * visitor confirms themselves against the `profiles` roster (matric number or email
 * + surname) and we remember that with an opaque token: the raw token lives in an
 * httpOnly cookie, only its sha256 is stored, and the row is revocable — the same
 * shape as `src/lib/auth/session.ts`.
 *
 * WHAT A RECOGNITION LINK GRANTS: posting a testimony, saying Amen, and seeing your
 * own pending posts. Nothing else. It must never be accepted in place of a portal
 * session, and never as evidence of ADMIN or MODERATOR rights — those still come
 * from `src/lib/auth-roles.ts` via the real session.
 *
 * THREAT MODEL: the shared secret is roster data (matric number + surname), which is
 * semi-public within the fellowship. This keeps strangers out of the testimony feed;
 * it does not stop a determined classmate from impersonating someone they know. That
 * is an accepted trade-off for a login-free app — which is also why every attempt is
 * logged and rate-limited, and why the link grants nothing beyond testimonies.
 *
 * Server-only — it reads cookies and the service-role client; never import it
 * into a client component.
 */
import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getSessionProfileId } from "@/lib/auth/session";

export const LO_MEMBER_COOKIE = "lo-member";

const LINK_TTL_DAYS = 120;
const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_FAILURES = 8;

export interface LoMember {
    profileId: string;
    firstName: string;
    lastName: string;
    /** Convenience display name, e.g. "Grace Adeyemi". */
    fullName: string;
    level?: string | null;
    /** How we know who this is: a real portal session, or a recognition link. */
    via: "session" | "link";
}

function sha256(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

/** Matric numbers get typed every which way — compare on letters and digits only. */
function normalizeMatric(value: string): string {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeName(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
}

async function clientHash(): Promise<string> {
    const headerList = await headers();
    const ip =
        headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        headerList.get("x-real-ip") ||
        "unknown";
    return sha256(`${ip}|${headerList.get("user-agent") || "unknown"}`);
}

async function logAttempt(identifier: string, succeeded: boolean): Promise<void> {
    try {
        await db.from("lo_member_verify_attempts").insert({
            client_hash: await clientHash(),
            identifier: identifier.slice(0, 64),
            succeeded,
        });
    } catch (error) {
        // Never fail a verification because the audit insert failed.
        console.error("lo-member: failed to log verify attempt", error);
    }
}

/** True when this client has burned through its recent failed attempts. */
async function isRateLimited(): Promise<boolean> {
    const since = new Date(
        Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    ).toISOString();

    const { count, error } = await db
        .from("lo_member_verify_attempts")
        .select("id", { count: "exact", head: true })
        .eq("client_hash", await clientHash())
        .eq("succeeded", false)
        .gte("created_at", since);

    if (error) {
        console.error("lo-member: rate limit check failed", error);
        return false;
    }

    return (count || 0) >= RATE_LIMIT_MAX_FAILURES;
}

interface ProfileRow {
    id: string;
    first_name: string;
    last_name: string;
    matric_number: string | null;
    email: string | null;
    class_set_id: string | null;
}

/** Look the identifier up as an email first, then as a matric number. */
async function findProfileByIdentifier(identifier: string): Promise<ProfileRow | null> {
    const trimmed = identifier.trim();
    if (!trimmed) return null;

    const columns = "id, first_name, last_name, matric_number, email, class_set_id";

    if (trimmed.includes("@")) {
        const { data } = await db
            .from("profiles")
            .select(columns)
            .ilike("email", trimmed)
            .maybeSingle();
        return (data as ProfileRow) || null;
    }

    // Matric numbers are stored formatted ("CSC/20/1234") but get typed without the
    // slashes just as often, so match on the normalized form.
    const normalized = normalizeMatric(trimmed);
    if (!normalized) return null;

    const { data } = await db
        .from("profiles")
        .select(columns)
        .ilike("matric_number", `%${normalized.slice(-4)}%`)
        .limit(50);

    const candidates = (data as ProfileRow[]) || [];
    return (
        candidates.find(
            (row) => normalizeMatric(row.matric_number || "") === normalized,
        ) || null
    );
}

export type VerifyResult =
    | { ok: true; member: LoMember }
    | { ok: false; error: string; rateLimited?: boolean };

/**
 * Confirm someone is on the members roster and remember them.
 *
 * Both the identifier and the surname must match the same profile — the surname is
 * what stops a bare list of matric numbers from being enough.
 */
export async function verifyAndLinkMember(
    identifier: string,
    surname: string,
): Promise<VerifyResult> {
    if (!identifier.trim() || !surname.trim()) {
        return { ok: false, error: "Enter your matric number (or email) and surname." };
    }

    if (await isRateLimited()) {
        return {
            ok: false,
            rateLimited: true,
            error: "Too many attempts. Please wait about 15 minutes and try again.",
        };
    }

    let profile: ProfileRow | null = null;
    try {
        profile = await findProfileByIdentifier(identifier);
    } catch (error) {
        console.error("lo-member: profile lookup failed", error);
        return { ok: false, error: "We couldn't check that right now. Please retry." };
    }

    // One deliberately vague message for both "no such profile" and "wrong surname",
    // so this endpoint can't be used to test whether a matric number exists.
    const mismatch = {
        ok: false as const,
        error: "We couldn't match those details to a member record. Check your matric number and surname, or ask the ICT team.",
    };

    if (!profile) {
        await logAttempt(identifier, false);
        return mismatch;
    }

    if (normalizeName(profile.last_name) !== normalizeName(surname)) {
        await logAttempt(identifier, false);
        return mismatch;
    }

    await logAttempt(identifier, true);

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + LINK_TTL_DAYS * 24 * 60 * 60 * 1000);
    const headerList = await headers();

    const { error } = await db.from("lo_member_links").insert({
        profile_id: profile.id,
        token_hash: sha256(token),
        user_agent: headerList.get("user-agent"),
        expires_at: expiresAt.toISOString(),
    });

    if (error) {
        console.error("lo-member: failed to create link", error);
        return { ok: false, error: "We couldn't complete that. Please try again." };
    }

    const cookieStore = await cookies();
    cookieStore.set(LO_MEMBER_COOKIE, token, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: LINK_TTL_DAYS * 24 * 60 * 60,
    });

    return {
        ok: true,
        member: {
            profileId: profile.id,
            firstName: profile.first_name,
            lastName: profile.last_name,
            fullName: `${profile.first_name} ${profile.last_name}`.trim(),
            via: "link",
        },
    };
}

async function memberFromProfileId(
    profileId: string,
    via: LoMember["via"],
): Promise<LoMember | null> {
    const { data } = await db
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("id", profileId)
        .maybeSingle();

    if (!data) return null;

    return {
        profileId: data.id as string,
        firstName: (data.first_name as string) || "",
        lastName: (data.last_name as string) || "",
        fullName: `${data.first_name || ""} ${data.last_name || ""}`.trim(),
        via,
    };
}

/**
 * Who is this, if anyone? A real portal session wins over a recognition link.
 * Returns null for an anonymous visitor — that is a normal state here, not an error.
 */
export async function getLoMember(): Promise<LoMember | null> {
    const sessionProfileId = await getSessionProfileId();
    if (sessionProfileId) {
        return memberFromProfileId(sessionProfileId, "session");
    }

    const cookieStore = await cookies();
    const token = cookieStore.get(LO_MEMBER_COOKIE)?.value;
    if (!token) return null;

    const { data } = await db
        .from("lo_member_links")
        .select("id, profile_id, expires_at, revoked_at")
        .eq("token_hash", sha256(token))
        .maybeSingle();

    if (!data || data.revoked_at) return null;
    if (new Date(data.expires_at as string).getTime() < Date.now()) return null;

    // Best-effort activity stamp; a failure here must not log the member out.
    await db
        .from("lo_member_links")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", data.id);

    return memberFromProfileId(data.profile_id as string, "link");
}

/** Like getLoMember but throws — for actions that write on a member's behalf. */
export async function requireLoMember(): Promise<LoMember> {
    const member = await getLoMember();
    if (!member) {
        throw new Error("Confirm your membership to continue.");
    }
    return member;
}

/** Revoke the recognition link on this device ("not you?"). */
export async function forgetLoMemberLink(): Promise<void> {
    const cookieStore = await cookies();
    const token = cookieStore.get(LO_MEMBER_COOKIE)?.value;

    if (token) {
        await db
            .from("lo_member_links")
            .update({ revoked_at: new Date().toISOString() })
            .eq("token_hash", sha256(token))
            .is("revoked_at", null);
    }

    cookieStore.delete(LO_MEMBER_COOKIE);
}
