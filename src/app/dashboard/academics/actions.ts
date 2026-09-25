/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { fetchAll } from "@/lib/fetch-all";
import { requireModuleRead, requireModuleWrite } from "@/lib/access-control";
import { canWriteModule, getModuleAccessConfig } from "@/lib/module-access";
import type { ProfileContext } from "@/lib/auth/profile-context";
import { getActiveTenure } from "@/utils/action";
import { getDepartments, getFaculties } from "@/lib/departments-db";
import {
    classSetsById,
    getAcademicSettings,
    getRoundById,
    insertRound,
    listRounds,
    loadMembers,
    loadRecords,
    type AcademicSettings,
} from "@/lib/academics-db";
import { buildSemesterReport } from "@/lib/academics-report";
import { computeLevel } from "@/lib/levels";
import {
    bySemester,
    classOf,
    isValidSession,
    owesResults,
    parseGrade,
    semesterKey,
    semesterLabel,
} from "@/lib/academics";
import { departmentLabel } from "@/lib/departments";

/**
 * The Academics module (/dashboard/academics).
 *
 * Every read: `requireModuleRead("academics")`. Every change: `requireModuleWrite`,
 * which refuses the President and lets the System Admin and VP Admin through, as for
 * every module. By default the Academic Coord (EXCO:academic) holds both; Settings can
 * widen it. Everyone who can read here sees individual results: that's the module.
 * Who sees them ELSEWHERE is academic_settings, which the writers here decide.
 */

const PATH = "/dashboard/academics";

async function canWrite(ctx: ProfileContext): Promise<boolean> {
    return canWriteModule(ctx, "academics", await getModuleAccessConfig());
}

function actorName(ctx: ProfileContext): string | null {
    return [ctx.profile.firstName, ctx.profile.lastName].filter(Boolean).join(" ") || null;
}

/** Append to admin_audit_log. Never fails the change it records. */
async function audit(
    ctx: ProfileContext,
    action: string,
    entry: { targetId?: string | null; targetName?: string | null; field?: string; from?: unknown; to?: unknown },
) {
    const { error } = await db.from("admin_audit_log").insert({
        actor_profile_id: ctx.profile.id,
        actor_name: actorName(ctx),
        target_profile_id: entry.targetId ?? null,
        target_name: entry.targetName ?? null,
        action,
        field: entry.field ?? null,
        old_value: entry.from == null ? null : String(entry.from),
        new_value: entry.to == null ? null : String(entry.to),
    });
    if (error) console.error("academics audit failed:", error.message);
}

function fail(e: any) {
    return { success: false as const, error: e?.message || "Something went wrong." };
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

export async function getAcademicsHomeAction() {
    try {
        const ctx = await requireModuleRead("academics");
        const [rounds, settings, tenure, writable] = await Promise.all([
            listRounds(),
            getAcademicSettings(),
            getActiveTenure(),
            canWrite(ctx),
        ]);
        return {
            authorized: true as const,
            canWrite: writable,
            rounds,
            settings,
            activeSession: tenure?.session ?? null,
        };
    } catch {
        return { authorized: false as const };
    }
}

/**
 * The semesters a report can be about: every round, plus any semester that has
 * records without one (backfill, coordinator entries), newest first.
 */
export async function listReportSemestersAction() {
    try {
        await requireModuleRead("academics");
        const [rounds, data] = await Promise.all([
            listRounds(),
            fetchAll<{ session: string; semester: number }>((from, to) =>
                db.from("academic_records").select("session, semester").order("id").range(from, to) as never,
            ),
        ]);
        const seen = new Map<string, { session: string; semester: number; label: string }>();
        for (const r of rounds) seen.set(semesterKey(r.session, r.semester), { session: r.session, semester: r.semester, label: r.label });
        for (const r of data ?? []) {
            const k = semesterKey(r.session, r.semester);
            if (!seen.has(k)) seen.set(k, { session: r.session, semester: r.semester, label: semesterLabel(r.session, r.semester) });
        }
        return { success: true as const, data: [...seen.values()].sort(bySemester).reverse() };
    } catch (e) {
        return { ...fail(e), data: [] };
    }
}

/** profile id → the unit (not team) they serve in this tenure. */
async function unitNamesThisTenure(): Promise<Map<string, string>> {
    const tenure = await getActiveTenure();
    if (!tenure) return new Map();
    // Paged: a whole tenure's memberships can pass the API's silent 1000-row cap.
    const data = await fetchAll<any>((from, to) =>
        db.from("membership_units")
            .select("id, profile_id, unit:units!inner(name, type)")
            .eq("tenure_id", tenure.id)
            .eq("unit.type", "UNIT")
            .order("id")
            .range(from, to) as never,
    );
    const map = new Map<string, string>();
    for (const row of data) {
        const unit = Array.isArray(row.unit) ? row.unit[0] : row.unit;
        if (unit?.name) map.set(row.profile_id, unit.name);
    }
    return map;
}

/** The fellowship-wide report for one semester, with names (this is the module). */
export async function getSemesterReportAction(session: string, semester: number) {
    try {
        await requireModuleRead("academics");
        if (!isValidSession(session) || (semester !== 1 && semester !== 2)) {
            return { success: false as const, error: "Pick a semester." };
        }
        const [members, classSets, records, departments, faculties, unitOf] = await Promise.all([
            loadMembers(),
            classSetsById(),
            loadRecords(),
            getDepartments(true),
            getFaculties(),
            unitNamesThisTenure(),
        ]);
        return {
            success: true as const,
            data: buildSemesterReport({
                session,
                semester,
                members,
                classSets,
                records,
                departments,
                facultyNames: new Map(faculties.map((f) => [f.code, f.name])),
                unitOf,
                includeIndividuals: true,
            }),
        };
    } catch (e) {
        return fail(e);
    }
}

// ---------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------

export async function openResultsRoundAction(input: { session: string; semester: number; closesAt?: string | null }) {
    try {
        const ctx = await requireModuleWrite("academics");
        const session = (input.session ?? "").trim();
        if (!isValidSession(session)) return { success: false as const, error: "The session looks like 2025/2026." };
        if (input.semester !== 1 && input.semester !== 2) return { success: false as const, error: "Pick the first or second semester." };
        let closesAt: string | null = null;
        if (input.closesAt) {
            const d = new Date(input.closesAt);
            if (Number.isNaN(d.getTime())) return { success: false as const, error: "That closing date isn't a date." };
            closesAt = d.toISOString();
        }
        const res = await insertRound({ session, semester: input.semester, closesAt, createdBy: ctx.profile.id });
        if (!res.round) return { success: false as const, error: res.error ?? "Couldn't open the round." };
        await audit(ctx, "academics.round_opened", { field: "round", to: res.round.label });
        revalidatePath(PATH);
        return { success: true as const, round: res.round };
    } catch (e) {
        return fail(e);
    }
}

export async function setRoundOpenAction(roundId: string, open: boolean) {
    try {
        const ctx = await requireModuleWrite("academics");
        const round = await getRoundById(roundId);
        if (!round) return { success: false as const, error: "That round no longer exists." };
        const { error } = await db
            .from("academic_rounds")
            .update({ closed_at: open ? null : new Date().toISOString() })
            .eq("id", roundId);
        if (error) {
            if (error.code === "23505") return { success: false as const, error: "Another round is still open. Close it first." };
            throw error;
        }
        await audit(ctx, open ? "academics.round_reopened" : "academics.round_closed", { field: "round", to: round.label });
        revalidatePath(PATH);
        return { success: true as const };
    } catch (e) {
        return fail(e);
    }
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

/**
 * Everyone the Records tab lists: members who are 100 to 500 Level this session, or
 * who have any record. One compact row each, with their latest CGPA.
 */
export async function getRecordsIndexAction() {
    try {
        await requireModuleRead("academics");
        const tenure = await getActiveTenure();
        const session = tenure?.session ?? null;
        const [members, classSets, records, departments, unitOf] = await Promise.all([
            loadMembers(),
            classSetsById(),
            loadRecords(),
            getDepartments(true),
            unitNamesThisTenure(),
        ]);
        const byMember = new Map<string, typeof records>();
        for (const r of records) byMember.set(r.profileId, [...(byMember.get(r.profileId) ?? []), r]);

        const rows = members
            .filter((m) => byMember.has(m.id) || (session && owesResults(m.class_set_id ? classSets.get(m.class_set_id) : null, session)))
            .map((m) => {
                const cs = m.class_set_id ? classSets.get(m.class_set_id) : null;
                const list = (byMember.get(m.id) ?? []).sort(bySemester);
                const latest = list[list.length - 1] ?? null;
                return {
                    id: m.id,
                    name: `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim(),
                    email: m.email,
                    phone: m.phone_number,
                    matric: m.matric_number,
                    gender: m.gender,
                    avatarUrl: m.avatar_url,
                    level: cs ? cs.level_override || computeLevel(cs.entry_year, cs.is_foundation, session) : null,
                    department: departmentLabel(m.department, departments),
                    unit: unitOf.get(m.id) ?? null,
                    semesters: list.length,
                    latestLabel: latest ? semesterLabel(latest.session, latest.semester) : null,
                    latestGpa: latest?.gpa ?? null,
                    latestCgpa: latest?.cgpa ?? null,
                    classLabel: latest ? (classOf(latest.cgpa)?.label ?? null) : null,
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
        return { success: true as const, data: rows };
    } catch (e) {
        return { ...fail(e), data: [] };
    }
}

/** One member's semester history, oldest first. */
export async function getMemberHistoryAction(profileId: string) {
    try {
        await requireModuleRead("academics");
        const { data: p } = await db
            .from("profiles")
            .select("id, first_name, last_name, class_set_id")
            .eq("id", profileId)
            .maybeSingle();
        if (!p) return { success: false as const, error: "That member no longer exists." };
        const records = (await loadRecords([profileId])).sort(bySemester);
        return {
            success: true as const,
            member: { id: p.id as string, name: `${p.first_name} ${p.last_name}` },
            records: records.map((r) => ({
                id: r.id,
                session: r.session,
                semester: r.semester,
                label: semesterLabel(r.session, r.semester),
                gpa: r.gpa,
                cgpa: r.cgpa,
                source: r.source,
                updatedAt: r.updatedAt,
            })),
        };
    } catch (e) {
        return fail(e);
    }
}

/** Add or correct one semester for a member. Recorded as the coordinator's entry. */
export async function saveMemberRecordAction(input: {
    profileId: string;
    session: string;
    semester: number;
    gpa: string;
    cgpa: string;
}) {
    try {
        const ctx = await requireModuleWrite("academics");
        const session = (input.session ?? "").trim();
        if (!isValidSession(session)) return { success: false as const, error: "The session looks like 2025/2026." };
        if (input.semester !== 1 && input.semester !== 2) return { success: false as const, error: "Pick the first or second semester." };
        const gpa = parseGrade(input.gpa);
        const cgpa = parseGrade(input.cgpa);
        if (gpa == null || cgpa == null) {
            return { success: false as const, error: "GPA and CGPA are numbers from 0 to 5, with up to two decimals." };
        }
        const { data: p } = await db.from("profiles").select("id, first_name, last_name").eq("id", input.profileId).maybeSingle();
        if (!p) return { success: false as const, error: "That member no longer exists." };

        const { data: before } = await db
            .from("academic_records")
            .select("gpa, cgpa")
            .eq("profile_id", p.id)
            .eq("session", session)
            .eq("semester", input.semester)
            .maybeSingle();

        const { error } = await db.from("academic_records").upsert(
            {
                profile_id: p.id,
                session,
                semester: input.semester,
                gpa,
                cgpa,
                source: "coordinator",
                updated_by: ctx.profile.id,
            },
            { onConflict: "profile_id,session,semester" },
        );
        if (error) throw error;

        await audit(ctx, "academics.record_saved", {
            targetId: p.id,
            targetName: `${p.first_name} ${p.last_name}`,
            field: semesterLabel(session, input.semester),
            from: before ? `GPA ${before.gpa} / CGPA ${before.cgpa}` : null,
            to: `GPA ${gpa.toFixed(2)} / CGPA ${cgpa.toFixed(2)}`,
        });
        return { success: true as const };
    } catch (e) {
        return fail(e);
    }
}

export async function deleteMemberRecordAction(recordId: string) {
    try {
        const ctx = await requireModuleWrite("academics");
        const { data: rec } = await db
            .from("academic_records")
            .select("id, session, semester, gpa, cgpa, profile:profiles(id, first_name, last_name)")
            .eq("id", recordId)
            .maybeSingle();
        if (!rec) return { success: false as const, error: "That record no longer exists." };
        const { error } = await db.from("academic_records").delete().eq("id", recordId);
        if (error) throw error;
        const p: any = Array.isArray(rec.profile) ? rec.profile[0] : rec.profile;
        await audit(ctx, "academics.record_deleted", {
            targetId: p?.id ?? null,
            targetName: p ? `${p.first_name} ${p.last_name}` : null,
            field: semesterLabel(rec.session, rec.semester),
            from: `GPA ${rec.gpa} / CGPA ${rec.cgpa}`,
        });
        return { success: true as const };
    } catch (e) {
        return fail(e);
    }
}

/**
 * Every record, one row per member per semester, for the CSV export of all
 * semesters. (The latest-per-member export is built from the Records tab's list.)
 */
export async function exportAllRecordsAction(profileIds: string[]) {
    try {
        await requireModuleRead("academics");
        const ids = [...new Set((profileIds ?? []).filter((x) => typeof x === "string"))].slice(0, 5000);
        const records = (await loadRecords(ids)).sort(
            (a, b) => a.profileId.localeCompare(b.profileId) || bySemester(a, b),
        );
        return {
            success: true as const,
            data: records.map((r) => ({
                profileId: r.profileId,
                label: semesterLabel(r.session, r.semester),
                session: r.session,
                semester: r.semester,
                gpa: r.gpa,
                cgpa: r.cgpa,
                classLabel: classOf(r.cgpa)?.label ?? "",
                source: r.source,
            })),
        };
    } catch (e) {
        return { ...fail(e), data: [] };
    }
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export async function getDepartmentsAdminAction() {
    try {
        await requireModuleRead("academics");
        const [departments, faculties, linked, unmatched] = await Promise.all([
            getDepartments(true),
            getFaculties(),
            fetchAll<{ department_id: string }>((from, to) =>
                db.from("profiles").select("department_id").not("department_id", "is", null)
                    .order("id").range(from, to) as never,
            ),
            unmatchedDepartmentTexts(),
        ]);
        const countMap = new Map<string, number>();
        for (const r of linked) countMap.set(r.department_id, (countMap.get(r.department_id) ?? 0) + 1);
        return {
            success: true as const,
            departments: departments.map((d) => ({ ...d, members: countMap.get(d.id) ?? 0 })),
            faculties,
            unmatched,
        };
    } catch (e) {
        return { ...fail(e), departments: [], faculties: [], unmatched: [] };
    }
}

/** Free-text departments no department matched, with how many members hold each. */
async function unmatchedDepartmentTexts(): Promise<{ text: string; members: number }[]> {
    const data = await fetchAll<{ department: string }>((from, to) =>
        db.from("profiles")
            .select("department")
            .is("department_id", null)
            .not("department", "is", null)
            .order("id")
            .range(from, to) as never,
    );
    const counts = new Map<string, number>();
    for (const r of data) {
        const t = (r.department as string).trim();
        if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()].map(([text, members]) => ({ text, members })).sort((a, b) => b.members - a.members);
}

const ALIAS_RE = /^[A-Z]{2,10}$/;

function cleanDepartment(input: { alias: string; name: string; facultyCode: string }) {
    const alias = (input.alias ?? "").trim().toUpperCase();
    const name = (input.name ?? "").trim().replace(/\s+/g, " ");
    const facultyCode = (input.facultyCode ?? "").trim().toUpperCase();
    if (!ALIAS_RE.test(alias)) return { error: "The code is 2 to 10 letters, e.g. CSC." };
    if (name.length < 3) return { error: "Enter the department's full name." };
    if (!facultyCode) return { error: "Pick the school it's under." };
    return { alias, name, facultyCode };
}

function friendlyDbError(error: { code?: string; message: string }): string {
    if (error.code === "23505") {
        return error.message.includes("name") ? "A department with that name already exists." : "That code is already used.";
    }
    if (error.code === "23503") return "Pick a school from the list.";
    return error.message;
}

export async function createDepartmentAction(input: { alias: string; name: string; facultyCode: string }) {
    try {
        const ctx = await requireModuleWrite("academics");
        const clean = cleanDepartment(input);
        if ("error" in clean) return { success: false as const, error: clean.error };
        const { error } = await db
            .from("departments")
            .insert({ alias: clean.alias, name: clean.name, faculty_code: clean.facultyCode });
        if (error) return { success: false as const, error: friendlyDbError(error) };
        await audit(ctx, "academics.department_created", { field: clean.alias, to: clean.name });
        return { success: true as const };
    } catch (e) {
        return fail(e);
    }
}

/**
 * Rename or move a department. Its course code is what members' records store, so a
 * code change rewrites their `department` text too (through the sync trigger, by
 * touching department_id).
 */
export async function updateDepartmentAction(id: string, input: { alias: string; name: string; facultyCode: string }) {
    try {
        const ctx = await requireModuleWrite("academics");
        const clean = cleanDepartment(input);
        if ("error" in clean) return { success: false as const, error: clean.error };
        const { data: before } = await db.from("departments").select("alias, name, faculty_code").eq("id", id).maybeSingle();
        if (!before) return { success: false as const, error: "That department no longer exists." };
        const { error } = await db
            .from("departments")
            .update({ alias: clean.alias, name: clean.name, faculty_code: clean.facultyCode })
            .eq("id", id);
        if (error) return { success: false as const, error: friendlyDbError(error) };

        if (before.alias !== clean.alias || before.faculty_code !== clean.facultyCode) {
            // Re-point members at the department so the trigger rewrites their text.
            const { error: e2 } = await db
                .from("profiles")
                .update({ department: clean.alias, faculty: clean.facultyCode })
                .eq("department_id", id);
            if (e2) throw e2;
        }
        await audit(ctx, "academics.department_updated", {
            field: before.alias,
            from: `${before.alias} · ${before.name} · ${before.faculty_code}`,
            to: `${clean.alias} · ${clean.name} · ${clean.facultyCode}`,
        });
        return { success: true as const };
    } catch (e) {
        return fail(e);
    }
}

export async function setDepartmentActiveAction(id: string, active: boolean) {
    try {
        const ctx = await requireModuleWrite("academics");
        const { data, error } = await db
            .from("departments")
            .update({ is_active: active })
            .eq("id", id)
            .select("alias")
            .maybeSingle();
        if (error) throw error;
        if (!data) return { success: false as const, error: "That department no longer exists." };
        await audit(ctx, active ? "academics.department_restored" : "academics.department_retired", { field: data.alias });
        return { success: true as const };
    } catch (e) {
        return fail(e);
    }
}

export async function saveFacultyAction(input: { code: string; name: string; isNew: boolean }) {
    try {
        const ctx = await requireModuleWrite("academics");
        const code = (input.code ?? "").trim().toUpperCase();
        const name = (input.name ?? "").trim().replace(/\s+/g, " ");
        if (!ALIAS_RE.test(code)) return { success: false as const, error: "The code is 2 to 10 letters, e.g. SOC." };
        if (name.length < 3) return { success: false as const, error: "Enter the school's full name." };
        const { error } = input.isNew
            ? await db.from("faculties").insert({ code, name })
            : await db.from("faculties").update({ name }).eq("code", code);
        if (error) {
            return { success: false as const, error: error.code === "23505" ? "That code is already used." : error.message };
        }
        await audit(ctx, input.isNew ? "academics.faculty_created" : "academics.faculty_renamed", { field: code, to: name });
        return { success: true as const };
    } catch (e) {
        return fail(e);
    }
}

/** Link every member whose free-text department is exactly `text` to a department. */
export async function linkDepartmentTextAction(text: string, departmentId: string) {
    try {
        const ctx = await requireModuleWrite("academics");
        const { data: dept } = await db.from("departments").select("id, alias").eq("id", departmentId).maybeSingle();
        if (!dept) return { success: false as const, error: "Pick a department from the list." };
        const { data, error } = await db
            .from("profiles")
            .update({ department_id: dept.id })
            .eq("department", text)
            .is("department_id", null)
            .select("id");
        if (error) throw error;
        await audit(ctx, "academics.department_linked", { field: dept.alias, from: text, to: `${data?.length ?? 0} member(s)` });
        return { success: true as const, linked: data?.length ?? 0 };
    } catch (e) {
        return fail(e);
    }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function updateAcademicSettingsAction(input: Omit<AcademicSettings, "updatedAt">) {
    try {
        const ctx = await requireModuleWrite("academics");
        const before = await getAcademicSettings();
        const next = {
            unit_heads_see_individuals: !!input.unitHeadsSeeIndividuals,
            level_coords_see_individuals: !!input.levelCoordsSeeIndividuals,
            members_see_own: !!input.membersSeeOwn,
        };
        const { error } = await db
            .from("academic_settings")
            .upsert({ id: true, ...next, updated_by: ctx.profile.id }, { onConflict: "id" });
        if (error) throw error;
        const changes: [string, boolean, boolean][] = [
            ["unit_heads_see_individuals", before.unitHeadsSeeIndividuals, next.unit_heads_see_individuals],
            ["level_coords_see_individuals", before.levelCoordsSeeIndividuals, next.level_coords_see_individuals],
            ["members_see_own", before.membersSeeOwn, next.members_see_own],
        ];
        for (const [field, from, to] of changes) {
            if (from !== to) await audit(ctx, "academics.settings_changed", { field, from, to });
        }
        revalidatePath(PATH);
        return { success: true as const };
    } catch (e) {
        return fail(e);
    }
}
