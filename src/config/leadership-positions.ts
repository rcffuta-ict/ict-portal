/**
 * THE FROZEN LEADERSHIP CATALOGUE — every position that can exist in the fellowship.
 *
 * The structure is constant across tenures; only the people filling the positions
 * change. That is why this lives in code rather than in a table the VP Admin edits:
 * a tenure hands over by replacing OCCUPANTS (`leadership` rows), never by
 * redefining the org chart.
 *
 * Two kinds of entry:
 *
 *   FIXED    — the four church-wide offices. Exactly one lead each, per tenure.
 *   DERIVED  — generated from data that legitimately grows: one Executive per unit
 *              or team, one Coordinator per level. Creating a unit mints its
 *              Executive position automatically (see createUnitAction), so the
 *              catalogue stays complete without anyone hand-maintaining it.
 *
 * Migration 0011 seeds this into `leadership_positions` + `position_privileges` and
 * installs a trigger that refuses to delete a protected position or rewrite its
 * privileges. Change the fellowship's structure HERE, then re-run the sync — don't
 * edit the rows directly.
 *
 * Client-safe: plain data, no server imports.
 */
import { LEVELS } from "@/lib/levels";
import type { Privilege } from "@/lib/modules";

/**
 * Where a position sits in the hierarchy:
 *
 *     President → VPs (Admin, Church Growth) → Executives → Level Coordinators
 *
 * PRESENTATION AND ORDERING ONLY. Authorization is decided entirely by the privilege
 * tags below — a second, parallel permission system keyed on tier is exactly the kind
 * of thing that drifts out of sync with the first one.
 */
export const POSITION_TIERS = [
    "PRESIDENT",
    "VP",
    "EXECUTIVE",
    "COORDINATOR",
    "SYSTEM",
] as const;

export type PositionTier = (typeof POSITION_TIERS)[number];

export const TIER_LABELS: Record<PositionTier, string> = {
    PRESIDENT: "President",
    VP: "Vice Presidents",
    EXECUTIVE: "Executives",
    COORDINATOR: "Level Coordinators",
    SYSTEM: "System",
};

/** Rank order for display — lower sorts first. */
export const TIER_ORDER: Record<PositionTier, number> = {
    PRESIDENT: 0,
    VP: 1,
    EXECUTIVE: 2,
    COORDINATOR: 3,
    SYSTEM: 4,
};

export interface PositionSpec {
    slug: string;
    title: string;
    alias: string;
    tier: PositionTier;
    description: string;
    privileges: Privilege[];
    /**
     * Legacy `leadership_positions.category`, still read by the not-yet-rebuilt
     * cabinet UI. Derived from the tier; privileges remain the real authority.
     */
    category: "PRESIDENT" | "CENTRAL" | "UNIT" | "TEAM" | "LEVEL" | "ZONE";
    /** One of the two protected offices that must exist in every tenure. */
    isDefault?: boolean;
    /** Marked central in the legacy column (President, VPs). */
    isCentral?: boolean;
}

// ---------------------------------------------------------------------------
// Fixed offices
// ---------------------------------------------------------------------------

export const FIXED_POSITIONS: PositionSpec[] = [
    {
        slug: "president",
        title: "President",
        alias: "President",
        tier: "PRESIDENT",
        category: "PRESIDENT",
        isCentral: true,
        description:
            "Head of the fellowship. Sees every module including Settings, and is globally write-blocked.",
        // PRESIDENT is EXCLUSIVE — the DB trigger from migration 0006 rejects any
        // position that holds it alongside another tag.
        privileges: [{ tag: "PRESIDENT", scope: null }],
    },
    {
        slug: "vp-admin",
        title: "Vice President Administration",
        alias: "VP Admin",
        tier: "VP",
        category: "CENTRAL",
        isDefault: true,
        isCentral: true,
        description:
            "Administrative head. Appoints leaders, approves unit transfers, and runs the handover.",
        privileges: [{ tag: "CENTRAL", scope: null }],
    },
    {
        slug: "vp-church-growth",
        title: "Vice President Church Growth",
        alias: "VP Church Growth",
        tier: "VP",
        category: "CENTRAL",
        isCentral: true,
        description: "Growth and outreach head. Church-wide read access.",
        privileges: [{ tag: "CENTRAL", scope: null }],
    },
    {
        slug: "ict-coord",
        title: "ICT Coordinator",
        alias: "ICT Coord",
        tier: "SYSTEM",
        category: "CENTRAL",
        isDefault: true,
        // Deliberately NOT central: the System Admin is not an exco, and central
        // logic/UI should not sweep them up (see migration 0005).
        isCentral: false,
        description:
            "System Admin. Full read and write everywhere, including Settings and the Oracle.",
        privileges: [{ tag: "SYSADMIN", scope: null }],
    },
];

// ---------------------------------------------------------------------------
// Derived positions
// ---------------------------------------------------------------------------

/** The Executive position for one unit or team. */
export function excoPositionFor(unit: {
    slug: string;
    name: string;
    type: "UNIT" | "TEAM";
}): PositionSpec {
    return {
        slug: `exco-${unit.slug}`,
        title: `Executive — ${unit.name}`,
        alias: `${unit.name} Exco`,
        tier: "EXECUTIVE",
        category: unit.type === "TEAM" ? "TEAM" : "UNIT",
        description: `Leads ${unit.name}. Adds and removes its members directly.`,
        // Scoped to this unit's slug — the EXCO tag with no scope would be
        // church-wide, which is not what leading one unit means.
        privileges: [{ tag: "EXCO", scope: unit.slug }],
    };
}

/**
 * The level token that a Level Coordinator position is SCOPED to.
 *
 * THE 500-LEVEL SPECIALTY LIVES HERE. Finalist coordinators hold authority over every
 * level in the fellowship, not just their own, so their position is granted `LEVEL`
 * with scope `all` rather than `500`.
 *
 * This is deliberately expressed as data. `canManageLevel()` in
 * src/lib/access-control.ts and `managedLevelIds()` in the level module already treat
 * a null-or-"all" scope as "every generation", so encoding the rule in the catalogue
 * needs no authorization code at all — and can't drift out of step with the several
 * places that read level scopes.
 */
export function levelScopeToken(level: string): string {
    if (level === "500 Level") return "all";
    if (level === "PDS/UABS") return "pds-uabs";
    const match = level.match(/^(\d)00 Level$/);
    return match ? `${match[1]}00` : "all";
}

/** The Coordinator position for one level. */
export function levelCoordinatorFor(level: string): PositionSpec {
    const token = levelScopeToken(level);
    const slugPart = level === "PDS/UABS" ? "pds-uabs" : token;
    const isFinalist = level === "500 Level";

    return {
        slug: `level-coord-${slugPart}`,
        title: `Level Coordinator — ${level}`,
        alias: `${level} Coord`,
        tier: "COORDINATOR",
        category: "LEVEL",
        description: isFinalist
            ? "Coordinates the finalists, and holds coordinator authority over EVERY level in the fellowship."
            : `Coordinates ${level}. Authority is limited to that generation.`,
        privileges: [{ tag: "LEVEL", scope: token }],
    };
}

/** Every Level Coordinator position, one per level in `LEVELS`. */
export function levelCoordinatorPositions(): PositionSpec[] {
    return LEVELS.map(levelCoordinatorFor);
}

/**
 * The complete catalogue for a given set of units: fixed offices, one Executive per
 * unit/team, one Coordinator per level.
 */
export function buildCatalogue(
    units: { slug: string; name: string; type: "UNIT" | "TEAM" }[],
): PositionSpec[] {
    return [
        ...FIXED_POSITIONS,
        ...units.map(excoPositionFor),
        ...levelCoordinatorPositions(),
    ];
}

/** True when a slug belongs to the fixed, never-generated set. */
export function isFixedPositionSlug(slug: string): boolean {
    return FIXED_POSITIONS.some((p) => p.slug === slug);
}
