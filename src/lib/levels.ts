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
