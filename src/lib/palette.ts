/**
 * A tenure's colour palette: parsing, and the contrast rules it must pass.
 *
 * Pure and dependency-free: the coronation form runs it as the colours are picked, and
 * the server action runs it again before anything is saved — the form is a convenience,
 * the server is the check.
 *
 * The palette maps onto the three brand tokens the app actually uses (the `@theme`
 * block in src/app/globals.css), so every existing `bg-rcf-navy` follows the session's
 * colours without a single component changing:
 *
 *   primary       → --color-rcf-navy        sidebar, headers, primary buttons
 *   primaryLight  → --color-rcf-navy-light  hover states (derived when omitted)
 *   accent        → --color-rcf-gold        highlights on navy
 */

export interface Palette {
    primary: string;
    primaryLight: string;
    accent: string;
}

/** The brand, exactly as `@theme` defines it — what the portal wears with no palette. */
export const BRAND_PALETTE: Palette = {
    primary: "#181240",
    primaryLight: "#2a2257",
    accent: "#fbbf24",
};

/**
 * `#rrggbb` and nothing else. This is a SECURITY boundary, not tidiness: the values are
 * written into a `<style>` element, so anything looser (`red;}`, `</style>`) would be
 * CSS — or markup — injection into every dashboard page.
 */
const HEX = /^#[0-9a-f]{6}$/i;

export function isHexColour(value: unknown): value is string {
    return typeof value === "string" && HEX.test(value);
}

/**
 * A stored palette → a usable one, or null. Null means "wear the brand": no palette,
 * a half-entered one, and a malformed one all fall back rather than rendering unstyled.
 */
export function parsePalette(raw: unknown): Palette | null {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    if (!isHexColour(r.primary) || !isHexColour(r.accent)) return null;
    const primaryLight = isHexColour(r.primaryLight) ? r.primaryLight : lighten(r.primary, 0.12);
    return {
        primary: r.primary.toLowerCase(),
        primaryLight: primaryLight.toLowerCase(),
        accent: r.accent.toLowerCase(),
    };
}

/** Mix a colour toward white by `amount` (0–1). How primaryLight is derived. */
export function lighten(hex: string, amount: number): string {
    const [r, g, b] = rgb(hex);
    const mix = (c: number) => Math.round(c + (255 - c) * amount);
    return "#" + [mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("");
}

function rgb(hex: string): [number, number, number] {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
    const [r, g, b] = rgb(hex).map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio between two colours, 1–21. */
export function contrastRatio(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

export interface ContrastCheck {
    /** What sits on what, in words a VP Admin will recognise. */
    pair: string;
    ratio: number;
    needed: number;
    ok: boolean;
}

/**
 * The pairs that must be readable, and at what WCAG AA threshold.
 *
 * White on primary is the one that matters most: text on navy is a hard-coded
 * `text-white` across the app (sidebar, headers, buttons), so a pale primary makes
 * the sidebar unreadable for a whole session. Gold on navy is used for icons and
 * highlights — graphics and large text — so it needs 3:1, not 4.5:1.
 */
export function checkPalette(p: Palette): { ok: boolean; checks: ContrastCheck[] } {
    const WHITE = "#ffffff";
    const checks: ContrastCheck[] = [
        { pair: "White text on the main colour", ratio: contrastRatio(WHITE, p.primary), needed: 4.5 },
        { pair: "White text on the hover colour", ratio: contrastRatio(WHITE, p.primaryLight), needed: 4.5 },
        { pair: "Accent on the main colour", ratio: contrastRatio(p.accent, p.primary), needed: 3 },
    ].map((c) => ({ ...c, ratio: Math.round(c.ratio * 100) / 100, ok: c.ratio >= c.needed }));
    return { ok: checks.every((c) => c.ok), checks };
}

/**
 * The `:root` rule that repaints the app, or "" for the brand.
 *
 * Unlayered on purpose: Tailwind v4 emits the `@theme` tokens inside `@layer theme`, and
 * unlayered styles win over layered ones regardless of order — so this overrides the
 * brand without `!important` and without touching globals.css.
 */
export function paletteCss(p: Palette | null): string {
    if (!p) return "";
    // Re-validated at the point of output. parsePalette already guarantees it, but this
    // string goes into a <style> tag and should never depend on a caller having parsed.
    if (![p.primary, p.primaryLight, p.accent].every(isHexColour)) return "";
    return `:root{--color-rcf-navy:${p.primary};--color-rcf-navy-light:${p.primaryLight};--color-rcf-gold:${p.accent};}`;
}
