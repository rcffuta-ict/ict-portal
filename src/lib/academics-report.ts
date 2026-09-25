/**
 * One semester's academic report for a group of members: the whole fellowship (the
 * Academics module) or one unit's roster (Workforce → Academics). Pure: the caller
 * loads the rows and decides whether the viewer may see individuals.
 *
 * Client-safe types; the builder runs on the server.
 */
import {
    DEGREE_CLASSES,
    bySemester,
    classDistribution,
    classOf,
    mean,
    owesResults,
    riskReason,
    semesterKey,
    semesterLabel,
    type ClassCount,
} from "@/lib/academics";
import { computeLevel, byLevel } from "@/lib/levels";
import { departmentLabel, type DepartmentOption } from "@/lib/departments";
import { formatGender } from "@/lib/gender";

export interface ReportMember {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone_number: string | null;
    gender: string | null;
    department: string | null;
    faculty: string | null;
    class_set_id: string | null;
}

export interface ReportClassSet {
    entry_year: number | null;
    is_foundation: boolean | null;
    level_override: string | null;
}

export interface ReportRecord {
    profileId: string;
    session: string;
    semester: number;
    gpa: number;
    cgpa: number;
}

export interface BreakdownRow {
    key: string;
    label: string;
    count: number;
    meanCgpa: number | null;
}

export interface TrendPoint {
    key: string;
    label: string;
    count: number;
    meanCgpa: number | null;
}

/** A member who submitted, as a row. */
export interface ResultRow {
    profileId: string;
    name: string;
    email: string | null;
    phone: string | null;
    level: string | null;
    department: string | null;
    unit: string | null;
    gpa: number;
    cgpa: number;
    classLabel: string;
    risk: string | null;
}

/** A member who owes results and hasn't sent them. */
export interface OutstandingRow {
    profileId: string;
    name: string;
    email: string | null;
    phone: string | null;
    level: string | null;
    department: string | null;
    unit: string | null;
}

export interface SemesterReport {
    session: string;
    semester: number;
    label: string;
    eligible: number;
    submitted: number;
    meanCgpa: number | null;
    meanGpa: number | null;
    atRisk: number;
    distribution: ClassCount[];
    byLevel: BreakdownRow[];
    byDepartment: BreakdownRow[];
    byFaculty: BreakdownRow[];
    byGender: BreakdownRow[];
    trend: TrendPoint[];
    /** Only when the viewer may see individual results; null otherwise. */
    results: ResultRow[] | null;
    /** Only when the viewer may see individuals; null otherwise. */
    outstanding: OutstandingRow[] | null;
}

function breakdown(
    rows: { key: string; label: string; cgpa: number }[],
    sort?: (a: BreakdownRow, b: BreakdownRow) => number,
): BreakdownRow[] {
    const groups = new Map<string, { label: string; cgpas: number[] }>();
    for (const r of rows) {
        const g = groups.get(r.key) ?? { label: r.label, cgpas: [] };
        g.cgpas.push(r.cgpa);
        groups.set(r.key, g);
    }
    const out = [...groups.entries()].map(([key, g]) => ({
        key,
        label: g.label,
        count: g.cgpas.length,
        meanCgpa: mean(g.cgpas),
    }));
    return out.sort(sort ?? ((a, b) => (b.meanCgpa ?? 0) - (a.meanCgpa ?? 0) || b.count - a.count));
}

export function buildSemesterReport(input: {
    session: string;
    semester: number;
    members: ReportMember[];
    classSets: Map<string, ReportClassSet>;
    /** Every record of these members, all semesters (the trend needs them). */
    records: ReportRecord[];
    departments: DepartmentOption[];
    facultyNames: Map<string, string>;
    /** profile id → their unit's name, for the lists' unit filter. */
    unitOf?: Map<string, string>;
    includeIndividuals: boolean;
}): SemesterReport {
    const { session, semester, members, classSets, records, departments, facultyNames } = input;
    const levelOf = (m: ReportMember) => {
        const cs = m.class_set_id ? classSets.get(m.class_set_id) : null;
        return cs ? cs.level_override || computeLevel(cs.entry_year, cs.is_foundation, session) : null;
    };
    const nameOf = (m: ReportMember) => `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim();

    const memberById = new Map(members.map((m) => [m.id, m]));
    const own = records.filter((r) => memberById.has(r.profileId));
    const thisKey = semesterKey(session, semester);
    const current = own.filter((r) => semesterKey(r.session, r.semester) === thisKey);
    const submittedIds = new Set(current.map((r) => r.profileId));

    // Owed = 100 to 500 Level in this session. Someone who submitted counts as eligible
    // even if their level says otherwise (a coordinator entry, a level override).
    const eligibleMembers = members.filter(
        (m) => submittedIds.has(m.id) || owesResults(m.class_set_id ? classSets.get(m.class_set_id) : null, session),
    );

    // The member's latest record before this semester, for the GPA-drop flag.
    const history = new Map<string, ReportRecord[]>();
    for (const r of own) history.set(r.profileId, [...(history.get(r.profileId) ?? []), r]);
    for (const list of history.values()) list.sort(bySemester);
    const previousOf = (r: ReportRecord) => {
        const list = history.get(r.profileId) ?? [];
        const i = list.findIndex((x) => semesterKey(x.session, x.semester) === thisKey);
        return i > 0 ? list[i - 1] : null;
    };

    const tagged = current.map((r) => {
        const m = memberById.get(r.profileId)!;
        const dept = departmentLabel(m.department, departments);
        return {
            r,
            m,
            level: levelOf(m),
            dept,
            risk: riskReason(r, previousOf(r)),
        };
    });

    const cgpas = current.map((r) => r.cgpa);

    // The trend: every semester this group has records for, oldest first, last eight.
    const perSemester = new Map<string, { session: string; semester: number; cgpas: number[] }>();
    for (const r of own) {
        const k = semesterKey(r.session, r.semester);
        const g = perSemester.get(k) ?? { session: r.session, semester: r.semester, cgpas: [] };
        g.cgpas.push(r.cgpa);
        perSemester.set(k, g);
    }
    const trend = [...perSemester.entries()]
        .map(([key, g]) => ({ key, session: g.session, semester: g.semester, cgpas: g.cgpas }))
        .sort(bySemester)
        .slice(-8)
        .map((g) => ({ key: g.key, label: semesterLabel(g.session, g.semester), count: g.cgpas.length, meanCgpa: mean(g.cgpas) }));

    const unitOf = input.unitOf ?? new Map<string, string>();

    return {
        session,
        semester,
        label: semesterLabel(session, semester),
        eligible: eligibleMembers.length,
        submitted: current.length,
        meanCgpa: mean(cgpas),
        meanGpa: mean(current.map((r) => r.gpa)),
        atRisk: tagged.filter((t) => t.risk).length,
        distribution: classDistribution(cgpas),
        byLevel: breakdown(
            tagged.map((t) => ({ key: t.level ?? "unknown", label: t.level ?? "Unknown level", cgpa: t.r.cgpa })),
            (a, b) => byLevel(a.key === "unknown" ? null : a.key, b.key === "unknown" ? null : b.key),
        ),
        byDepartment: breakdown(
            tagged.map((t) => ({ key: t.dept ?? "unknown", label: t.dept ?? "Not recorded", cgpa: t.r.cgpa })),
        ),
        byFaculty: breakdown(
            tagged.map((t) => {
                const code = t.m.faculty ?? "";
                return { key: code || "unknown", label: facultyNames.get(code) ?? (code || "Not recorded"), cgpa: t.r.cgpa };
            }),
        ),
        byGender: breakdown(
            tagged.map((t) => ({ key: t.m.gender ?? "unknown", label: formatGender(t.m.gender), cgpa: t.r.cgpa })),
        ),
        trend,
        results: input.includeIndividuals
            ? tagged
                .map((t) => ({
                    profileId: t.m.id,
                    name: nameOf(t.m),
                    email: t.m.email,
                    phone: t.m.phone_number,
                    level: t.level,
                    department: t.dept,
                    unit: unitOf.get(t.m.id) ?? null,
                    gpa: t.r.gpa,
                    cgpa: t.r.cgpa,
                    classLabel: classOf(t.r.cgpa)?.label ?? DEGREE_CLASSES[DEGREE_CLASSES.length - 1].label,
                    risk: t.risk,
                }))
                .sort((a, b) => b.cgpa - a.cgpa || a.name.localeCompare(b.name))
            : null,
        outstanding: input.includeIndividuals
            ? eligibleMembers
                .filter((m) => !submittedIds.has(m.id))
                .map((m) => ({
                    profileId: m.id,
                    name: nameOf(m),
                    email: m.email,
                    phone: m.phone_number,
                    level: levelOf(m),
                    department: departmentLabel(m.department, departments),
                    unit: unitOf.get(m.id) ?? null,
                }))
                .sort((a, b) => byLevel(a.level, b.level) || a.name.localeCompare(b.name))
            : null,
    };
}

/** One row of a full-record export: a member and one semester of theirs. */
export interface RecordExportRow {
    name: string;
    matric: string | null;
    email: string | null;
    phone: string | null;
    gender: string;
    level: string | null;
    department: string | null;
    faculty: string | null;
    semester: string;
    gpa: string;
    cgpa: string;
    classLabel: string;
}

/**
 * Every semester on record for these members, member by member, oldest semester first.
 * What a unit head or level coordinator hands to the authorities. Members with no
 * results yet still appear once, with the grade columns blank, so the list is complete.
 */
export function recordExportRows(input: {
    members: (ReportMember & { matric_number: string | null })[];
    classSets: Map<string, ReportClassSet>;
    records: ReportRecord[];
    departments: DepartmentOption[];
    facultyNames: Map<string, string>;
    session: string | null;
}): RecordExportRow[] {
    const bySet = new Map<string, ReportRecord[]>();
    for (const r of input.records) bySet.set(r.profileId, [...(bySet.get(r.profileId) ?? []), r]);
    const rows: RecordExportRow[] = [];
    const sorted = [...input.members].sort((a, b) =>
        `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`),
    );
    for (const m of sorted) {
        const cs = m.class_set_id ? input.classSets.get(m.class_set_id) : null;
        const base = {
            name: `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim(),
            matric: m.matric_number,
            email: m.email,
            phone: m.phone_number,
            gender: formatGender(m.gender),
            level: cs ? cs.level_override || computeLevel(cs.entry_year, cs.is_foundation, input.session) : null,
            department: departmentLabel(m.department, input.departments),
            faculty: m.faculty ? (input.facultyNames.get(m.faculty) ?? m.faculty) : null,
        };
        const list = (bySet.get(m.id) ?? []).sort(bySemester);
        if (list.length === 0) {
            rows.push({ ...base, semester: "No results yet", gpa: "", cgpa: "", classLabel: "" });
            continue;
        }
        for (const r of list) {
            rows.push({
                ...base,
                semester: semesterLabel(r.session, r.semester),
                gpa: r.gpa.toFixed(2),
                cgpa: r.cgpa.toFixed(2),
                classLabel: classOf(r.cgpa)?.label ?? "",
            });
        }
    }
    return rows;
}
