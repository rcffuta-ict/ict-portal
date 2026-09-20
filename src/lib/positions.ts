/**
 * Reading the leadership-position catalogue.
 *
 * WHY THIS EXISTS RATHER THAN `ictAdmin.admin.getPositions()`
 *   The ict-lib SDK models a position as `{ title, category, description, isActive }`.
 *   This portal outgrew that: positions also carry `slug` (the immutable access-control
 *   handle), `alias` (the popular name), `tier`, `is_protected`, and their privilege
 *   tags — none of which the SDK knows about. More pressingly, migration 0013 DROPPED
 *   `leadership_positions.category`, and the SDK still selects and writes it, so its
 *   position methods now fail against this schema.
 *
 *   So the portal reads positions itself, and derives the `category` the UI wants from
 *   the privilege tags that were always the real authority.
 *
 * Server-only: uses the service-role client.
 */
import { db } from "@/lib/db";
import { normalizePrivileges, derivePositionKind, type PositionKind } from "@/lib/privileges";
import type { Privilege } from "@/lib/modules";

export interface CataloguePosition {
    id: string;
    slug: string | null;
    title: string;
    alias: string | null;
    description: string | null;
    is_active: boolean;
    tier: "PRESIDENT" | "VP" | "EXECUTIVE" | "COORDINATOR" | null;
    is_protected: boolean;
    /** Whether appointment to this office comes with a portal login. */
    grants_login: boolean;
    privileges: Privilege[];
    /** Derived from `privileges` — see derivePositionKind. Never read from the DB. */
    category: PositionKind;
}

const SELECT =
    "id, slug, title, alias, description, is_active, tier, is_protected, grants_login, " +
    "position_privileges(privilege, scope)";

/**
 * The row shape `SELECT` returns. PostgREST cannot infer an embed from a select string
 * held in a constant, so it is named here — the same approach `getTenurePresidentName`
 * in src/lib/backup.ts takes for its embed.
 */
interface PositionRow {
    id: string;
    slug: string | null;
    title: string;
    alias: string | null;
    description: string | null;
    is_active: boolean;
    tier: CataloguePosition["tier"];
    is_protected: boolean;
    grants_login: boolean;
    position_privileges: { privilege: string; scope: string | null }[] | null;
}

/**
 * Every position in the catalogue, each with its privilege tags and a derived `category`.
 *
 * Resolving TEAM vs UNIT needs to know which slugs are teams, so this makes one extra
 * query for the unit list. Without it an EXCO position would always read as 'UNIT' —
 * safe (a team shown in the wrong group grants nothing extra) but wrong on screen.
 */
export async function listPositions(
    options: { onlyActive?: boolean } = {},
): Promise<CataloguePosition[]> {
    const positionQuery = options.onlyActive
        ? db.from("leadership_positions").select(SELECT).eq("is_active", true).order("title")
        : db.from("leadership_positions").select(SELECT).order("title");

    const [positionsRes, unitsRes] = await Promise.all([
        positionQuery,
        db.from("units").select("slug, type"),
    ]);

    if (positionsRes.error) {
        throw new Error(`Could not load the position catalogue: ${positionsRes.error.message}`);
    }

    const teamSlugs = new Set(
        (unitsRes.data ?? [])
            .filter((u: { slug: string; type: string }) => u.type === "TEAM")
            .map((u: { slug: string }) => u.slug),
    );
    const isTeamSlug = (slug: string) => teamSlugs.has(slug);

    return ((positionsRes.data ?? []) as unknown as PositionRow[]).map((p) => {
        const privileges = normalizePrivileges(p.position_privileges);
        return {
            id: p.id,
            slug: p.slug,
            title: p.title,
            alias: p.alias,
            description: p.description,
            is_active: p.is_active,
            tier: p.tier,
            is_protected: p.is_protected,
            grants_login: p.grants_login,
            privileges,
            category: derivePositionKind(privileges, isTeamSlug),
        };
    });
}

/** The privilege tags held by one position. */
export async function positionPrivileges(positionId: string): Promise<Privilege[]> {
    const { data, error } = await db
        .from("position_privileges")
        .select("privilege, scope")
        .eq("position_id", positionId);
    if (error) throw new Error(error.message);
    return normalizePrivileges(data);
}

/** Whether a position carries the exclusive PRESIDENT tag. */
export async function isPresidentPosition(positionId: string): Promise<boolean> {
    const privileges = await positionPrivileges(positionId);
    return privileges.some((p) => p.tag === "PRESIDENT");
}

/**
 * Whether appointment to this office should come with a portal login.
 *
 * Read from the database rather than from the code catalogue, because this is the one
 * catalogue field the VP Admin owns at runtime — the code value is only the default
 * used when the office is first created.
 *
 * Defaults to FALSE when the row or column cannot be read. An office that silently
 * grants an account is a worse failure than one that silently does not: the second is
 * visible to the person who cannot sign in, the first is visible to nobody.
 */
export async function positionGrantsLogin(positionId: string): Promise<boolean> {
    const { data, error } = await db
        .from("leadership_positions")
        .select("grants_login")
        .eq("id", positionId)
        .maybeSingle();
    if (error || !data) return false;
    return Boolean(data.grants_login);
}
