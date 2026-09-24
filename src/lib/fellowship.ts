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
import { genderForUnitSlug } from "@/config/fellowship-units";

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
    const [{ data, error }, { data: memberships, error: mError }] = await Promise.all([
        db.from("units").select("*").order("name"),
        tenureId
            ? db.from("membership_units").select("unit_id").eq("tenure_id", tenureId)
            : Promise.resolve({ data: [] as { unit_id: string }[], error: null }),
    ]);
    if (error) throw new Error(error.message);
    if (mError) throw new Error(mError.message);

    const counts = new Map<string, number>();
    for (const m of memberships ?? []) counts.set(m.unit_id, (counts.get(m.unit_id) ?? 0) + 1);

    const rows = data ?? [];
    const genderCounts = rows.some((u) => genderForUnitSlug(u.slug))
        ? await countProfilesByGender()
        : { male: 0, female: 0 };

    return rows.map((u) => {
        const gender = genderForUnitSlug(u.slug);
        return {
            ...u,
            isGenderCategory: gender !== null,
            memberCount: gender ? genderCounts[gender] : (counts.get(u.id) ?? 0),
        };
    }) as UnitOverview[];
}

/** How many profiles are recorded as each gender. */
async function countProfilesByGender(): Promise<{ male: number; female: number }> {
    const [male, female] = await Promise.all([
        db.from("profiles").select("id", { count: "exact", head: true }).eq("gender", "male"),
        db.from("profiles").select("id", { count: "exact", head: true }).eq("gender", "female"),
    ]);
    return { male: male.count ?? 0, female: female.count ?? 0 };
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
 * The roster of a gender category, read straight off `profiles`.
 *
 * `membershipId` is empty and `derived` is true, which is what the UI keys off to hide
 * the remove button -- there is no row to delete, and "remove her from the Sisters'
 * Unit" is not a thing the system can honour anyway.
 */
async function getMembersByGender(gender: "male" | "female"): Promise<UnitMember[]> {
    const { data, error } = await db
        .from("profiles")
        .select("id, first_name, last_name, email, phone_number, department, avatar_url")
        .eq("gender", gender)
        .order("first_name");
    if (error) throw new Error(error.message);

    return (data ?? []).map((p) => ({
        membershipId: "",
        role: "Member",
        derived: true,
        ...p,
    })) as UnitMember[];
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
