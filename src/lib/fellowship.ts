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
    const [{ data, error }, memberships] = await Promise.all([
        db.from("units").select("*").order("name"),
        // Paged: every membership row of the tenure, not the first 1000 (fetchAll).
        tenureId
            ? fetchAll<{ unit_id: string }>((from, to) =>
                db.from("membership_units").select("unit_id")
                    .eq("tenure_id", tenureId).order("id").range(from, to),
            )
            : Promise.resolve([] as { unit_id: string }[]),
    ]);
    if (error) throw new Error(error.message);

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

/**
 * Add an existing member to a unit or team by email.
 *
 * The single-unit rule is enforced in the database by the
 * `enforce_single_unit_membership` trigger (migration 0001), not here — teams are
 * deliberately unconstrained, and unit conflicts are intercepted by the transfer queue
 * in `addWorkerAction` before this is ever reached.
 */
export async function addWorker(
    tenureId: string,
    email: string,
    unitId: string,
    actor: MembershipActor,
): Promise<void> {
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

    await logMembershipEvents([{ profileId, unitId, tenureId, action: "added" }], actor);
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
