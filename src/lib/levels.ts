/**
 * Academic level helpers.
 *
 * A "level" is a generation (class_set) projected onto the ACTIVE tenure's session:
 * a member's entry year vs. the session's start year gives 100..500 Level. Foundation
 * generations (PDS/UABS) sit outside the numeric progression and are always labelled
 * "PDS/UABS".
 *
 * IMPORTANT: keep this in sync with the SQL function `rcf_compute_level` in
 * db/migrations/0001_auth_rework.sql — both must produce identical labels.
 */

/** The physical levels in the system (PDS/UABS counts as one). */
export const LEVELS = [
    "PDS/UABS",
    "100 Level",
    "200 Level",
    "300 Level",
    "400 Level",
    "500 Level",
] as const;

export type LevelLabel = (typeof LEVELS)[number] | "Pre-100" | "Alumni";

/** Parse the start year from a session string like "2025/2026" → 2025. */
export function sessionStartYear(session: string | null | undefined): number | null {
    if (!session) return null;
    const match = session.match(/^(\d{4})/);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Compute a member's current level label.
 * @param entryYear   class_set.entry_year (the generation's entry year)
 * @param isFoundation class_set.is_foundation (PDS/UABS)
 * @param session     the active tenure's `session` (e.g. "2025/2026")
 */
export function computeLevel(
    entryYear: number | null | undefined,
    isFoundation: boolean | null | undefined,
    session: string | null | undefined,
): LevelLabel | null {
    if (isFoundation) return "PDS/UABS";

    const startYear = sessionStartYear(session);
    if (entryYear == null || startYear == null) return null;

    const standing = startYear - entryYear + 1;
    if (standing < 1) return "Pre-100";
    if (standing > 5) return "Alumni";
    return `${standing * 100} Level` as LevelLabel;
}

/** Whether a computed level represents a finalist (500 Level). */
export function isFinalistLevel(level: LevelLabel | null): boolean {
    return level === "500 Level";
}

/**
 * Whether a generation's details (its family name) may be edited from the Tenure
 * module: 200 Level and above, Alumni included. 100 Level, the PDS/UABS foundation set
 * and anything not yet at 100 are not — they are named later, not corrected here.
 * Checked by the Generations tab and again by updateGenerationAction.
 */
export function isEditableGenerationLevel(level: string | null | undefined): boolean {
    return level === "Alumni" || /^[2-5]00 Level$/.test(level ?? "");
}

/**
 * Order for generation lists: the lowest standing first. PDS/UABS always comes first,
 * because its members are aspirants, not yet students, so it ranks below 100 Level
 * whatever year it is keyed by. Then the youngest generation (100 Level) to the oldest.
 *
 * Needed because the foundation generation's entry year is only a key (the next
 * intake's year), so sorting by entry year alone could put it anywhere.
 */
export function compareGenerations(
    a: { entry_year: number | null; is_foundation?: boolean | null },
    b: { entry_year: number | null; is_foundation?: boolean | null },
): number {
    if (!!a.is_foundation !== !!b.is_foundation) return a.is_foundation ? -1 : 1;
    return (b.entry_year ?? 0) - (a.entry_year ?? 0);
}

/**
 * A generation's standing name. PDS/UABS takes the active session's name
 * ("2028/2029"), since a new aspirant intake arrives every session; 100 Level is named
 * after its entry year ("2028 Set"). Both are applied at handover.
 */
export function entryLevelName(isFoundation: boolean, session: string): string | null {
    if (isFoundation) return session;
    const start = sessionStartYear(session);
    return start == null ? null : `${start} Set`;
}

/** Display order for level labels: foundation, 100 → 500, then Alumni; unknowns last. */
const LEVEL_ORDER: string[] = ["Pre-100", ...LEVELS, "Alumni"];

/** Sort comparator for level labels, e.g. `levels.sort(byLevel)`. */
export function byLevel(a: string | null, b: string | null): number {
    const ia = a ? LEVEL_ORDER.indexOf(a) : -1;
    const ib = b ? LEVEL_ORDER.indexOf(b) : -1;
    if (ia === -1 && ib === -1) return (a ?? "").localeCompare(b ?? "");
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
}
