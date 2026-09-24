/**
 * Academics: the grading scale, semesters and who owes results. Client-safe (no db).
 *
 * FUTA grades on a 5-point scale. A member reports two numbers per semester:
 *   GPA   how that semester went on its own;
 *   CGPA  their running standing after it, which decides the class of degree.
 *
 * A semester is identified by its academic SESSION ("2025/2026") and its number:
 * 1 = Harmattan (first), 2 = Rain (second). The academic session is the university's,
 * and is not the fellowship's tenure, even though the two usually share a label.
 */
import { computeLevel, sessionStartYear } from "@/lib/levels";

export type Semester = 1 | 2;

export const SEMESTER_NAMES: Record<Semester, string> = {
    1: "Harmattan",
    2: "Rain",
};

export const MAX_GRADE = 5;

/** A 5-point-scale class band. `min` is inclusive; bands are listed best first. */
export interface DegreeClass {
    id: "first" | "second-upper" | "second-lower" | "third" | "pass" | "probation";
    label: string;
    short: string;
    min: number;
    /** Tailwind classes for a bar or pill. */
    tone: string;
}

export const DEGREE_CLASSES: DegreeClass[] = [
    { id: "first", label: "First Class", short: "1st", min: 4.5, tone: "bg-emerald-500 text-emerald-700" },
    { id: "second-upper", label: "Second Class Upper", short: "2:1", min: 3.5, tone: "bg-sky-500 text-sky-700" },
    { id: "second-lower", label: "Second Class Lower", short: "2:2", min: 2.4, tone: "bg-indigo-400 text-indigo-700" },
    { id: "third", label: "Third Class", short: "3rd", min: 1.5, tone: "bg-amber-500 text-amber-700" },
    { id: "pass", label: "Pass", short: "Pass", min: 1.0, tone: "bg-orange-500 text-orange-700" },
    { id: "probation", label: "Probation", short: "Prob.", min: 0, tone: "bg-red-500 text-red-700" },
];

/** A CGPA under this is flagged as at risk. The bottom of Second Class Lower. */
export const AT_RISK_CGPA = 2.4;
/** A GPA this much lower than the member's previous semester is flagged. */
export const GPA_DROP_ALERT = 0.5;

export function classOf(cgpa: number | null | undefined): DegreeClass | null {
    if (cgpa == null || Number.isNaN(cgpa)) return null;
    return DEGREE_CLASSES.find((c) => cgpa >= c.min) ?? DEGREE_CLASSES[DEGREE_CLASSES.length - 1];
}

/** Two decimal places, the way a result slip shows it. */
export function formatGrade(value: number | null | undefined): string {
    return value == null || Number.isNaN(value) ? "—" : value.toFixed(2);
}

/**
 * A grade as typed ("4.5", "4.50", "3") → number, or null if it isn't one. At most two
 * decimal places, 0 to 5. The same check runs in the browser and on the server.
 */
export function parseGrade(raw: unknown): number | null {
    const t = String(raw ?? "").trim().replace(",", ".");
    if (!/^\d(\.\d{1,2})?$/.test(t)) return null;
    const n = Number(t);
    return n >= 0 && n <= MAX_GRADE ? n : null;
}

// ---------------------------------------------------------------------------
// Sessions and semesters
// ---------------------------------------------------------------------------

export function isValidSession(session: string): boolean {
    const m = /^(\d{4})\/(\d{4})$/.exec(session);
    return !!m && Number(m[2]) === Number(m[1]) + 1;
}

/** 2025 → "2025/2026". */
export function sessionFor(startYear: number): string {
    return `${startYear}/${startYear + 1}`;
}

export function semesterLabel(session: string, semester: number): string {
    return `${session} · ${SEMESTER_NAMES[semester as Semester] ?? `Semester ${semester}`}`;
}

/** A stable key for maps and React lists. */
export function semesterKey(session: string, semester: number): string {
    return `${session}#${semester}`;
}

/** An ordinal for sorting: later semesters are larger. */
export function semesterOrdinal(session: string, semester: number): number {
    return (sessionStartYear(session) ?? 0) * 2 + (semester - 1);
}

export function bySemester(
    a: { session: string; semester: number },
    b: { session: string; semester: number },
): number {
    return semesterOrdinal(a.session, a.semester) - semesterOrdinal(b.session, b.semester);
}

/**
 * Every semester from a member's entry up to and including `upto`, oldest first. A
 * degree is at most five years, so it never reaches back more than ten semesters.
 */
export function semestersSince(
    entryYear: number | null | undefined,
    upto: { session: string; semester: number },
): { session: string; semester: Semester }[] {
    const end = sessionStartYear(upto.session);
    if (entryYear == null || end == null) return [];
    const out: { session: string; semester: Semester }[] = [];
    for (let y = Math.max(entryYear, end - 4); y <= end; y++) {
        for (const s of [1, 2] as Semester[]) {
            if (y === end && s > upto.semester) break;
            out.push({ session: sessionFor(y), semester: s });
        }
    }
    return out;
}

/**
 * Whether a member owes results for a session: 100 to 500 Level in it. Foundation
 * (PDS/UABS), not-yet-100 and Alumni members are not asked.
 */
export function owesResults(
    classSet: { entry_year: number | null; is_foundation: boolean | null; level_override?: string | null } | null | undefined,
    session: string,
): boolean {
    if (!classSet) return false;
    const level = classSet.level_override || computeLevel(classSet.entry_year, classSet.is_foundation, session);
    return !!level && /^[1-5]00 Level$/.test(level);
}

// ---------------------------------------------------------------------------
// Summaries (pure, so the module page and the Workforce tab agree)
// ---------------------------------------------------------------------------

export interface GradeRow {
    profileId: string;
    session: string;
    semester: number;
    gpa: number;
    cgpa: number;
}

export interface ClassCount {
    id: DegreeClass["id"];
    label: string;
    short: string;
    tone: string;
    count: number;
}

export function mean(values: number[]): number | null {
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

export function classDistribution(cgpas: number[]): ClassCount[] {
    return DEGREE_CLASSES.map((c) => ({
        id: c.id,
        label: c.label,
        short: c.short,
        tone: c.tone,
        count: cgpas.filter((g) => classOf(g)?.id === c.id).length,
    }));
}

/**
 * Why a member is flagged in a semester, or null. `previous` is the member's latest
 * record BEFORE this one, if any.
 */
export function riskReason(current: GradeRow, previous: GradeRow | null | undefined): string | null {
    if (current.cgpa < AT_RISK_CGPA) return `CGPA below ${AT_RISK_CGPA.toFixed(2)}`;
    if (previous && previous.gpa - current.gpa >= GPA_DROP_ALERT) {
        return `GPA fell ${(previous.gpa - current.gpa).toFixed(2)}`;
    }
    return null;
}
