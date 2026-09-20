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
}

/** Every unit and team, with how many members each holds (across all tenures). */
export async function getAllUnitsOverview(): Promise<UnitOverview[]> {
    const { data, error } = await db
        .from("units")
        .select("*, members:membership_units(count)")
        .order("name");
    if (error) throw new Error(error.message);

    return (data ?? []).map((u) => ({
        ...u,
        // PostgREST returns an aggregate as a one-element array: [{ count: n }].
        memberCount: u.members?.[0]?.count ?? 0,
    })) as UnitOverview[];
}

export interface UnitMember {
    membershipId: string;
    role: string;
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone_number: string | null;
    department: string | null;
    avatar_url: string | null;
}

/** Members of one unit in one tenure. Membership is tenure-scoped. */
export async function getUnitMembers(unitId: string, tenureId: string): Promise<UnitMember[]> {
    const { data, error } = await db
        .from("membership_units")
        .select(`
            id,
            role,
            profile:profiles(id, first_name, last_name, email, phone_number, department, avatar_url)
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
 * Add an existing member to a unit or team by email.
 *
 * The single-unit rule is enforced in the database by the
 * `enforce_single_unit_membership` trigger (migration 0001), not here — teams are
 * deliberately unconstrained, and unit conflicts are intercepted by the transfer queue
 * in `addWorkerAction` before this is ever reached.
 */
export async function addWorker(tenureId: string, email: string, unitId: string): Promise<void> {
    const { data: profileId, error: lookupError } = await db.rpc("get_user_id_by_email", {
        email_arg: email,
    });
    if (lookupError || !profileId) {
        throw new Error(`No member found with the email ${email}.`);
    }

    const { error } = await db.from("membership_units").insert({
        tenure_id: tenureId,
        profile_id: profileId,
        unit_id: unitId,
        role: "Member",
    });

    if (error) {
        if (error.code === "23505") throw new Error("This member is already in this unit.");
        throw new Error(error.message);
    }
}

/** Remove one membership row. Does not touch leadership. */
export async function removeWorker(membershipId: string): Promise<void> {
    const { error } = await db.from("membership_units").delete().eq("id", membershipId);
    if (error) throw new Error(error.message);
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
