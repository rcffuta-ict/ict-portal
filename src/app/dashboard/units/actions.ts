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
    membershipActorOf,
    isMemberOfUnit,
} from "@/lib/fellowship";
import { getProfileContext } from "@/lib/auth/profile-context";
import { computeLevel } from "@/lib/levels";
import { isUndisableablePosition } from "@/config/leadership-positions";
import { getActiveTenure } from "@/utils/action";
import type { ProfileContext } from "@/lib/auth/profile-context";
import {
    requireContext,
    requireModuleRead,
    requireModuleWrite,
    requireAccess,
    requireAdminWrite,
    requireVpAdmin,
    canManageUnit,
    canManageLevel,
} from "@/lib/access-control";
import { ensureLoginProvisioned, resetLoginPassword } from "@/lib/auth/provision";
import { isGenderCategoryUnit } from "@/config/fellowship-units";

// ============================================================================
// DATA LOADER
// ============================================================================

type ManagedUnit = { id: string; slug: string; name: string; type: "UNIT" | "TEAM" };

/**
 * The units and teams this session may manage, read from its EXCO privilege tags.
 *
 * Tags, not `leadership.unit_id`: an Exco office is appointed from the cabinet with no
 * unit on the row, and what it governs is its `EXCO:<slug>` scope — the same thing
 * canManageUnit() reads, so the list shown and the permission checked cannot disagree.
 * Assistants hold the office's tags too, so they qualify; `is_lead` is never consulted.
 * An honorary office carries no tags and so manages nothing.
 *
 * Not exported: this file is "use server", and every export is a callable endpoint.
 */
async function managedUnitsOf(ctx: ProfileContext): Promise<ManagedUnit[]> {
    const scopes = ctx.leadership
        .flatMap((l) => l.privileges ?? [])
        .filter((p) => p.tag === "EXCO")
        .map((p) => p.scope);
    if (scopes.length === 0) return [];

    const everything = scopes.some((s) => s == null || s.toLowerCase() === "all");
    const query = db.from("units").select("id, slug, name, type").order("name");
    const { data } = everything
        ? await query
        : await query.in("slug", scopes.filter((s): s is string => !!s));
    return (data ?? []) as ManagedUnit[];
}

/** May this session READ a unit's roster? Admin read tier, or it manages the unit. */
async function canViewUnit(ctx: ProfileContext, unitId: string): Promise<boolean> {
    return ctx.isAdmin || (await canManageUnit(ctx, unitId));
}

export async function getUnitModuleData() {
    const ctx = await requireModuleRead("workforce");
    const tenure = await getActiveTenure();
    const tenureId = tenure?.id ?? null;

    // The System Admin and VP Admin may change any roster; the President sees every
    // unit but is write-blocked everywhere, so their view is read-only.
    const canWriteAll = ctx.isSysAdmin || ctx.isVpAdmin;

    if (ctx.isAdmin) {
        const units = await getAllUnitsOverview(tenureId);
        return {
            authorized: true as const,
            role: "ADMIN" as const,
            tenureId,
            canWriteAll,
            units,
        };
    }

    const managedUnits = await managedUnitsOf(ctx);
    // Which office gives the authority, for the card. The first EXCO-tagged office is
    // enough: two offices over the same unit is not a real configuration.
    const excoOffice = ctx.leadership.find((l) =>
        (l.privileges ?? []).some((p) => p.tag === "EXCO"));

    return {
        authorized: true as const,
        role: managedUnits.length > 0 ? ("LEADER" as const) : ("NONE" as const),
        tenureId,
        canWriteAll: false,
        managedUnits: managedUnits.map((u) => ({
            ...u,
            leadershipRole: excoOffice?.alias || excoOffice?.title || "Executive",
        })),
    };
}

/**
 * One unit or team's page: the unit itself and how this session sees it.
 *
 * Gated by canViewUnit, the same check every roster action makes, so a unit whose page
 * opens is one whose data will load. `view` picks the tab set: the admin read tier gets
 * positions and leadership too; an Executive gets their roster.
 */
export async function getUnitPageAction(unitId: string) {
    try {
        const ctx = await requireModuleRead("workforce");
        if (!(await canViewUnit(ctx, unitId))) {
            return { success: false as const, error: "You don't lead this unit or team." };
        }
        const [{ data: unit }, tenure] = await Promise.all([
            db.from("units").select("id, slug, name, type").eq("id", unitId).maybeSingle(),
            getActiveTenure(),
        ]);
        if (!unit) return { success: false as const, error: "That unit or team doesn't exist." };

        const excoOffice = ctx.leadership.find((l) =>
            (l.privileges ?? []).some((p) => p.tag === "EXCO"));

        return {
            success: true as const,
            unit: unit as ManagedUnit,
            tenureId: tenure?.id ?? null,
            view: ctx.isAdmin ? ("ADMIN" as const) : ("LEADER" as const),
            // The President reads every unit but changes none. The server refuses the
            // writes regardless; this only hides controls that would always fail.
            readOnly: ctx.isAdmin && !(ctx.isSysAdmin || ctx.isVpAdmin),
            leadershipRole: ctx.isAdmin ? null : excoOffice?.alias || excoOffice?.title || "Executive",
        };
    } catch (e: any) {
        return { success: false as const, error: e.message };
    }
}

// ============================================================================
// UNIT / TEAM MEMBERSHIP
// ============================================================================
/**
 * One unit's roster for the active tenure. Carries members' emails and phone numbers,
 * so it is gated: the admin read tier, or somebody who manages this unit.
 */
export async function getUnitDetailsAction(unitId: string) {
    try {
        const ctx = await requireModuleRead("workforce");
        if (!(await canViewUnit(ctx, unitId))) {
            return { success: false as const, error: "You don't lead this unit/team.", data: [] };
        }
        const tenure = await getActiveTenure();
        if (!tenure) return { success: false as const, error: "There is no active tenure.", data: [] };
        return { success: true as const, data: await getUnitMembers(unitId, tenure.id) };
    } catch (e: any) {
        return { success: false as const, error: e.message, data: [] };
    }
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
        const ctx = await requireModuleWrite("workforce");
        const unitId = formData.get("unitId") as string;
        const email = formData.get("email") as string;

        if (!(await canManageUnit(ctx, unitId))) {
            return { success: false, error: "You don't lead this unit/team." };
        }

        // Always the ACTIVE tenure, resolved here. Taking it from the form would let a
        // crafted request write into a closed tenure's roster.
        const tenure = await getActiveTenure();
        if (!tenure) return { success: false, error: "There is no active tenure." };
        const tenureId = tenure.id;

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
            await addWorker(tenureId, email, unitId, membershipActorOf(ctx));
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
            await addWorker(tenureId, email, unitId, membershipActorOf(ctx));
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
        const ctx = await requireModuleWrite("workforce");
        // A derived member carries no membership id, so there is nothing to remove and
        // nothing that would stay removed.
        if (!membershipId) {
            return {
                success: false,
                error: "This unit's membership follows gender — there is nothing to remove. "
                    + "Correct the member's gender on their profile instead.",
            };
        }

        // Authorized against the unit the membership actually belongs to — never
        // against what the UI happened to show. Hiding a button is not a permission.
        const { data: membership } = await db
            .from("membership_units")
            .select("unit_id")
            .eq("id", membershipId)
            .maybeSingle();
        if (!membership) return { success: false, error: "That membership no longer exists." };
        if (!(await canManageUnit(ctx, membership.unit_id))) {
            return { success: false, error: "You don't lead this unit/team." };
        }

        await removeWorker(membershipId, membershipActorOf(ctx));
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
        const admin = await requireAdminWrite();
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
        await requireAdminWrite();
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
        // Catalogue data, no personal details. Signed-in only, not ADMIN: the Tenure
        // console (readable by every CENTRAL office) opens this too.
        await requireContext();
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
        await requireAdminWrite();
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
        await requireAdminWrite();
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
        // Returns leaders' contact details; admin-only, like the panels that call it.
        await requireAccess("ADMIN");
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
        await requireContext(); // catalogue only; see getUnitPositionsAction
        const positions = await listPositions();
        const unitPositions = positions.filter((p) => p.is_active && p.category === "UNIT");
        return { success: true, data: unitPositions };
    } catch (e: any) {
        return { success: false, error: e.message, data: [] };
    }
}

// ============================================================================
// MEMBERSHIP LOG
// ============================================================================

const LOG_PAGE_SIZE = 20;

/**
 * One unit's membership history for the active tenure, newest first, 20 at a time.
 * The same people who may read the roster may read how it came to be.
 */
export async function getMembershipLogAction(unitId: string, page = 0) {
    try {
        const ctx = await requireModuleRead("workforce");
        if (!(await canViewUnit(ctx, unitId))) {
            return { success: false as const, error: "You don't lead this unit/team.", data: [], hasMore: false };
        }
        const tenure = await getActiveTenure();
        if (!tenure) return { success: true as const, data: [], hasMore: false };

        const from = Math.max(0, Math.floor(page)) * LOG_PAGE_SIZE;
        // One extra row tells us whether there is another page without a count query.
        const { data, error } = await db
            .from("membership_events")
            .select(`
                id, action, actor_name, created_at,
                profile:profiles!membership_events_profile_id_fkey(first_name, last_name)
            `)
            .eq("unit_id", unitId)
            .eq("tenure_id", tenure.id)
            .order("created_at", { ascending: false })
            .range(from, from + LOG_PAGE_SIZE);
        if (error) throw new Error(error.message);

        const rows = (data ?? []).map((r: any) => {
            const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
            return {
                id: r.id as string,
                action: r.action as string,
                actorName: (r.actor_name as string | null) ?? null,
                createdAt: r.created_at as string,
                memberName: [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "A member",
            };
        });
        return {
            success: true as const,
            data: rows.slice(0, LOG_PAGE_SIZE),
            hasMore: rows.length > LOG_PAGE_SIZE,
        };
    } catch (e: any) {
        return { success: false as const, error: e.message, data: [], hasMore: false };
    }
}

// ============================================================================
// ONE MEMBER, SEEN FROM THEIR UNIT
// ============================================================================

/**
 * Gate shared by the member page and the update link: the caller may read this unit,
 * AND the member is actually in it this session. The second check is what stops an
 * exco reading any member in the fellowship by editing the profile id in the URL.
 */
async function authorizeUnitMember(unitId: string, profileId: string) {
    const ctx = await requireModuleRead("workforce");
    if (!(await canViewUnit(ctx, unitId))) {
        return { ok: false as const, error: "You don't lead this unit/team." };
    }
    const tenure = await getActiveTenure();
    if (!tenure) return { ok: false as const, error: "There is no active tenure." };
    if (!(await isMemberOfUnit(profileId, unitId, tenure.id))) {
        return { ok: false as const, error: "That person isn't in this unit this session." };
    }
    return { ok: true as const, ctx, tenure };
}

/** Full detail for a member of one of the caller's units. */
export async function getUnitMemberDetailAction(unitId: string, profileId: string) {
    try {
        const auth = await authorizeUnitMember(unitId, profileId);
        if (!auth.ok) return { success: false as const, error: auth.error };

        const [detail, { data: unit }] = await Promise.all([
            getProfileContext(profileId),
            db.from("units").select("id, name").eq("id", unitId).maybeSingle(),
        ]);
        if (!detail) return { success: false as const, error: "Could not load this member." };

        return {
            success: true as const,
            data: detail,
            unitName: unit?.name ?? "Unit",
            // UI convenience only — the update-link action re-checks it.
            canManage: await canManageUnit(auth.ctx, unitId),
        };
    } catch (e: any) {
        return { success: false as const, error: e.message };
    }
}

// ============================================================================
// UPDATE LINK — the level coordinator's, never the exco's
// ============================================================================

/**
 * The member's generation's usable update token, or null.
 *
 * The token belongs to the level coordinator: `purpose = 'level'`, at most one active per
 * generation (registration_invites_one_active_level_token). "Usable" is checked in full
 * — active, not revoked, not expired, uses remaining — because an exco handing out a
 * dead link is worse than being told there isn't one. Per-member tokens
 * (`target_profile_id`) were issued for somebody specific and are never borrowed.
 */
async function usableLevelToken(classSetId: string) {
    const { data } = await db
        .from("registration_invites")
        .select("id, token, expires_at, max_uses, use_count")
        .eq("class_set_id", classSetId)
        .eq("purpose", "level")
        .eq("is_active", true)
        .is("revoked_at", null)
        .is("target_profile_id", null)
        .maybeSingle();
    if (!data) return null;
    if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return null;
    if (data.max_uses != null && (data.use_count ?? 0) >= data.max_uses) return null;
    return data as { id: string; token: string };
}

/** "300 Level", "Eagles", or null — how the page names the member's generation. */
async function generationLabelOf(profileId: string, session: string | null) {
    const { data } = await db
        .from("profiles")
        .select("class_set:class_sets(id, family_name, entry_year, is_foundation, level_override)")
        .eq("id", profileId)
        .maybeSingle();
    const cs: any = Array.isArray(data?.class_set) ? data?.class_set[0] : data?.class_set;
    if (!cs) return { classSetId: null, label: null };
    const level = cs.level_override || computeLevel(cs.entry_year, !!cs.is_foundation, session);
    return { classSetId: cs.id as string, label: (level || cs.family_name || null) as string | null };
}

/**
 * Whether an update link exists for this member — WITHOUT the token. The page only
 * needs to know whether to offer the button; the token itself is fetched at the moment
 * of copying (copyMemberUpdateLinkAction), so it never sits in a rendered page.
 */
export async function getMemberUpdateLinkStatusAction(unitId: string, profileId: string) {
    try {
        const auth = await authorizeUnitMember(unitId, profileId);
        if (!auth.ok) return { success: false as const, error: auth.error };
        if (!(await canManageUnit(auth.ctx, unitId))) {
            return { success: false as const, error: "Only the unit's Executive can share update links." };
        }

        const gen = await generationLabelOf(profileId, auth.tenure.session);
        if (!gen.classSetId) {
            return { success: true as const, available: false, generation: null, reason: "no-generation" as const };
        }
        const token = await usableLevelToken(gen.classSetId);
        return {
            success: true as const,
            available: !!token,
            generation: gen.label,
            reason: token ? null : ("no-token" as const),
        };
    } catch (e: any) {
        return { success: false as const, error: e.message };
    }
}

/**
 * Resolve the update link at click time, and record that it was handed out.
 *
 * Returns a path, not a URL: the browser prefixes its own origin. Never creates a
 * token — there is no code path from Workforce that inserts into registration_invites.
 */
export async function copyMemberUpdateLinkAction(unitId: string, profileId: string) {
    try {
        const auth = await authorizeUnitMember(unitId, profileId);
        if (!auth.ok) return { success: false as const, error: auth.error };
        if (!(await canManageUnit(auth.ctx, unitId))) {
            return { success: false as const, error: "Only the unit's Executive can share update links." };
        }

        const gen = await generationLabelOf(profileId, auth.tenure.session);
        const token = gen.classSetId ? await usableLevelToken(gen.classSetId) : null;
        if (!token) {
            return {
                success: false as const,
                error: `No update link for ${gen.label ?? "this member's generation"} — their coordinator has not issued one.`,
            };
        }

        // Copying hands out a credential, so it is on the record like issuing one.
        const actor = membershipActorOf(auth.ctx);
        const { error } = await db.from("invite_events").insert({
            invite_id: token.id,
            action: "copied",
            profile_id: profileId,
            actor_name: actor.name,
            actor_email: auth.ctx.profile.email ?? null,
        });
        if (error) console.error("invite_events copied write failed:", error.message);

        return {
            success: true as const,
            path: `/register?invite=${encodeURIComponent(token.token)}&reason=update`,
        };
    } catch (e: any) {
        return { success: false as const, error: e.message };
    }
}

// ============================================================================
// BIRTHDAYS
// ============================================================================

/**
 * Who in this unit celebrates a birthday in the given month.
 *
 * The roster is resolved here (it may be computed from gender, not rows) and only its
 * ids go to `rcf_birthdays`, which filters by month in SQL and returns the day — never
 * a date of birth, never a year. 29 February is celebrated on the 28th in a year that
 * isn't a leap year; that rule lives in the SQL function, once.
 */
export async function getUnitBirthdaysAction(unitId: string, month: number, year: number) {
    try {
        const ctx = await requireModuleRead("workforce");
        if (!(await canViewUnit(ctx, unitId))) {
            return { success: false as const, error: "You don't lead this unit/team.", data: [] };
        }
        if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
            return { success: false as const, error: "Pick a valid month.", data: [] };
        }
        const tenure = await getActiveTenure();
        if (!tenure) return { success: true as const, data: [] };

        const members = await getUnitMembers(unitId, tenure.id);
        const ids = members.map((m) => m.id);
        if (ids.length === 0) return { success: true as const, data: [] };
        // The roster is already in hand, so the card's details cost no extra query.
        const byId = new Map(members.map((m: any) => [m.id as string, m]));

        const { data, error } = await db.rpc("rcf_birthdays", {
            p_profile_ids: ids,
            p_month: month,
            p_year: year,
        });
        if (error) throw new Error(error.message);

        return {
            success: true as const,
            data: (data ?? []).map((r: any) => {
                const m: any = byId.get(r.profile_id);
                return {
                    profileId: r.profile_id as string,
                    firstName: (r.first_name as string | null) ?? null,
                    lastName: (r.last_name as string | null) ?? null,
                    name: [r.first_name, r.last_name].filter(Boolean).join(" "),
                    avatarUrl: (r.avatar_url as string | null) ?? null,
                    day: r.celebrate_day as number,
                    department: (m?.department as string | null) ?? null,
                    phone: (m?.phone_number as string | null) ?? null,
                };
            }),
        };
    } catch (e: any) {
        return { success: false as const, error: e.message, data: [] };
    }
}
