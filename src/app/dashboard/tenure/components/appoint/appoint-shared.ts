/**
 * Shared vocabulary for the three appointment steps.
 *
 * The one piece of real logic here is {@link expectedLevelForOffice}, and it is worth
 * reading before changing: it decides which generation the level grid opens on.
 */
import type { Privilege } from "@/lib/modules";

export interface OfficeOption {
    id: string;
    title: string;
    alias: string | null;
    slug: string | null;
    tier: string | null;
    is_active: boolean;
    grants_login?: boolean;
    category?: string;
    _privileges?: Privilege[];
}

export interface Generation {
    id: string;
    entry_year: number | null;
    family_name: string | null;
    is_foundation?: boolean;
    level?: string | null;
    memberCount?: number;
    stats?: { total: number; male: number; female: number; unspecified?: number };
}

/** The level token a `LEVEL:` privilege is scoped to, or null when it has none. */
export function levelScopeOf(privileges: Privilege[] | undefined): string | null {
    const level = (privileges ?? []).find((p) => p.tag === "LEVEL");
    if (!level) return null;
    const scope = level.scope;
    if (scope == null || scope === "all") return "all";
    return String(scope);
}

/** "300" -> "300 Level". The tokens are how scopes are stored; the labels are what we show. */
export function levelTokenToLabel(token: string): string | null {
    if (token === "all") return null;
    if (/^\d{3}$/.test(token)) return `${token} Level`;
    if (token === "pds-uabs") return "PDS/UABS";
    return null;
}

/**
 * Which generation the level grid should open on, and why.
 *
 * A coordinator is normally drawn from the level they coordinate, so a `LEVEL:300`
 * office opens on 300 Level. That is a DEFAULT and not a restriction, because the
 * junior levels break the rule: the 100 Level Coordinator is a senior -- a 400 or 500
 * Level member -- since a fresher three weeks into the fellowship cannot shepherd their
 * own generation. Locking the grid to the scoped level would make the single most
 * common junior appointment impossible to perform.
 *
 * So the expected level is pre-selected and badged, every other level stays one click
 * away, and the screen carries the reason rather than leaving the appointer to wonder
 * why it guessed.
 *
 * Returns null when nothing should be pre-selected: a non-level office, or `LEVEL:all`
 * (the 500 Level Coordinator, who works with every generation).
 */
export function expectedLevelForOffice(privileges: Privilege[] | undefined): string | null {
    const scope = levelScopeOf(privileges);
    if (!scope || scope === "all") return null;
    return levelTokenToLabel(scope);
}

/** How a generation's level reads, falling back to its family name. */
export function generationLabel(generation: Generation): string {
    return generation.level || generation.family_name || `${generation.entry_year ?? "?"} Set`;
}
