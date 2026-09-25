/**
 * Unit, membership and zone queries.
 *
 * These were methods on the @rcffuta/ict-lib client (`ictAdmin.unit.*`,
 * `ictAdmin.zone.*`). They are reproduced here, behaviour for behaviour, so the
 * dependency could be removed — each is a handful of lines of PostgREST that gains
 * nothing from living in a separately-versioned package.
 *
 * Server-only: every function uses the service-role client and performs NO
 * authorization of its own. Callers must check permissions first.
 */
import { db } from "@/lib/db";
import { fetchAll } from "@/lib/fetch-all";
import { genderForUnitSlug } from "@/config/fellowship-units";
import { parseGender } from "@/lib/gender";
import type { ProfileContext } from "@/lib/auth/profile-context";

// ---------------------------------------------------------------------------
// Membership audit trail
// ---------------------------------------------------------------------------

/** Who made a membership change. `name` is a snapshot, so the log survives them. */
export interface MembershipActor {
    id: string | null;
    name: string | null;
}

export type MembershipEventAction =
    | "added"
    | "removed"
    | "transferred_in"
    | "transferred_out"
    | "carried_over";

export interface MembershipEvent {
    profileId: string;
    unitId: string;
    tenureId: string;
    action: MembershipEventAction;
}

export function membershipActorOf(ctx: ProfileContext): MembershipActor {
    return {
        id: ctx.profile.id,
        name: [ctx.profile.firstName, ctx.profile.lastName].filter(Boolean).join(" ") || null,
    };
}

/**
 * Record membership changes in `membership_events`.
 *
 * Called by EVERY path that changes `membership_units` — add, remove, transfer
 * approval, handover carry-over — so "who added this person, and when" always has an
 * answer. Never fails the caller: the change has already happened, and refusing it
 * after the fact because the log write failed would be worse than a missing line. A
 * failure is logged loudly instead.
 */
export async function logMembershipEvents(
    events: MembershipEvent[],
    actor: MembershipActor,
): Promise<void> {
    if (events.length === 0) return;
    const { error } = await db.from("membership_events").insert(
        events.map((e) => ({
            profile_id: e.profileId,
            unit_id: e.unitId,
            tenure_id: e.tenureId,
            action: e.action,
            actor_id: actor.id,
            actor_name: actor.name,
        })),
    );
    if (error) console.error("membership_events write failed:", error.message, events);
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

export interface UnitOverview {
    id: string;
    slug: string;
    name: string;
    type: "UNIT" | "TEAM";
    description: string | null;
    is_workforce: boolean;
    memberCount: number;
    /** Membership is computed from gender; there is no roster to edit. */
    isGenderCategory?: boolean;
    /** Members this session, split by gender (unspecified count only in `total`). */
    stats: { total: number; male: number; female: number };
    /** Current leaders, the lead first. */
    leaders: UnitLeader[];
}

type OneOrMany<T> = T | T[] | null;

/** A leadership row as read for the overview. */
interface OverviewLeaderRow {
    is_lead: boolean | null;
    unit_id: string | null;
    position: OneOrMany<{ title: string | null; alias: string | null; position_privileges: { privilege: string; scope: string | null }[] | null }>;
    profile: OneOrMany<{ id: string; first_name: string; last_name: string; avatar_url: string | null; gender: string | null }>;
}

function firstOf<T>(v: OneOrMany<T>): T | null {
    return Array.isArray(v) ? (v[0] ?? null) : v;
}

/** Someone leading a unit or team this session. */
export interface UnitLeader {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
    gender: string | null;
    role: string | null;
    isLead: boolean;
}

/**
 * Every unit and team, with how many members each holds in the given tenure.
 *
 * Tenure-scoped: membership rows are per tenure, and counting every tenure's rows made a
 * unit read as bigger each session it existed. With no tenure, every count is zero.
 *
 * The Brothers' and Sisters' units are counted from `profiles.gender` instead of from
 * `membership_units`, because nobody is inducted into them -- see `genderCategory` in
 * src/config/fellowship-units.ts. Their membership row count is always zero, and
 * reporting that would put "0 members" beside a unit that contains half the fellowship.
 */
export async function getAllUnitsOverview(tenureId: string | null): Promise<UnitOverview[]> {
    const [{ data, error }, memberships, genders, leadership] = await Promise.all([
        db.from("units").select("*").order("name"),
        // Paged: every membership row of the tenure, not the first 1000 (fetchAll).
        tenureId
            ? fetchAll<{ unit_id: string; profile_id: string }>((from, to) =>
                db.from("membership_units").select("unit_id, profile_id")
                    .eq("tenure_id", tenureId).order("id").range(from, to),
            )
            : Promise.resolve([] as { unit_id: string; profile_id: string }[]),
        // Everyone's gender, for the brother/sister split on each unit.
        fetchAll<{ id: string; gender: string | null }>((from, to) =>
            db.from("profiles").select("id, gender").order("id").range(from, to),
        ),
        // The session's cabinet is small (dozens), so one unpaged read.
        tenureId
            ? db.from("leadership")
                .select(`
                    is_lead, unit_id,
                    position:leadership_positions(title, alias, position_privileges(privilege, scope)),
                    profile:profiles!leadership_profile_id_fkey(id, first_name, last_name, avatar_url, gender)
                `)
                .eq("tenure_id", tenureId)
                .is("ended_at", null)
            : Promise.resolve({ data: [] as OverviewLeaderRow[] }),
    ]);
    if (error) throw new Error(error.message);

    const genderOf = new Map(genders.map((p) => [p.id, parseGender(p.gender)]));
    const churchWide = { male: 0, female: 0 };
    for (const g of genderOf.values()) if (g === "male" || g === "female") churchWide[g] += 1;

    const tallies = new Map<string, { total: number; male: number; female: number }>();
    for (const m of memberships ?? []) {
        const t = tallies.get(m.unit_id) ?? { total: 0, male: 0, female: 0 };
        t.total += 1;
        const g = genderOf.get(m.profile_id);
        if (g === "male" || g === "female") t[g] += 1;
        tallies.set(m.unit_id, t);
    }

    const leaderRows = ((leadership as { data: unknown }).data ?? []) as OverviewLeaderRow[];
    const rows = data ?? [];

    return rows.map((u) => {
        const gender = genderForUnitSlug(u.slug);
        const stats = gender
            ? { total: churchWide[gender], male: gender === "male" ? churchWide.male : 0, female: gender === "female" ? churchWide.female : 0 }
            : (tallies.get(u.id) ?? { total: 0, male: 0, female: 0 });
        // A unit's leaders: an office tagged EXCO:<slug> (how the Cabinet appoints an
        // Executive, with unit_id empty), or a direct unit appointment. Lead first.
        const leaders: UnitLeader[] = leaderRows
            .filter((l) =>
                l.unit_id === u.id
                || (firstOf(l.position)?.position_privileges ?? []).some(
                    (pp) => pp.privilege === "EXCO" && pp.scope === u.slug,
                ))
            .sort((a, b) => Number(a.is_lead === false) - Number(b.is_lead === false))
            .flatMap((l) => {
                const p = firstOf(l.profile);
                if (!p) return [];
                const pos = firstOf(l.position);
                return [{
                    id: p.id, first_name: p.first_name, last_name: p.last_name,
                    avatar_url: p.avatar_url ?? null, gender: p.gender ?? null,
                    role: pos?.alias || pos?.title || null, isLead: l.is_lead !== false,
                }];
            });
        return {
            ...u,
            isGenderCategory: gender !== null,
            memberCount: stats.total,
            stats,
            leaders,
        };
    }) as UnitOverview[];
}

/**
 * The units (and teams) a member belongs to this tenure — rows in `membership_units`,
 * plus the Brothers' or Sisters' Unit their gender puts them in, which has no row.
 */
export async function unitIdsOfMember(profileId: string, tenureId: string): Promise<string[]> {
    const [{ data: rows }, { data: profile }, { data: units }] = await Promise.all([
        db.from("membership_units").select("unit_id").eq("profile_id", profileId).eq("tenure_id", tenureId),
        db.from("profiles").select("gender").eq("id", profileId).maybeSingle(),
        db.from("units").select("id, slug"),
    ]);
    const ids = new Set((rows ?? []).map((r) => r.unit_id as string));
    for (const u of units ?? []) {
        const gender = genderForUnitSlug(u.slug);
        if (gender && profile?.gender === gender) ids.add(u.id);
    }
    return [...ids];
}

/** Is this member in this unit this tenure? See {@link unitIdsOfMember}. */
export async function isMemberOfUnit(profileId: string, unitId: string, tenureId: string): Promise<boolean> {
    return (await unitIdsOfMember(profileId, tenureId)).includes(unitId);
}


export interface UnitMember {
    /** Empty for a derived member — there is no `membership_units` row to remove. */
    membershipId: string;
    role: string;
    /** True when this member is here by gender rather than by induction. */
    derived?: boolean;
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone_number: string | null;
    department: string | null;
    avatar_url: string | null;
    /** The member's generation — their level is computed from it against the session. */
    class_set_id: string | null;
    gender: string | null;
}

/**
 * Members of one unit in one tenure. Membership is tenure-scoped.
 *
 * Except for the gender categories, which are not tenure-scoped at all: every sister is
 * in the Sisters' Unit for as long as she is a sister, so the roster is a query against
 * `profiles.gender` and the tenure is irrelevant to it.
 */
export async function getUnitMembers(unitId: string, tenureId: string): Promise<UnitMember[]> {
    const { data: unit } = await db
        .from("units")
        .select("slug")
        .eq("id", unitId)
        .maybeSingle();

    const gender = genderForUnitSlug(unit?.slug);
    if (gender) return getMembersByGender(gender);

    const { data, error } = await db
        .from("membership_units")
        .select(`
            id,
            role,
            profile:profiles(id, first_name, last_name, email, phone_number, department, avatar_url, class_set_id, gender)
        `)
        .eq("unit_id", unitId)
        .eq("tenure_id", tenureId);
    if (error) throw new Error(error.message);

    return (data ?? []).map((m) => {
        // PostgREST gives an embedded to-one either as an object or a one-element array
        // depending on how it infers the relationship; normalise both.
        const profile = Array.isArray(m.profile) ? m.profile[0] : m.profile;
        return { membershipId: m.id, role: m.role, ...profile };
    }) as UnitMember[];
}

/**
 * The roster of a gender category, read straight off `profiles`.
 *
 * `membershipId` is empty and `derived` is true, which is what the UI keys off to hide
 * the remove button -- there is no row to delete, and "remove her from the Sisters'
 * Unit" is not a thing the system can honour anyway.
 */
async function getMembersByGender(gender: "male" | "female"): Promise<UnitMember[]> {
    // Paged (fetchAll): half the fellowship is easily past the API's silent 1000-row
    // cap, and a short list here would read as members missing from the unit.
    const data = await fetchAll<Record<string, unknown>>((from, to) =>
        db.from("profiles")
            .select("id, first_name, last_name, email, phone_number, department, avatar_url, class_set_id, gender")
            .eq("gender", gender)
            .order("first_name")
            .order("id")
            .range(from, to),
    );

    return (data ?? []).map((p) => ({
        membershipId: "",
        role: "Member",
        derived: true,
        ...p,
    })) as UnitMember[];
}

export interface ProfileByEmail {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
}

/**
 * Members by email, matched case-insensitively. Keyed by the lower-cased address.
 *
 * Reads `profiles` directly. It used to go through the `get_user_id_by_email` RPC,
 * which reads `auth.users`, the retired Supabase Auth table; anyone who joined after
 * that (every seeded test member, every new registrant) wasn't there, so adding them
 * failed with "No member found".
 *
 * ILIKE rather than `=` because stored addresses aren't guaranteed lower-case. `_` is a
 * one-character wildcard in ILIKE, so the rows are compared exactly again afterwards;
 * `parseEmailList` never yields `%`. Twenty addresses per request keeps the URL short.
 */
export async function findProfilesByEmail(emails: string[]): Promise<Map<string, ProfileByEmail>> {
    const found = new Map<string, ProfileByEmail>();
    const wanted = new Set(emails.map((e) => e.toLowerCase()));
    const chunks: string[][] = [];
    for (let i = 0; i < emails.length; i += 20) chunks.push(emails.slice(i, i + 20));

    const results = await Promise.all(
        chunks.map((chunk) =>
            db
                .from("profiles")
                .select("id, email, first_name, last_name")
                .or(chunk.map((e) => `email.ilike."${e}"`).join(",")),
        ),
    );
    for (const { data, error } of results) {
        if (error) throw new Error(error.message);
        for (const p of data ?? []) {
            const key = (p.email ?? "").toLowerCase();
            if (wanted.has(key)) found.set(key, p as ProfileByEmail);
        }
    }
    return found;
}

/**
 * Put members into a unit or team. Returns the ids that were actually added.
 *
 * The single-unit rule is enforced in the database by the
 * `enforce_single_unit_membership` trigger (migration 0001), not here. Teams are
 * deliberately unconstrained, and `addWorkersAction` sends unit conflicts to the
 * transfer queue before this is reached.
 *
 * One insert for the lot. If it fails (somebody was added by another leader a moment
 * ago), it falls back to one insert per member, so one conflict doesn't sink the rest.
 */
export async function addWorkers(
    tenureId: string,
    unitId: string,
    profileIds: string[],
    actor: MembershipActor,
): Promise<{ added: string[]; failed: { profileId: string; error: string }[] }> {
    if (profileIds.length === 0) return { added: [], failed: [] };
    const row = (profileId: string) => ({
        tenure_id: tenureId,
        profile_id: profileId,
        unit_id: unitId,
        role: "Member",
    });

    let added: string[] = [];
    const failed: { profileId: string; error: string }[] = [];

    const { error } = await db.from("membership_units").insert(profileIds.map(row));
    if (!error) {
        added = profileIds;
    } else {
        const each = await Promise.all(
            profileIds.map(async (profileId) => {
                const { error: e } = await db.from("membership_units").insert(row(profileId));
                return { profileId, e };
            }),
        );
        for (const { profileId, e } of each) {
            if (!e) added.push(profileId);
            else failed.push({
                profileId,
                error: e.code === "23505" ? "Already in this unit." : e.message,
            });
        }
    }

    await logMembershipEvents(
        added.map((profileId) => ({ profileId, unitId, tenureId, action: "added" as const })),
        actor,
    );
    return { added, failed };
}

/**
 * Remove one membership row. Does not touch leadership.
 *
 * The row is read BEFORE the delete: afterwards there is nothing left to say whose
 * membership it was, and the log line would have no subject.
 */
export async function removeWorker(membershipId: string, actor: MembershipActor): Promise<void> {
    const { data: row } = await db
        .from("membership_units")
        .select("profile_id, unit_id, tenure_id")
        .eq("id", membershipId)
        .maybeSingle();

    const { error } = await db.from("membership_units").delete().eq("id", membershipId);
    if (error) throw new Error(error.message);

    if (row) {
        await logMembershipEvents(
            [{ profileId: row.profile_id, unitId: row.unit_id, tenureId: row.tenure_id, action: "removed" }],
            actor,
        );
    }
}

// ---------------------------------------------------------------------------
// Residential zones
// ---------------------------------------------------------------------------

/**
 * Members living in one zone.
 *
 * Note this is NOT tenure-scoped: `profiles.residential_zone_id` is where a member
 * currently lives, which does not reset when a tenure closes.
 */
export async function getZoneMembers(zoneId: string) {
    const { data, error } = await db
        .from("profiles")
        .select("id, first_name, last_name, phone_number, department, avatar_url, school_address")
        .eq("residential_zone_id", zoneId)
        .order("first_name");
    if (error) throw new Error(error.message);
    return data ?? [];
}

export async function createZone(name: string, description?: string | null): Promise<void> {
    const { error } = await db
        .from("residential_zones")
        .insert({ name, description: description ?? null });
    if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Generations
// ---------------------------------------------------------------------------

/**
 * Name a generation ("the naming ceremony") — e.g. the 2022 entrants become
 * "Army of Light". Upserts on entry_year, so re-naming an existing generation works.
 */
export async function setFamilyName(entryYear: number, familyName: string): Promise<void> {
    const { error } = await db
        .from("class_sets")
        .upsert({ entry_year: entryYear, family_name: familyName }, { onConflict: "entry_year" });
    if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/** Update a member's addresses and residential zone. */
export async function updateLocationInfo(
    profileId: string,
    data: { schoolAddress?: string | null; homeAddress?: string | null; residentialZoneId?: string | null },
): Promise<void> {
    const { error } = await db
        .from("profiles")
        .update({
            school_address: data.schoolAddress ?? null,
            home_address: data.homeAddress ?? null,
            residential_zone_id: data.residentialZoneId || null,
            updated_at: new Date().toISOString(),
        })
        .eq("id", profileId);
    if (error) throw new Error(error.message);
}
