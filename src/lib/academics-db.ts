/**
 * Academics data access: settings, rounds, records, and the round page's identity
 * check. Server-only: it reads the service-role client and request headers. Every
 * caller decides who may see what BEFORE calling in here.
 */
import { cache } from "react";
import { createHash } from "crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { fetchAll } from "@/lib/fetch-all";
import { generateShortToken } from "@/lib/invites";
import { semesterLabel, type GradeRow } from "@/lib/academics";

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** Who may see INDIVIDUAL results outside the Academics module. */
export interface AcademicSettings {
    unitHeadsSeeIndividuals: boolean;
    levelCoordsSeeIndividuals: boolean;
    membersSeeOwn: boolean;
    updatedAt: string | null;
}

export const DEFAULT_ACADEMIC_SETTINGS: AcademicSettings = {
    unitHeadsSeeIndividuals: true,
    levelCoordsSeeIndividuals: false,
    membersSeeOwn: false,
    updatedAt: null,
};

/** The settings row, or the defaults when it's missing (a reset staging database). */
export const getAcademicSettings = cache(async (): Promise<AcademicSettings> => {
    const { data, error } = await db
        .from("academic_settings")
        .select("unit_heads_see_individuals, level_coords_see_individuals, members_see_own, updated_at")
        .eq("id", true)
        .maybeSingle();
    if (error) throw new Error(`Couldn't load academics settings: ${error.message}`);
    if (!data) return DEFAULT_ACADEMIC_SETTINGS;
    return {
        unitHeadsSeeIndividuals: data.unit_heads_see_individuals,
        levelCoordsSeeIndividuals: data.level_coords_see_individuals,
        membersSeeOwn: data.members_see_own,
        updatedAt: data.updated_at,
    };
});

// ---------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------

export interface AcademicRound {
    id: string;
    session: string;
    semester: 1 | 2;
    token: string;
    label: string;
    opensAt: string;
    closesAt: string | null;
    closedAt: string | null;
    isOpen: boolean;
}

const ROUND_COLUMNS = "id, session, semester, token, opens_at, closes_at, closed_at";

function toRound(r: Record<string, unknown>): AcademicRound {
    return {
        id: r.id as string,
        session: r.session as string,
        semester: r.semester as 1 | 2,
        token: r.token as string,
        label: semesterLabel(r.session as string, r.semester as number),
        opensAt: r.opens_at as string,
        closesAt: (r.closes_at as string | null) ?? null,
        closedAt: (r.closed_at as string | null) ?? null,
        isOpen: r.closed_at == null,
    };
}

/** Every round, newest semester first. */
export async function listRounds(): Promise<AcademicRound[]> {
    const { data, error } = await db
        .from("academic_rounds")
        .select(ROUND_COLUMNS)
        .order("session", { ascending: false })
        .order("semester", { ascending: false });
    if (error) throw new Error(`Couldn't load rounds: ${error.message}`);
    return (data ?? []).map(toRound);
}

/** The round with this (canonical, lower-case) token, open or not. */
export async function getRoundByToken(token: string): Promise<AcademicRound | null> {
    const { data } = await db.from("academic_rounds").select(ROUND_COLUMNS).eq("token", token).maybeSingle();
    return data ? toRound(data) : null;
}

export async function getRoundById(id: string): Promise<AcademicRound | null> {
    const { data } = await db.from("academic_rounds").select(ROUND_COLUMNS).eq("id", id).maybeSingle();
    return data ? toRound(data) : null;
}

/**
 * Open a round for a semester. Short tokens can collide, so a clash on the token is
 * retried; a clash on the semester, or a second open round, is the caller's error.
 */
export async function insertRound(input: {
    session: string;
    semester: 1 | 2;
    closesAt: string | null;
    createdBy: string;
}): Promise<{ round?: AcademicRound; error?: string }> {
    for (let attempt = 0; attempt < 6; attempt++) {
        const { data, error } = await db
            .from("academic_rounds")
            .insert({
                session: input.session,
                semester: input.semester,
                token: generateShortToken("acd"),
                closes_at: input.closesAt,
                created_by: input.createdBy,
            })
            .select(ROUND_COLUMNS)
            .single();
        if (!error) return { round: toRound(data) };
        if (error.code !== "23505") return { error: error.message };
        if (error.message.includes("academic_rounds_one_open")) {
            return { error: "Another round is still open. Close it first." };
        }
        if (error.message.includes("session_semester")) {
            return { error: "There's already a round for that semester. Reopen it instead." };
        }
        // Otherwise the token collided: go round again with a new one.
    }
    return { error: "Couldn't generate a round token. Try again." };
}

// ---------------------------------------------------------------------------
// Members and records
// ---------------------------------------------------------------------------

export interface ClassSetRow {
    id: string;
    entry_year: number | null;
    is_foundation: boolean | null;
    level_override: string | null;
    family_name: string | null;
}

/** Every generation, by id. A handful of rows. */
export async function classSetsById(): Promise<Map<string, ClassSetRow>> {
    const { data, error } = await db
        .from("class_sets")
        .select("id, entry_year, is_foundation, level_override, family_name");
    if (error) throw new Error(`Couldn't load generations: ${error.message}`);
    return new Map((data ?? []).map((s) => [s.id as string, s as ClassSetRow]));
}

export interface MemberRow {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone_number: string | null;
    gender: string | null;
    matric_number: string | null;
    department: string | null;
    faculty: string | null;
    department_id: string | null;
    class_set_id: string | null;
    avatar_url: string | null;
}

export const MEMBER_COLUMNS =
    "id, first_name, last_name, email, phone_number, gender, matric_number, department, faculty, department_id, class_set_id, avatar_url";

/** Members, all or just these ids. Complete however many there are (fetchAll). */
export async function loadMembers(ids?: string[]): Promise<MemberRow[]> {
    if (ids) {
        if (ids.length === 0) return [];
        const out: MemberRow[] = [];
        // `in` lists go in the URL, so keep each request's list short.
        for (let i = 0; i < ids.length; i += 150) {
            const { data, error } = await db.from("profiles").select(MEMBER_COLUMNS).in("id", ids.slice(i, i + 150));
            if (error) throw new Error(error.message);
            out.push(...((data ?? []) as MemberRow[]));
        }
        return out;
    }
    return fetchAll<MemberRow>((from, to) =>
        db.from("profiles").select(MEMBER_COLUMNS).order("id").range(from, to) as never,
    );
}

interface RecordDbRow {
    id: string;
    profile_id: string;
    session: string;
    semester: number;
    gpa: number | string;
    cgpa: number | string;
    source: string;
    round_id: string | null;
    submitted_at: string;
    updated_at: string;
}

export interface AcademicRecord extends GradeRow {
    id: string;
    source: "member" | "coordinator";
    roundId: string | null;
    submittedAt: string;
    updatedAt: string;
}

function toRecord(r: RecordDbRow): AcademicRecord {
    return {
        id: r.id,
        profileId: r.profile_id,
        session: r.session,
        semester: r.semester,
        // numeric comes back from PostgREST as a number, but be sure.
        gpa: Number(r.gpa),
        cgpa: Number(r.cgpa),
        source: r.source as AcademicRecord["source"],
        roundId: r.round_id,
        submittedAt: r.submitted_at,
        updatedAt: r.updated_at,
    };
}

const RECORD_COLUMNS = "id, profile_id, session, semester, gpa, cgpa, source, round_id, submitted_at, updated_at";

/** Records, for these members or everyone. */
export async function loadRecords(profileIds?: string[]): Promise<AcademicRecord[]> {
    if (profileIds) {
        if (profileIds.length === 0) return [];
        const out: AcademicRecord[] = [];
        for (let i = 0; i < profileIds.length; i += 150) {
            const rows = await fetchAll<RecordDbRow>((from, to) =>
                db.from("academic_records").select(RECORD_COLUMNS)
                    .in("profile_id", profileIds.slice(i, i + 150))
                    .order("id").range(from, to) as never,
            );
            out.push(...rows.map(toRecord));
        }
        return out;
    }
    const rows = await fetchAll<RecordDbRow>((from, to) =>
        db.from("academic_records").select(RECORD_COLUMNS).order("id").range(from, to) as never,
    );
    return rows.map(toRecord);
}

// ---------------------------------------------------------------------------
// The round page's identity check (NOT authentication)
// ---------------------------------------------------------------------------
//
// Same trade-off as Lo! member recognition (src/lib/lo-member.ts): most members have no
// login, so a member is recognised by details a stranger is unlikely to have together.
// That is why the round page never shows anybody's grades, why every attempt is
// logged, and why failures are rate-limited.

const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_FAILURES = 8;

async function clientHash(): Promise<string> {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
    return createHash("sha256").update(`${ip}|${h.get("user-agent") || "unknown"}`).digest("hex");
}

export async function logSubmitAttempt(identifier: string, succeeded: boolean): Promise<void> {
    try {
        await db.from("academic_submit_attempts").insert({
            client_hash: await clientHash(),
            identifier: identifier.slice(0, 64),
            succeeded,
        });
    } catch (error) {
        // Never fail a submission because the audit insert failed.
        console.error("academics: failed to log a submit attempt", error);
    }
}

export async function isSubmitRateLimited(): Promise<boolean> {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count, error } = await db
        .from("academic_submit_attempts")
        .select("id", { count: "exact", head: true })
        .eq("client_hash", await clientHash())
        .eq("succeeded", false)
        .gte("created_at", since);
    if (error) {
        console.error("academics: rate limit check failed", error);
        return false;
    }
    return (count || 0) >= RATE_LIMIT_MAX_FAILURES;
}

/** Matric numbers get typed every which way: compare on letters and digits only. */
export function normalizeMatric(value: string | null | undefined): string {
    return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeName(value: string | null | undefined): string {
    return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}
