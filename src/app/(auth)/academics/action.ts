/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { db } from "@/lib/db";
import { parseRoundTokenInput } from "@/lib/level-token";
import { findProfileByEmail } from "@/lib/profile-lookup";
import { getDepartments } from "@/lib/departments-db";
import { findDepartment } from "@/lib/departments";
import {
    getRoundByToken,
    isSubmitRateLimited,
    logSubmitAttempt,
    normalizeMatric,
    normalizeName,
    type AcademicRound,
} from "@/lib/academics-db";
import {
    owesResults,
    parseGrade,
    semesterKey,
    semesterLabel,
    semestersSince,
    type Semester,
} from "@/lib/academics";

/**
 * /academics: a member submits a semester's GPA and CGPA through the round link.
 *
 * Public, like /profile. The round token only opens the page; the member is then
 * recognised by email + surname (+ matric number when one is on file). That is
 * recognition, not authentication (see src/lib/academics-db.ts), so:
 *   - every action re-checks the token AND the identity itself, and trusts nothing the
 *     browser kept from an earlier step;
 *   - existing grades are never sent back, only whether a semester is filled;
 *   - an earlier semester that's filled is locked (the Academic Unit corrects it);
 *   - one vague message for every identity failure, and failures are rate-limited.
 */

export interface RoundIdentity {
    email: string;
    surname: string;
    matric: string;
}

export interface ResultSlot {
    session: string;
    semester: Semester;
    label: string;
    /** The round's own semester. */
    current: boolean;
    /** Already has results. For the current semester, submitting again replaces them. */
    submitted: boolean;
}

const NOT_RECOGNISED =
    "We couldn't match those details to a member. Check your email, surname and matric number as they are on your fellowship record.";

type OpenRoundResult =
    | { valid: true; token: string; label: string; closesAt: string | null }
    | { valid: false; reason: string };

async function openRound(raw: string): Promise<{ round?: AcademicRound; reason?: string }> {
    const token = parseRoundTokenInput(raw);
    if (!token) return { reason: "That isn't a results round token. It looks like ACD-7KX2P." };
    const round = await getRoundByToken(token);
    if (!round) return { reason: "That round token doesn't exist. Check it with the Academic Unit." };
    if (!round.isOpen) return { reason: `The ${round.label} round has closed.` };
    return { round };
}

/** Public: check a round token (typed, or from the link) before asking who you are. */
export async function openRoundAction(raw: string): Promise<OpenRoundResult> {
    try {
        const { round, reason } = await openRound(raw);
        if (!round) return { valid: false, reason: reason! };
        return { valid: true, token: round.token, label: round.label, closesAt: round.closesAt };
    } catch {
        return { valid: false, reason: "Couldn't check that round. Try again." };
    }
}

interface Recognised {
    round: AcademicRound;
    profile: {
        id: string;
        first_name: string;
        department: string | null;
        class_set_id: string | null;
    };
    slots: ResultSlot[];
}

/**
 * The round, the member and the semesters they may fill, or an error. The shared
 * first half of both actions below.
 */
async function recognise(
    rawToken: string,
    identity: RoundIdentity,
): Promise<{ ok: true; data: Recognised } | { ok: false; error: string; rateLimited?: boolean }> {
    const { round, reason } = await openRound(rawToken);
    if (!round) return { ok: false, error: reason! };

    if (await isSubmitRateLimited()) {
        return { ok: false, rateLimited: true, error: "Too many attempts. Please wait about 15 minutes and try again." };
    }

    const profile = await findProfileByEmail<{
        id: string;
        email: string | null;
        first_name: string;
        last_name: string;
        matric_number: string | null;
        department: string | null;
        class_set_id: string | null;
    }>(identity.email ?? "", "id, email, first_name, last_name, matric_number, department, class_set_id");

    const matches =
        !!profile &&
        normalizeName(profile.last_name) === normalizeName(identity.surname) &&
        // A matric number on file must match. Freshers may not have one recorded yet.
        (!profile.matric_number || normalizeMatric(profile.matric_number) === normalizeMatric(identity.matric));

    if (!profile || !matches) {
        await logSubmitAttempt(identity.email ?? "", false);
        return { ok: false, error: NOT_RECOGNISED };
    }

    const { data: cs } = profile.class_set_id
        ? await db
            .from("class_sets")
            .select("entry_year, is_foundation, level_override")
            .eq("id", profile.class_set_id)
            .maybeSingle()
        : { data: null };

    if (!owesResults(cs, round.session)) {
        return {
            ok: false,
            error: "Your level doesn't submit results in this round (only 100 to 500 Level do). If that's wrong, tell your level coordinator.",
        };
    }

    const all = semestersSince(cs?.entry_year ?? null, round);
    const { data: existing } = await db
        .from("academic_records")
        .select("session, semester")
        .eq("profile_id", profile.id);
    const filled = new Set((existing ?? []).map((r) => semesterKey(r.session, r.semester)));

    const slots: ResultSlot[] = all
        .map((s) => ({
            session: s.session,
            semester: s.semester,
            label: semesterLabel(s.session, s.semester),
            current: s.session === round.session && s.semester === round.semester,
            submitted: filled.has(semesterKey(s.session, s.semester)),
        }))
        .reverse();

    return {
        ok: true,
        data: {
            round,
            profile: {
                id: profile.id,
                first_name: profile.first_name,
                department: profile.department,
                class_set_id: profile.class_set_id,
            },
            slots,
        },
    };
}

/** Public: confirm who you are, and see which semesters you can fill in. */
export async function identifyForRoundAction(rawToken: string, identity: RoundIdentity) {
    try {
        const res = await recognise(rawToken, identity);
        if (!res.ok) return res;
        const { round, profile, slots } = res.data;
        return {
            ok: true as const,
            firstName: profile.first_name,
            department: profile.department,
            roundLabel: round.label,
            slots,
        };
    } catch (e: any) {
        console.error("identifyForRoundAction:", e?.message);
        return { ok: false as const, error: "Something went wrong. Try again." };
    }
}

export interface ResultEntry {
    session: string;
    semester: number;
    gpa: string;
    cgpa: string;
}

/**
 * Public: save the round's semester (required, unless already submitted, in which case
 * this replaces it) plus any EMPTY earlier semesters, and optionally the department.
 */
export async function submitResultsAction(
    rawToken: string,
    identity: RoundIdentity,
    input: { entries: ResultEntry[]; department?: string },
) {
    try {
        const res = await recognise(rawToken, identity);
        if (!res.ok) return res;
        const { round, profile, slots } = res.data;
        const bySlot = new Map(slots.map((s) => [semesterKey(s.session, s.semester), s]));

        const rows: { session: string; semester: number; gpa: number; cgpa: number; current: boolean }[] = [];
        for (const e of input.entries ?? []) {
            const slot = bySlot.get(semesterKey(e.session, Number(e.semester)));
            // Only semesters this member may fill, and never a filled earlier one.
            if (!slot) return { ok: false as const, error: "One of those semesters isn't yours to fill." };
            if (slot.submitted && !slot.current) {
                return { ok: false as const, error: `${slot.label} is already recorded. Ask the Academic Unit to correct it.` };
            }
            const gpa = parseGrade(e.gpa);
            const cgpa = parseGrade(e.cgpa);
            if (gpa == null || cgpa == null) {
                return { ok: false as const, error: `${slot.label}: GPA and CGPA are numbers from 0 to 5, with up to two decimals.` };
            }
            rows.push({ session: slot.session, semester: slot.semester, gpa, cgpa, current: slot.current });
        }

        const current = slots.find((s) => s.current);
        if (current && !current.submitted && !rows.some((r) => r.current)) {
            return { ok: false as const, error: `Enter your GPA and CGPA for ${current.label}.` };
        }
        if (rows.length === 0) return { ok: false as const, error: "There's nothing to save." };

        // Department: optional here, but when sent it must be one on the list.
        if (input.department) {
            const dept = findDepartment(input.department, await getDepartments());
            if (!dept) return { ok: false as const, error: "Choose your department from the list." };
            if (dept.alias !== profile.department) {
                const { error } = await db.from("profiles").update({ department: dept.alias }).eq("id", profile.id);
                if (error) throw error;
            }
        }

        const now = new Date().toISOString();
        const currentRows = rows.filter((r) => r.current);
        const pastRows = rows.filter((r) => !r.current);

        if (currentRows.length) {
            const { error } = await db.from("academic_records").upsert(
                currentRows.map((r) => ({
                    profile_id: profile.id,
                    session: r.session,
                    semester: r.semester,
                    gpa: r.gpa,
                    cgpa: r.cgpa,
                    round_id: round.id,
                    source: "member",
                    submitted_at: now,
                    updated_by: null,
                })),
                { onConflict: "profile_id,session,semester" },
            );
            if (error) throw error;
        }
        if (pastRows.length) {
            // ignoreDuplicates: a semester filled between the check above and now stays
            // as it was. Earlier semesters are never overwritten from this page.
            const { error } = await db.from("academic_records").upsert(
                pastRows.map((r) => ({
                    profile_id: profile.id,
                    session: r.session,
                    semester: r.semester,
                    gpa: r.gpa,
                    cgpa: r.cgpa,
                    source: "member",
                    submitted_at: now,
                })),
                { onConflict: "profile_id,session,semester", ignoreDuplicates: true },
            );
            if (error) throw error;
        }

        await logSubmitAttempt(identity.email ?? "", true);
        return { ok: true as const, saved: rows.length, firstName: profile.first_name, roundLabel: round.label };
    } catch (e: any) {
        console.error("submitResultsAction:", e?.message);
        return { ok: false as const, error: "Couldn't save your results. Check your connection and try again." };
    }
}
