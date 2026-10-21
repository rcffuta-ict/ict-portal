/**
 * WHO MAY REGISTER FOR A MEMBERS-ONLY (EXCLUSIVE) EVENT — recognition, not a login.
 *
 * An exclusive event takes registrations only from fellowship members. Most members
 * have no portal login, so a member proves who they are with two things a stranger is
 * unlikely to have together:
 *
 *   - their generation's LEVEL TOKEN (`RCF-XXXXX`, shared by the level coordinator), and
 *   - the EMAIL on their member record.
 *
 * The email must belong to a member OF THAT TOKEN'S GENERATION. A signed-in portal user
 * (a leader) is recognised from their session instead, which is stronger.
 *
 * What it grants: one registration for one event, built from the roster (name, level,
 * etc. come from the record, not from what was typed). Nothing else — never a session,
 * never a role. Same trade-off as Lo! recognition and the academics round page, so
 * every attempt is logged (`event_member_verify_attempts`) and failures are
 * rate-limited per client.
 *
 * Server-only: reads headers and the service-role client.
 */
import { createHash } from "crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { getInviteByToken } from "@/lib/invites";
import { parseLevelTokenInput } from "@/lib/level-token";
import { computeLevel } from "@/lib/levels";
import { getSessionProfileId } from "@/lib/auth/session";

const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_FAILURES = 8;

/** The roster details a members-only registration is built from. */
export interface EventMember {
    profileId: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string | null;
    gender: string | null;
    department: string | null;
    matricNumber: string | null;
    level: string | null;
}

/** One message for every mismatch, so a failure never reveals which half was wrong. */
const NOT_RECOGNISED =
    "We couldn't match that level token and email to a member. Check both — the email must be the one on your member record.";

async function clientHash(): Promise<string> {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
    return createHash("sha256").update(`${ip}|${h.get("user-agent") || "unknown"}`).digest("hex");
}

async function logAttempt(eventId: string, identifier: string, succeeded: boolean): Promise<void> {
    try {
        await db.from("event_member_verify_attempts").insert({
            client_hash: await clientHash(),
            event_id: eventId,
            identifier: identifier.slice(0, 64),
            succeeded,
        });
    } catch (error) {
        // Never fail a registration because the log insert failed.
        console.error("event-member: failed to log an attempt", error);
    }
}

async function isRateLimited(): Promise<boolean> {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count, error } = await db
        .from("event_member_verify_attempts")
        .select("id", { count: "exact", head: true })
        .eq("client_hash", await clientHash())
        .eq("succeeded", false)
        .gte("created_at", since);
    if (error) {
        console.error("event-member: rate limit check failed", error);
        return false;
    }
    return (count || 0) >= RATE_LIMIT_MAX_FAILURES;
}

async function loadMember(match: { profileId?: string; email?: string }): Promise<{
    member: EventMember;
    classSetId: string | null;
} | null> {
    let query = db
        .from("profiles")
        .select(
            "id, first_name, last_name, email, phone_number, gender, department, matric_number, class_set_id, class_set:class_sets(entry_year, is_foundation)",
        )
        .limit(1);
    if (match.profileId) query = query.eq("id", match.profileId);
    else if (match.email) query = query.ilike("email", match.email);
    else return null;

    const { data, error } = await query.maybeSingle();
    if (error || !data || !data.email) return null;

    const { data: tenure } = await db.from("tenures").select("session").eq("is_active", true).maybeSingle();
    const cs = Array.isArray(data.class_set) ? data.class_set[0] : data.class_set;

    return {
        classSetId: (data.class_set_id as string | null) ?? null,
        member: {
            profileId: data.id as string,
            firstName: data.first_name as string,
            lastName: (data.last_name as string) ?? "",
            email: data.email as string,
            phoneNumber: (data.phone_number as string | null) ?? null,
            gender: (data.gender as string | null) ?? null,
            department: (data.department as string | null) ?? null,
            matricNumber: (data.matric_number as string | null) ?? null,
            level: cs ? computeLevel(cs.entry_year, cs.is_foundation, tenure?.session ?? null) : null,
        },
    };
}

/**
 * Recognise the member registering for an exclusive event: a signed-in portal user, or
 * a level token + email pair. Returns the roster record, or a message to show.
 */
export async function recogniseEventMember(
    eventId: string,
    input: { levelToken?: string | null; email?: string | null },
): Promise<{ ok: true; member: EventMember } | { ok: false; error: string }> {
    // A real session is the strongest proof there is.
    const sessionProfileId = await getSessionProfileId();
    if (sessionProfileId) {
        const found = await loadMember({ profileId: sessionProfileId });
        if (found) return { ok: true, member: found.member };
    }

    const email = (input.email ?? "").trim().toLowerCase();
    const token = parseLevelTokenInput(input.levelToken ?? "");
    if (!email || !token) {
        return { ok: false, error: "Enter your level token and the email on your member record." };
    }

    if (await isRateLimited()) {
        return {
            ok: false,
            error: `Too many attempts. Please wait ${RATE_LIMIT_WINDOW_MINUTES} minutes and try again.`,
        };
    }

    // `%` and `_` are wildcards to ilike; an email never needs them to match itself.
    const exactEmail = email.replace(/[%_\\]/g, "\\$&");

    const [invite, found] = await Promise.all([getInviteByToken(token), loadMember({ email: exactEmail })]);
    const tokenOk = invite.valid && invite.invite?.purpose === "level" && !!invite.invite.classSetId;
    const matches = tokenOk && !!found && found.classSetId === invite.invite!.classSetId;

    await logAttempt(eventId, `${token}|${email}`, matches);
    if (!matches || !found) return { ok: false, error: NOT_RECOGNISED };
    return { ok: true, member: found.member };
}
