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
import { unitBySlug } from "@/config/fellowship-units";
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
] as const;

export type PositionTier = (typeof POSITION_TIERS)[number];

export const TIER_LABELS: Record<PositionTier, string> = {
    PRESIDENT: "President",
    VP: "Vice Presidents",
    EXECUTIVE: "Executives",
    COORDINATOR: "Level Coordinators",
};

/** Rank order for display — lower sorts first. */
export const TIER_ORDER: Record<PositionTier, number> = {
    PRESIDENT: 0,
    VP: 1,
    EXECUTIVE: 2,
    COORDINATOR: 3,
};

export interface PositionSpec {
    slug: string;
    title: string;
    alias: string;
    tier: PositionTier;
    description: string;
    privileges: Privilege[];
}

// ---------------------------------------------------------------------------
// Fixed offices
// ---------------------------------------------------------------------------

/**
 * The Information and Communications Unit's slug.
 *
 * Short on purpose. A slug is an access-control scope — it appears in every
 * `position_privileges` row, in the catalogue UI, and inside the derived position name
 * `exco-<slug>`. `ict` reads as a permission token; the full unit name did not. The
 * display title stays "Information and Communications Unit"; only the handle is short.
 *
 * Immutable once seeded: renaming the office must never move its permissions.
 */
export const ICT_UNIT_SLUG = "ict";

export const FIXED_POSITIONS: PositionSpec[] = [
    {
        slug: "president",
        title: "President",
        alias: "President",
        tier: "PRESIDENT",
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
        description:
            "Administrative head. Appoints leaders, approves unit transfers, and runs the handover.",
        privileges: [{ tag: "CENTRAL", scope: null }],
    },
    {
        slug: "vp-church-growth",
        title: "Vice President Church Growth",
        alias: "VP Church Growth",
        tier: "VP",
        description: "Growth and outreach head. Church-wide read access.",
        privileges: [{ tag: "CENTRAL", scope: null }],
    },
    {
        slug: "ict-coord",
        title: "ICT Coordinator",
        alias: "ICT Coord",
        // An EXECUTIVE, not a tier of their own: the ICT Coordinator sits alongside the
        // other unit heads in the hierarchy. Tier is placement only — it takes nothing
        // away from SYSADMIN, because authorization has only ever read privilege tags.
        tier: "EXECUTIVE",
        description:
            "System Admin, and Executive of the Information and Communications Unit. Full read and write everywhere, including Settings and the Oracle.",
        // Two tags, two distinct jobs: SYSADMIN is the portal-wide System Admin right;
        // EXCO:ict is leading their own unit like any other exco. Because this position
        // already carries the ICT unit's EXCO scope, buildCatalogue() must NOT also mint
        // `exco-ict` — see buildCatalogue() below, or the unit ends up with two leads.
        privileges: [
            { tag: "SYSADMIN", scope: null },
            { tag: "EXCO", scope: ICT_UNIT_SLUG },
        ],
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
    // The office's POPULAR name ("Chief Usher"), not a mechanical one. Units seeded
    // outside the bootstrap catalogue have none on record, so they fall back to a
    // derived label rather than shipping an empty alias.
    const alias = unitBySlug(unit.slug)?.positionAlias ?? `${unit.name} Exco`;

    return {
        slug: `exco-${unit.slug}`,
        title: `Executive — ${unit.name}`,
        alias,
        tier: "EXECUTIVE",
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
        // The ICT unit is led by `ict-coord`, which already carries EXCO:ict. Minting a
        // second `exco-ict` position here would give the unit two leads and two sets of
        // identical privileges.
        ...units.filter((u) => u.slug !== ICT_UNIT_SLUG).map(excoPositionFor),
        ...levelCoordinatorPositions(),
    ];
}

/**
 * The two offices that must exist and stay enabled in EVERY tenure: the VP Admin (who
 * appoints everyone else and runs the handover) and the ICT Coordinator (the System
 * Admin). Disabling either leaves the fellowship unable to administer itself.
 *
 * This replaces the old `leadership_positions.is_default` column, dropped in migration
 * 0013. Identifying them by IMMUTABLE SLUG rather than by a stored boolean — or worse,
 * by their editable titles — means renaming an office in the UI can never accidentally
 * unprotect it.
 */
export const UNDISABLEABLE_POSITION_SLUGS = ["vp-admin", "ict-coord"] as const;

/** Whether this position may never be disabled. */
export function isUndisableablePosition(slug: string | null | undefined): boolean {
    return !!slug && (UNDISABLEABLE_POSITION_SLUGS as readonly string[]).includes(slug);
}

/** True when a slug belongs to the fixed, never-generated set. */
export function isFixedPositionSlug(slug: string): boolean {
    return FIXED_POSITIONS.some((p) => p.slug === slug);
}
