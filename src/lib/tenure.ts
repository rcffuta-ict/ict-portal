/**
 * What a tenure is called — decided here and nowhere else.
 *
 * A tenure is its session (2026/2027), its theme (Arise and Shine) and its text (the
 * Bible reference the theme is drawn from). It has no name. Every screen that names a
 * tenure goes through these helpers, so the fellowship never sees two screens that
 * disagree about what the session is called.
 *
 * Pure and dependency-free on purpose: imported by server actions, server components
 * and client components alike.
 */

/** The fields a label is built from. Any tenure-shaped row satisfies it. */
export interface TenureIdentity {
    session: string;
    theme?: string | null;
}

/**
 * Coronation (the retreat) is where the theme is unveiled, so a tenure is coronated
 * exactly when it has a theme. Not having one is not missing data — it is the honest
 * state of a young session.
 */
export function isCoronated(tenure: TenureIdentity): boolean {
    return !!tenure.theme?.trim();
}

/**
 * The short label, for tight spaces (sidebar, footer, a card title): the theme once
 * coronated, the session until then.
 */
export function tenureLabel(tenure: TenureIdentity): string {
    return isCoronated(tenure) ? tenure.theme!.trim() : tenure.session;
}

/**
 * The full label, wherever a tenure is *named* — overview, handover records, backups.
 *
 *   "Arise and Shine · 2026/2027"
 *   "2026/2027 · Awaiting coronation"
 */
export function tenureFullLabel(tenure: TenureIdentity): string {
    return isCoronated(tenure)
        ? `${tenure.theme!.trim()} · ${tenure.session}`
        : `${tenure.session} · Awaiting coronation`;
}
