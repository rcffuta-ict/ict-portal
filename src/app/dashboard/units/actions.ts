/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { listPositions, isPresidentPosition, positionGrantsLogin } from "@/lib/positions";
import {
    getAllUnitsOverview,
    getUnitMembers,
    addWorker,
    removeWorker,
} from "@/lib/fellowship";
import { isUndisableablePosition } from "@/config/leadership-positions";
import { getActiveTenure } from "@/utils/action";
import {
    requireContext,
    requireAccess,
    requireVpAdmin,
    canManageUnit,
    canManageLevel,
} from "@/lib/access-control";
import { ensureLoginProvisioned, resetLoginPassword } from "@/lib/auth/provision";
import { computeLevel } from "@/lib/levels";
import { isGenderCategoryUnit } from "@/config/fellowship-units";

// ============================================================================
// DATA LOADER (session/context driven — no more email guessing)
// ============================================================================
export async function getUnitModuleData() {
    const ctx = await requireContext();
    const tenure = await getActiveTenure();
    const tenureId = tenure?.id ?? null;
    const session = tenure?.session ?? null;

    // Managed units/teams come straight from the enriched leadership context.
    const managedUnits = ctx.leadership
        .filter((l) => l.category === "UNIT" || l.category === "TEAM")
        .map((l) => ({
            id: l.unitId,
            name: l.unitName,
            type: l.category, // 'UNIT' | 'TEAM'
            leadershipRole: l.title,
        }))
        .filter((u) => !!u.id);

    // The context carries the POSITION's slug (`exco-sisters`), not the unit's, and the
    // unit slug is what says whether the roster is editable. One lookup rather than
    // deriving it by stripping "exco-", which would silently be wrong for any office
    // that is not named after its unit.
    if (managedUnits.length > 0) {
        const { data: slugs } = await db
            .from("units")
            .select("id, slug")
            .in("id", managedUnits.map((u) => u.id as string));
        const bySlug = new Map((slugs ?? []).map((u: any) => [u.id, u.slug]));
        for (const u of managedUnits) {
            (u as any).slug = bySlug.get(u.id as string) ?? null;
        }
    }

    // Managed levels (generations) — resolve their class_set details for display.
    const levelLeaderships = ctx.leadership.filter((l) => l.category === "LEVEL" && l.classSetId);
    let managedLevels: any[] = [];
    if (levelLeaderships.length > 0) {
        const ids = levelLeaderships.map((l) => l.classSetId);
        const { data: sets } = await db
            .from("class_sets")
            .select("id, family_name, entry_year, is_foundation")
            .in("id", ids as string[]);
        managedLevels = (sets || []).map((s: any) => ({
            classSetId: s.id,
            familyName: s.family_name,
            entryYear: s.entry_year,
            isFoundation: s.is_foundation,
            level: computeLevel(s.entry_year, s.is_foundation, session),
        }));
    }

    if (ctx.isAdmin) {
        const units = await getAllUnitsOverview();
        const positions = await listPositions();
        const unitPositions = positions.filter((p) => p.is_active && p.category === "UNIT");
        return {
            authorized: true,
            role: "ADMIN" as const,
            isAdmin: true,
            tenureId,
            units,
            positions: unitPositions,
            managedUnits,
            managedLevels,
        };
    }

    if (managedUnits.length > 0 || managedLevels.length > 0) {
        return {
            authorized: true,
            role: "LEADER" as const,
            isAdmin: false,
            tenureId,
            managedUnits,
            managedLevels,
        };
    }

    return { authorized: true, role: "NONE" as const, isAdmin: false, tenureId };
}

// ============================================================================
// UNIT / TEAM MEMBERSHIP
// ============================================================================
export async function getUnitDetailsAction(unitId: string) {
    const tenure = await getActiveTenure();
    if (!tenure) return [];
    return getUnitMembers(unitId, tenure.id);
}

/**
 * Add an existing member to a unit or team.
 *
 * Executives do this themselves — no invite token, no approval — because leading a unit
 * IS the authority to decide who is in it. The one exception is a tug-of-war:
 *
 *   * TEAMS are multi-membership by design, so a team add always goes straight through.
 *   * UNITS are exclusive (one per member per tenure, enforced by the DB trigger
 *     `enforce_single_unit_membership`). When the member already belongs to another
 *     unit, this does NOT move them and does NOT fail — it queues a transfer request
 *     for the VP Admin. The member stays exactly where they are until that is approved,
 *     so nobody's roster changes behind their leader's back.
 */
export async function addWorkerAction(formData: FormData) {
    try {
        const ctx = await requireContext();
        const unitId = formData.get("unitId") as string;
        const tenureId = formData.get("tenureId") as string;
        const email = formData.get("email") as string;

        if (!(await canManageUnit(ctx, unitId))) {
            return { success: false, error: "You don't lead this unit/team." };
        }

        const { data: target } = await db
            .from("units")
            .select("id, name, type, slug")
            .eq("id", unitId)
            .maybeSingle();
        if (!target) return { success: false, error: "That unit no longer exists." };

        // The Brothers' and Sisters' units have no roster to add to -- membership IS
        // gender (see genderCategory in src/config/fellowship-units.ts). Refused here
        // and not merely hidden in the UI, because a stored row would create a second,
        // disagreeing answer to "is she in the Sisters' Unit?".
        if (isGenderCategoryUnit(target.slug)) {
            return {
                success: false,
                error: `${target.name} has no roster — every member is in it already, by gender. `
                    + "To correct someone's membership, correct their gender on their profile.",
            };
        }

        // Teams are unconstrained — there is nothing to arbitrate.
        if (target.type === "TEAM") {
            await addWorker(tenureId, email, unitId);
            revalidatePath("/dashboard/units");
            return { success: true };
        }

        const { data: profile } = await db
            .from("profiles")
            .select("id, first_name, last_name")
            .eq("email", (email || "").toLowerCase().trim())
            .maybeSingle();
        if (!profile) {
            return { success: false, error: "No member with that email address." };
        }

        // Does this member already hold a UNIT this tenure?
        const { data: existing } = await db
            .from("membership_units")
            .select("id, unit:units(id, name, type)")
            .eq("profile_id", profile.id)
            .eq("tenure_id", tenureId);

        const currentUnit = (existing ?? [])
            .map((m: any) => (Array.isArray(m.unit) ? m.unit[0] : m.unit))
            .find((u: any) => u?.type === "UNIT");

        if (!currentUnit) {
            await addWorker(tenureId, email, unitId);
            revalidatePath("/dashboard/units");
            return { success: true };
        }

        if (currentUnit.id === unitId) {
            return { success: false, error: "They are already in this unit." };
        }

        // Contested. Queue it for the VP Admin rather than moving anyone.
        const { error } = await db.from("unit_transfer_requests").insert({
            profile_id: profile.id,
            tenure_id: tenureId,
            from_unit_id: currentUnit.id,
            to_unit_id: unitId,
            requested_by: ctx.profile.id,
        });

        if (error) {
            // The partial unique index allows only one open request per member.
            if ((error as any).code === "23505") {
                return {
                    success: false,
                    error: `${profile.first_name} already has a transfer waiting for VP Admin approval.`,
                };
            }
            return { success: false, error: error.message };
        }

        revalidatePath("/dashboard/units");
        revalidatePath("/dashboard/tenure");
        return {
            success: true,
            pendingTransfer: true,
            message: `${profile.first_name} is currently in ${currentUnit.name}. A transfer to ${target.name} has been sent to the VP Admin for approval.`,
        };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function removeWorkerAction(membershipId: string) {
    try {
        await requireContext(); // any leader/admin; membership ownership checked by UI scope
        // A derived member carries no membership id, so there is nothing to remove and
        // nothing that would stay removed.
        if (!membershipId) {
            return {
                success: false,
                error: "This unit's membership follows gender — there is nothing to remove. "
                    + "Correct the member's gender on their profile instead.",
            };
        }
        await removeWorker(membershipId);
        revalidatePath("/dashboard/units");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// ============================================================================
// LEVEL (generation) MEMBERSHIP — for level coordinators
// ============================================================================
export async function getLevelMembersAction(classSetId: string) {
    try {
        const ctx = await requireContext();
        if (!(await canManageLevel(ctx, classSetId))) {
            return { success: false, error: "You don't coordinate this level.", data: [] };
        }
        const { data } = await db
            .from("profiles")
            .select("id, first_name, last_name, email, phone_number, department, avatar_url, matric_number")
            .eq("class_set_id", classSetId)
            .order("first_name");
        return { success: true, data: data || [] };
    } catch (e: any) {
        return { success: false, error: e.message, data: [] };
    }
}

// ============================================================================
// LEADER APPOINTMENT + ROLE MANAGEMENT (VP Admin / ICT Coordinator)
// ============================================================================

/** Options for the appoint form: units/teams + generations (class sets). */
export async function getAppointmentOptionsAction() {
    try {
        await requireAccess("ADMIN");
        const [{ data: units }, { data: classSets }] = await Promise.all([
            db.from("units").select("id, name, type").order("name"),
            db.from("class_sets").select("id, family_name, entry_year").order("entry_year", { ascending: false }),
        ]);
        return { success: true, units: units || [], classSets: classSets || [] };
    } catch (e: any) {
        return { success: false, error: e.message, units: [], classSets: [] };
    }
}

/** Search members to appoint (name / email / matric). */
export async function searchMembersAction(query: string) {
    try {
        await requireAccess("ADMIN");
        const q = (query || "").trim();
        if (q.length < 2) return { success: true, data: [] };
        const { data } = await db
            .from("profiles")
            .select("id, first_name, last_name, email, phone_number, avatar_url")
            .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,matric_number.ilike.%${q}%`)
            .limit(15);
        return { success: true, data: data || [] };
    } catch (e: any) {
        return { success: false, error: e.message, data: [] };
    }
}

/**
 * List all leadership roles (positions), including disabled.
 *
 * `category` is DERIVED from each position's privilege tags (migration 0013 dropped the
 * stored column), and `is_protected` replaces the old `is_default` flag.
 */
export async function listRolesAction() {
    try {
        await requireAccess("ADMIN");
        const positions = await listPositions();
        const data = [...positions].sort(
            (a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title),
        );
        return { success: true, data };
    } catch (e: any) {
        return { success: false, error: e.message, data: [] };
    }
}

/** Create a new leadership role (with alias). */
export async function createRoleAction(input: {
    title: string;
    alias?: string;
    description?: string;
}) {
    try {
        // Catalogue changes belong to the VP Admin, not to every ADMIN-tier role.
        await requireVpAdmin();
        if (!input.title?.trim()) return { success: false, error: "Title is required." };
        // No `category` — it is derived from the privilege tags now. A role created here
        // has none yet, so it reads as 'UNIT' until the VP Admin assigns them.
        const { error } = await db.from("leadership_positions").insert({
            title: input.title.trim(),
            alias: input.alias?.trim() || null,
            description: input.description?.trim() || null,
            is_active: true,
        });
        if (error) throw error;
        revalidatePath("/dashboard/units");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Enable/disable a role. The VP Admin and ICT Coordinator can never be disabled — the
 * fellowship would be left unable to administer itself.
 *
 * Identified by IMMUTABLE SLUG rather than the dropped `is_default` column, so renaming
 * either office in the UI cannot quietly unprotect it.
 */
export async function setRoleActiveAction(positionId: string, isActive: boolean) {
    try {
        // Catalogue changes belong to the VP Admin, not to every ADMIN-tier role.
        await requireVpAdmin();
        const { data: pos } = await db
            .from("leadership_positions")
            .select("slug")
            .eq("id", positionId)
            .maybeSingle();
        if (isUndisableablePosition(pos?.slug) && !isActive) {
            return { success: false, error: "The VP Admin and ICT Coordinator roles cannot be disabled." };
        }
        const { error } = await db
            .from("leadership_positions")
            .update({ is_active: isActive })
            .eq("id", positionId);
        if (error) throw error;
        revalidatePath("/dashboard/units");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Appoint a member to a leadership position, and auto-provision their login so
 * they can access the portal (they set their password via an admin-issued reset
 * link — see createResetInviteAction).
 */
export async function appointLeaderAction(input: {
    profileId: string;
    positionId: string;
    unitId?: string;
    classSetId?: string;
    residentialZoneId?: string;
}) {
    try {
        const admin = await requireAccess("ADMIN");
        const tenure = await getActiveTenure();
        if (!tenure) return { success: false, error: "No active tenure." };

        // Done directly rather than through `ictAdmin.admin.assignLeader()`: the SDK
        // enforces the single-President rule by reading `leadership_positions.category`,
        // which migration 0013 dropped. The rule itself is unchanged — it just reads the
        // PRESIDENT privilege tag, which is where that fact actually lives.
        if (await isPresidentPosition(input.positionId)) {
            const { data: sitting, error: presErr } = await db
                .from("leadership")
                .select("id, position:leadership_positions!inner(position_privileges!inner(privilege))")
                .eq("tenure_id", tenure.id)
                .is("ended_at", null)
                .eq("position.position_privileges.privilege", "PRESIDENT")
                .maybeSingle();
            if (presErr) throw presErr;
            if (sitting) {
                return {
                    success: false,
                    error:
                        "A President has already been appointed for this tenure. Remove the "
                        + "current President before appointing a new one.",
                };
            }
        }

        const { error: assignError } = await db.from("leadership").insert({
            tenure_id: tenure.id,
            profile_id: input.profileId,
            position_id: input.positionId,
            unit_id: input.unitId || null,
            class_set_id: input.classSetId || null,
            residential_zone_id: input.residentialZoneId || null,
        });
        if (assignError) {
            // The one-lead-per-office index (see the tighten_office_catalogue
            // migration). Assistants are unlimited; only the lead seat is exclusive.
            if (assignError.message?.includes("leadership_one_lead_per_position")) {
                throw new Error(
                    "This office already has a lead for this tenure. Add the member as an assistant instead.",
                );
            }
            throw assignError;
        }

        // Auto-create the login (no password until they set one) — but only where the
        // OFFICE grants access. Most of the fellowship's offices exist in the catalogue
        // as a record of service and administer nothing here, so appointing to one must
        // not mint an account. See leadership_positions.grants_login.
        const created = (await positionGrantsLogin(input.positionId))
            ? (await ensureLoginProvisioned(input.profileId, admin.id)).created
            : false;

        revalidatePath("/dashboard/units");
        revalidatePath("/dashboard/tenure");
        return { success: true, loginCreated: created };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Reset a leader's login (the "forgot password" path). Clears their password so
 * they set a new one on their next login. VP Admin / ICT Coordinator only.
 */
export async function resetLeaderLoginAction(leaderProfileId: string) {
    try {
        await requireAccess("ADMIN");
        const { data: login } = await db
            .from("profile_login")
            .select("id")
            .eq("profile_id", leaderProfileId)
            .maybeSingle();
        if (!login) return { success: false, error: "This member doesn't have a portal login." };

        await resetLoginPassword(leaderProfileId);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// ============================================================================
// UNIT POSITION MAPPING (leader/assistant designations per unit) — unchanged API
// ============================================================================
export async function getUnitPositionsAction(unitId: string) {
    try {
        const { data, error } = await db
            .from("unit_positions")
            .select(`id, role_type, position:leadership_positions(id, title, tier, description)`)
            .eq("unit_id", unitId)
            .order("role_type", { ascending: true });
        if (error) throw error;
        const transformed = (data || []).map((item: any) => ({
            ...item,
            position: Array.isArray(item.position) ? item.position[0] : item.position,
        }));
        return { success: true, data: transformed };
    } catch (e: any) {
        return { success: false, error: e.message, data: [] };
    }
}

export async function assignPositionToUnitAction(
    unitId: string,
    positionId: string,
    roleType: "leader" | "assistant",
) {
    try {
        await requireAccess("ADMIN");
        const { data: existing } = await db
            .from("unit_positions")
            .select("id")
            .eq("unit_id", unitId)
            .eq("position_id", positionId)
            .maybeSingle();
        if (existing) throw new Error("This position is already assigned to this unit.");

        if (roleType === "leader") {
            const { data: existingLeader } = await db
                .from("unit_positions")
                .select("id")
                .eq("unit_id", unitId)
                .eq("role_type", "leader")
                .maybeSingle();
            if (existingLeader) throw new Error("This unit already has a leader position assigned.");
        }

        const { error } = await db
            .from("unit_positions")
            .insert({ unit_id: unitId, position_id: positionId, role_type: roleType });
        if (error) throw error;

        revalidatePath("/dashboard/units");
        revalidatePath("/dashboard/tenure");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function removePositionFromUnitAction(unitPositionId: string) {
    try {
        await requireAccess("ADMIN");
        const { error } = await db
            .from("unit_positions")
            .delete()
            .eq("id", unitPositionId);
        if (error) throw error;
        revalidatePath("/dashboard/units");
        revalidatePath("/dashboard/tenure");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getUnitLeadershipAction(unitId: string, tenureId: string) {
    try {
        const { data: unitPositions, error: upError } = await db
            .from("unit_positions")
            .select(`id, role_type, position_id, position:leadership_positions(id, title, tier)`)
            .eq("unit_id", unitId);
        if (upError) throw upError;
        if (!unitPositions || unitPositions.length === 0) return { success: true, data: [] };

        const positionIds = unitPositions.map((up: any) => up.position_id);
        const { data: leadership, error: lError } = await db
            .from("leadership")
            .select(`id, position_id, profile:profiles!leadership_profile_id_fkey(id, first_name, last_name, email, phone_number, avatar_url)`)
            .eq("tenure_id", tenureId)
            .eq("unit_id", unitId)
            .is("ended_at", null)
            .in("position_id", positionIds);
        if (lError) throw lError;

        const result = (leadership || []).map((l: any) => {
            const unitPos = unitPositions.find((up: any) => up.position_id === l.position_id);
            const positionData = Array.isArray(unitPos?.position) ? unitPos?.position[0] : unitPos?.position;
            return {
                unitPositionId: unitPos?.id,
                leadershipId: l.id,
                roleType: unitPos?.role_type || "assistant",
                positionId: l.position_id,
                positionTitle: positionData?.title || "Unknown Position",
                profile: l.profile,
            };
        });
        return { success: true, data: result };
    } catch (e: any) {
        return { success: false, error: e.message, data: [] };
    }
}

export async function getAvailablePositionsAction() {
    try {
        const positions = await listPositions();
        const unitPositions = positions.filter((p) => p.is_active && p.category === "UNIT");
        return { success: true, data: unitPositions };
    } catch (e: any) {
        return { success: false, error: e.message, data: [] };
    }
}
