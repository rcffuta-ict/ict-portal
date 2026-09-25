/**
 * How the active session is actually faring — the numbers behind the Tenure page's
 * insight panels, computed in one place so they agree with each other.
 *
 * Server-only (service-role client). The caller checks access first.
 *
 * DEFINITIONS, fixed here and nowhere else:
 *   member — a profile.
 *   worker — a member in a workforce UNIT this tenure (`type = 'UNIT' AND is_workforce`).
 *            The Brothers' and Sisters' units are `is_workforce = false` and computed
 *            from gender, so they never make anyone a worker. Teams never do.
 *   office filled — a current LEAD holds it (assistants don't fill an office).
 *   honorary — an office with no privilege tags: it controls nothing in the portal.
 */
import { db } from "@/lib/db";
import { fetchAll } from "@/lib/fetch-all";
import { compareGenerations, computeLevel } from "@/lib/levels";
import { genderForUnitSlug } from "@/config/fellowship-units";
import { TIER_LABELS, TIER_ORDER, type PositionTier } from "@/config/leadership-positions";

type Gender = "male" | "female" | null;

export interface SessionInsight {
    session: string | null;
    coverage: { members: number; workers: number; notInUnit: number; percent: number };
    units: {
        id: string;
        name: string;
        members: number;
        byGender: boolean;
        hasExco: boolean;
    }[];
    teams: { total: number; empty: number };
    cabinet: {
        tiers: {
            tier: PositionTier;
            label: string;
            filled: number;
            total: number;
            vacant: { title: string; honorary: boolean }[];
        }[];
        filled: number;
        total: number;
    };
    generations: {
        id: string;
        name: string;
        level: string | null;
        members: number;
        workers: number;
        male: number;
        female: number;
        unspecified: number;
    }[];
    access: {
        /** People holding at least one current office that grants a login. */
        holders: number;
        /** …of whom a login has been provisioned. */
        provisioned: number;
        /** …of whom have never set a password — they cannot actually sign in yet. */
        neverSetPassword: number;
        /** Holders with no login row at all. Should be zero; provisioning missed them. */
        missingLogin: number;
    };
    pendingTransfers: number;
}

export async function computeSessionInsight(): Promise<SessionInsight> {
    const { data: tenure } = await db
        .from("tenures")
        .select("id, session")
        .eq("is_active", true)
        .maybeSingle();
    const tenureId: string | null = tenure?.id ?? null;
    const session: string | null = tenure?.session ?? null;

    const [profiles, memberships, unitsRes, setsRes, positionsRes, leadership, logins, transfersRes] =
        await Promise.all([
            fetchAll<{ id: string; gender: Gender; class_set_id: string | null }>((a, b) =>
                db.from("profiles").select("id, gender, class_set_id").order("id").range(a, b),
            ),
            tenureId
                ? fetchAll<{ profile_id: string; unit_id: string }>((a, b) =>
                    db.from("membership_units").select("profile_id, unit_id")
                        .eq("tenure_id", tenureId).order("id").range(a, b),
                )
                : Promise.resolve([]),
            db.from("units").select("id, slug, name, type, is_workforce").order("name"),
            db.from("class_sets").select("id, family_name, entry_year, is_foundation, level_override")
                .order("entry_year", { ascending: false }),
            db.from("leadership_positions")
                .select("id, title, alias, tier, is_active, grants_login, position_privileges(privilege, scope)"),
            tenureId
                ? fetchAll<{ profile_id: string; position_id: string; is_lead: boolean | null }>((a, b) =>
                    db.from("leadership").select("profile_id, position_id, is_lead")
                        .eq("tenure_id", tenureId).is("ended_at", null).order("id").range(a, b),
                )
                : Promise.resolve([]),
            fetchAll<{ profile_id: string; password_hash: string | null }>((a, b) =>
                db.from("profile_login").select("profile_id, password_hash").order("id").range(a, b),
            ),
            tenureId
                ? db.from("unit_transfer_requests").select("id", { count: "exact", head: true })
                    .eq("tenure_id", tenureId).eq("status", "pending")
                : Promise.resolve({ count: 0 }),
        ]);

    const units = (unitsRes.data ?? []) as {
        id: string; slug: string; name: string; type: "UNIT" | "TEAM"; is_workforce: boolean;
    }[];
    const positions = (positionsRes.data ?? []) as {
        id: string; title: string; alias: string | null; tier: PositionTier; is_active: boolean | null;
        grants_login: boolean; position_privileges: { privilege: string; scope: string | null }[] | null;
    }[];

    // --- workers ------------------------------------------------------------
    const workforceUnitIds = new Set(
        units.filter((u) => u.type === "UNIT" && u.is_workforce !== false).map((u) => u.id),
    );
    const workerIds = new Set(
        memberships.filter((m) => workforceUnitIds.has(m.unit_id)).map((m) => m.profile_id),
    );
    const members = profiles.length;
    const workers = workerIds.size;

    // --- per unit ---------------------------------------------------------------
    const membersByUnit = new Map<string, Set<string>>();
    for (const m of memberships) {
        if (!membersByUnit.has(m.unit_id)) membersByUnit.set(m.unit_id, new Set());
        membersByUnit.get(m.unit_id)!.add(m.profile_id);
    }
    const genderCount = { male: 0, female: 0 };
    for (const p of profiles) if (p.gender === "male" || p.gender === "female") genderCount[p.gender] += 1;

    // An Exco for a unit = a current LEAD of an office tagged EXCO:<that unit's slug>
    // (or EXCO:all / unscoped). Tags, not leadership.unit_id — cabinet appointments leave
    // unit_id empty; the tag is what actually gives authority over the unit.
    const positionById = new Map(positions.map((p) => [p.id, p]));
    const excoScopes = new Set<string>();
    let excoAll = false;
    for (const l of leadership) {
        if (l.is_lead === false) continue;
        for (const pp of positionById.get(l.position_id)?.position_privileges ?? []) {
            if (pp.privilege !== "EXCO") continue;
            if (pp.scope == null || pp.scope.toLowerCase() === "all") excoAll = true;
            else excoScopes.add(pp.scope);
        }
    }

    const unitRows = units
        .filter((u) => u.type === "UNIT")
        .map((u) => {
            const gender = genderForUnitSlug(u.slug);
            return {
                id: u.id,
                name: u.name,
                members: gender ? genderCount[gender] : (membersByUnit.get(u.id)?.size ?? 0),
                byGender: gender !== null,
                hasExco: excoAll || excoScopes.has(u.slug),
            };
        })
        .sort((a, b) => b.members - a.members || a.name.localeCompare(b.name));

    const teamRows = units.filter((u) => u.type === "TEAM");

    // --- cabinet ------------------------------------------------------------
    const leadHeld = new Set(leadership.filter((l) => l.is_lead !== false).map((l) => l.position_id));
    const activePositions = positions.filter((p) => p.is_active !== false);
    const tiers = (Object.keys(TIER_ORDER) as PositionTier[])
        .sort((a, b) => TIER_ORDER[a] - TIER_ORDER[b])
        .map((tier) => {
            const inTier = activePositions.filter((p) => p.tier === tier);
            return {
                tier,
                label: TIER_LABELS[tier],
                filled: inTier.filter((p) => leadHeld.has(p.id)).length,
                total: inTier.length,
                vacant: inTier
                    .filter((p) => !leadHeld.has(p.id))
                    .map((p) => ({
                        title: p.alias || p.title,
                        honorary: (p.position_privileges ?? []).length === 0,
                    }))
                    .sort((a, b) => a.title.localeCompare(b.title)),
            };
        })
        .filter((t) => t.total > 0);

    // --- generations -----------------------------------------------------------
    const gens = new Map<string, { members: number; workers: number; male: number; female: number; unspecified: number }>();
    for (const p of profiles) {
        if (!p.class_set_id) continue;
        if (!gens.has(p.class_set_id)) gens.set(p.class_set_id, { members: 0, workers: 0, male: 0, female: 0, unspecified: 0 });
        const g = gens.get(p.class_set_id)!;
        g.members += 1;
        if (workerIds.has(p.id)) g.workers += 1;
        if (p.gender === "male") g.male += 1;
        else if (p.gender === "female") g.female += 1;
        else g.unspecified += 1;
    }
    type ClassSetRow = {
        id: string; family_name: string | null; entry_year: number;
        is_foundation: boolean | null; level_override: string | null;
    };
    const generations = [...((setsRes.data ?? []) as ClassSetRow[])].sort(compareGenerations).map((s) => {
        const g = gens.get(s.id) ?? { members: 0, workers: 0, male: 0, female: 0, unspecified: 0 };
        return {
            id: s.id,
            name: s.family_name || `${s.entry_year} set`,
            level: s.level_override || computeLevel(s.entry_year, !!s.is_foundation, session) || null,
            ...g,
        };
    });

    // --- access -------------------------------------------------------------------
    const loginGranting = new Set(positions.filter((p) => p.grants_login).map((p) => p.id));
    const holderIds = new Set(leadership.filter((l) => loginGranting.has(l.position_id)).map((l) => l.profile_id));
    const loginByProfile = new Map(logins.map((l) => [l.profile_id, l]));
    let provisioned = 0;
    let neverSetPassword = 0;
    let missingLogin = 0;
    for (const id of holderIds) {
        const login = loginByProfile.get(id);
        if (!login) missingLogin += 1;
        else {
            provisioned += 1;
            if (!login.password_hash) neverSetPassword += 1;
        }
    }

    return {
        session,
        coverage: {
            members,
            workers,
            notInUnit: members - workers,
            percent: members ? Math.round((workers / members) * 100) : 0,
        },
        units: unitRows,
        teams: {
            total: teamRows.length,
            empty: teamRows.filter((t) => !(membersByUnit.get(t.id)?.size)).length,
        },
        cabinet: {
            tiers,
            filled: tiers.reduce((n, t) => n + t.filled, 0),
            total: tiers.reduce((n, t) => n + t.total, 0),
        },
        generations,
        access: { holders: holderIds.size, provisioned, neverSetPassword, missingLogin },
        pendingTransfers: (transfersRes as { count: number | null }).count ?? 0,
    };
}
