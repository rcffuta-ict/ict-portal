/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { requireModuleRead, requireModuleWrite } from "@/lib/access-control";
import { ictAdmin } from "@/lib/ict";
import { computeLevel, LEVELS } from "@/lib/levels";
import { RcfIctClient } from "@rcffuta/ict-lib/server";
import { revalidatePath } from "next/cache";

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetches all data needed for the tenure dashboard
 * Includes active tenure, units, families, positions, and leadership assignments
 */
export async function getAdminData() {
    try {
        // READ is gated by the tenure module's access config (default: CENTRAL);
        // the mutations below require WRITE access (default: vp-admin; admins bypass).
        await requireModuleRead("tenure");
        const rcf = ictAdmin;

        // 1. Get Active Tenure
        const { data: activeTenure } = await rcf.supabase
            .from('tenures')
            .select('*')
            .eq('is_active', true)
            .single();

        // 2. Fetch Master Data. We fetch positions directly (not via the SDK) so we
        //    control the columns we need (slug, alias, is_default, is_central).
        const [unitsRes, familiesRes, positionsRes, leadershipRes, profilesRes, membershipRes] = await Promise.all([
            rcf.supabase.from('units').select('*').order('name'),
            rcf.supabase.from('class_sets').select('*').order('entry_year', { ascending: false }),
            rcf.supabase.from('leadership_positions').select('*').order('category').order('title'),
            // Fetch ALL leadership for the active tenure
            activeTenure
                ? rcf.supabase.from('leadership')
                    .select(`
                        id, is_lead, unit_id, units(name, type, is_workforce),
                        class_set_id, class_sets(family_name, entry_year),
                        position:leadership_positions(title, category, is_central, slug),
                        profile:profiles(id, first_name, last_name, avatar_url, department, phone_number, gender)
                    `)
                    .eq('tenure_id', activeTenure.id)
                    .order('created_at', { ascending: false })
                : { data: [] },
            // All profiles (id/gender/class_set) — drives church-wide + generation stats.
            rcf.supabase.from('profiles').select('id, gender, class_set_id'),
            // Unit memberships for the active tenure — drives per-unit + workforce stats.
            activeTenure
                ? rcf.supabase.from('membership_units').select('profile_id, unit_id').eq('tenure_id', activeTenure.id)
                : { data: [] },
        ]);

        // 3. Process Data
        const leaders = leadershipRes.data || [];
        const allProfiles = profilesRes.data || [];
        const memberships = membershipRes.data || [];
        const genderById = new Map<string, string | null>(
            allProfiles.map((p: any) => [p.id, p.gender]),
        );

        // Empty gender tally helper.
        const tally = () => ({ total: 0, male: 0, female: 0 });
        const addGender = (acc: any, gender: string | null | undefined) => {
            acc.total += 1;
            if (gender === 'male') acc.male += 1;
            else if (gender === 'female') acc.female += 1;
        };

        // Per-unit stats from memberships.
        const unitStats = new Map<string, ReturnType<typeof tally>>();
        for (const m of memberships as any[]) {
            if (!unitStats.has(m.unit_id)) unitStats.set(m.unit_id, tally());
            addGender(unitStats.get(m.unit_id), genderById.get(m.profile_id));
        }

        const units = (unitsRes.data || []).map((u: any) => {
            const s = unitStats.get(u.id) || tally();
            return {
                ...u,
                memberCount: s.total,
                stats: s,
                leaders: leaders
                    .filter((l: any) => l.unit_id === u.id && l.is_lead !== false)
                    .map((l: any) => ({ ...l.profile, role: l.position?.title })),
            };
        });

        // Per-generation stats from profiles.class_set_id.
        const famStats = new Map<string, ReturnType<typeof tally>>();
        for (const p of allProfiles as any[]) {
            if (!p.class_set_id) continue;
            if (!famStats.has(p.class_set_id)) famStats.set(p.class_set_id, tally());
            addGender(famStats.get(p.class_set_id), p.gender);
        }

        const families = (familiesRes.data || []).map((f: any) => {
            const s = famStats.get(f.id) || tally();
            return {
                ...f,
                memberCount: s.total,
                stats: s,
                leaders: leaders
                    .filter((l: any) => l.class_set_id === f.id && l.is_lead !== false)
                    .map((l: any) => ({ ...l.profile, role: l.position?.title })),
            };
        });

        // Church-wide session stats. Workers = distinct members in a workforce UNIT.
        const workforceUnitIds = new Set(
            (unitsRes.data || [])
                .filter((u: any) => u.type === 'UNIT' && u.is_workforce !== false)
                .map((u: any) => u.id),
        );
        const workerIds = new Set(
            (memberships as any[])
                .filter((m) => workforceUnitIds.has(m.unit_id))
                .map((m) => m.profile_id),
        );
        const sessionStats = {
            totalMembers: allProfiles.length,
            totalWorkers: workerIds.size,
            totalMale: allProfiles.filter((p: any) => p.gender === 'male').length,
            totalFemale: allProfiles.filter((p: any) => p.gender === 'female').length,
            totalUnits: (unitsRes.data || []).filter((u: any) => u.type === 'UNIT').length,
            totalTeams: (unitsRes.data || []).filter((u: any) => u.type === 'TEAM').length,
            totalGenerations: (familiesRes.data || []).length,
        };

        return {
            activeTenure,
            units,
            families,
            positions: positionsRes.data || [],
            leadership: leaders,
            sessionStats,
            authorized: true,
        };

    } catch (e) {
        return { authorized: false, error: "Access Denied" };
    }
}


// ============================================================================
// TENURE MANAGEMENT
// ============================================================================

/**
 * Creates a new tenure and deactivates all existing tenures
 */
export async function createTenureAction(formData: FormData) {
    await requireModuleWrite("tenure");
    const rcf = ictAdmin;
    try {
        // Deactivate all existing tenures
        await rcf.supabase.from('tenures').update({ is_active: false }).neq('id', '0');

        // Create new tenure (insert directly so we can persist the theme; the ict-lib
        // createTenure helper doesn't accept it).
        const theme = ((formData.get("theme") as string) || "").trim();
        const { error } = await rcf.supabase.from('tenures').insert({
            name: formData.get("name") as string,
            session: formData.get("session") as string,
            start_date: new Date(formData.get("startDate") as string).toISOString(),
            theme: theme || null,
            is_active: true,
        });
        if (error) return { success: false, error: error.message };

        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Updates an existing tenure's name and session
 */
export async function updateTenureAction(formData: FormData) {
    await requireModuleWrite("tenure");
    const rcf = ictAdmin;
    try {
        await rcf.supabase
            .from('tenures')
            .update({
                name: formData.get("name"),
                session: formData.get("session"),
                theme: ((formData.get("theme") as string) || "").trim() || null,
            })
            .eq('id', formData.get("id"));

        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Handover: close the current tenure and open the next one in a single step,
 * auto-appointing the incoming VP Admin and ICT Coordinator into the new tenure.
 * This is the sanctioned way to end a tenure (see the Tenure Profile tab).
 */
export async function handoverTenureAction(formData: FormData) {
    await requireModuleWrite("tenure");
    const rcf = ictAdmin;
    try {
        const name = ((formData.get("name") as string) || "").trim();
        const session = ((formData.get("session") as string) || "").trim();
        const startDate = formData.get("startDate") as string;
        const theme = ((formData.get("theme") as string) || "").trim();
        const vpAdminProfileId = formData.get("vpAdminProfileId") as string;
        const ictCoordProfileId = formData.get("ictCoordProfileId") as string;

        if (!name || !session || !startDate) {
            return { success: false, error: "New tenure name, session and start date are required." };
        }
        if (!vpAdminProfileId || !ictCoordProfileId) {
            return { success: false, error: "You must appoint the incoming VP Admin and ICT Coordinator." };
        }

        // Look up the two protected default positions.
        const { data: positions } = await rcf.supabase
            .from('leadership_positions')
            .select('id, title')
            .in('title', ['Vice President Administration', 'ICT Coordinator']);
        const vpPos = positions?.find((p) => p.title === 'Vice President Administration');
        const ictPos = positions?.find((p) => p.title === 'ICT Coordinator');
        if (!vpPos || !ictPos) {
            return { success: false, error: "Default VP Admin / ICT Coordinator positions are missing." };
        }

        // Close the current tenure.
        await rcf.supabase.from('tenures')
            .update({ is_active: false, end_date: new Date().toISOString() })
            .eq('is_active', true);

        // Open the new tenure.
        const { data: newTenure, error: tErr } = await rcf.supabase.from('tenures')
            .insert({
                name,
                session,
                start_date: new Date(startDate).toISOString(),
                theme: theme || null,
                is_active: true,
            })
            .select('id')
            .single();
        if (tErr || !newTenure) return { success: false, error: tErr?.message || "Could not create the new tenure." };

        // Auto-appoint the incoming defaults into the new tenure.
        const { error: lErr } = await rcf.supabase.from('leadership').insert([
            { tenure_id: newTenure.id, profile_id: vpAdminProfileId, position_id: vpPos.id, is_lead: true },
            { tenure_id: newTenure.id, profile_id: ictCoordProfileId, position_id: ictPos.id, is_lead: true },
        ]);
        if (lErr) return { success: false, error: `Tenure created, but appointing leaders failed: ${lErr.message}` };

        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Closes a tenure (sets is_active = false, adds end_date)
 */
export async function closeTenureAction(tenureId: string) {
    await requireModuleWrite("tenure");
    const rcf = ictAdmin;
    try {
        await rcf.supabase.from('tenures')
            .update({ is_active: false, end_date: new Date() })
            .eq('id', tenureId);
        
        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// ============================================================================
// STRUCTURE MANAGEMENT
// ============================================================================

/**
 * Creates a new unit (ministry/team)
 */
export async function createUnitAction(formData: FormData) {
    await requireModuleWrite("tenure");
    const rcf = ictAdmin;
    try {
        const type = formData.get("type") as string;
        // "Loose units" are type UNIT whose members don't count as workforce
        // (e.g. Sisters Unit). Teams never count. Insert directly so we can set it.
        const isWorkforce = type === 'UNIT'
            ? formData.get("isWorkforce") !== "false"
            : false;
        const { error } = await rcf.supabase.from('units').insert({
            name: formData.get("name") as string,
            type,
            is_workforce: isWorkforce,
        });
        if (error) {
            if (error.code === '23505') return { success: false, error: "A unit/team with that name already exists." };
            return { success: false, error: error.message };
        }

        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Assigns a family name to an entry year (e.g., 2023 → "Eagles")
 */
export async function nameFamilyAction(formData: FormData) {
    await requireModuleWrite("tenure");
    const rcf = ictAdmin;
    try {
        await rcf.admin.setFamilyName({
            entryYear: parseInt(formData.get("entryYear") as string),
            familyName: formData.get("familyName") as string
        });

        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Creates (or updates) a generation by entry year, with an optional name and the
 * PDS/UABS foundation flag. Entry year is unique — re-using one updates that set.
 */
export async function createGenerationAction(formData: FormData) {
    await requireModuleWrite("tenure");
    const rcf = ictAdmin;
    try {
        const entryYear = parseInt(formData.get("entryYear") as string);
        if (!entryYear || Number.isNaN(entryYear)) {
            return { success: false, error: "A valid entry year is required." };
        }
        const familyName = ((formData.get("familyName") as string) || "").trim();
        const isFoundation = formData.get("isFoundation") === "true";

        const { error } = await rcf.supabase
            .from('class_sets')
            .upsert(
                { entry_year: entryYear, family_name: familyName || null, is_foundation: isFoundation },
                { onConflict: 'entry_year' },
            );
        if (error) return { success: false, error: error.message };

        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Sets (or clears) a generation's manual level override. Enforces the "no two
 * generations share a level" rule against every other generation's EFFECTIVE level
 * (its own override, else its computed level for the active session).
 * Pass an empty/null level to clear the override.
 */
export async function setLevelOverrideAction(classSetId: string, level: string | null) {
    await requireModuleWrite("tenure");
    const rcf = ictAdmin;
    try {
        const target = (level || "").trim();

        // Clearing: just null it out.
        if (!target) {
            const { error } = await rcf.supabase
                .from('class_sets').update({ level_override: null }).eq('id', classSetId);
            if (error) return { success: false, error: error.message };
            revalidatePath('/dashboard/tenure');
            return { success: true };
        }

        if (!LEVELS.includes(target as (typeof LEVELS)[number])) {
            return { success: false, error: `"${target}" is not a valid level.` };
        }

        // Resolve the active session + all generations to check for a level clash.
        const { data: active } = await rcf.supabase
            .from('tenures').select('session').eq('is_active', true).single();
        const session = active?.session ?? null;

        const { data: sets } = await rcf.supabase
            .from('class_sets').select('id, entry_year, is_foundation, level_override');

        const clash = (sets || []).some((s: any) => {
            if (s.id === classSetId) return false;
            const effective = s.level_override
                || computeLevel(s.entry_year, s.is_foundation, session);
            return effective === target;
        });
        if (clash) {
            return { success: false, error: `Another generation is already at ${target}.` };
        }

        const { error } = await rcf.supabase
            .from('class_sets').update({ level_override: target }).eq('id', classSetId);
        if (error) {
            if (error.code === '23505') return { success: false, error: `Another generation is already at ${target}.` };
            return { success: false, error: error.message };
        }
        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Toggles a position's CENTRAL privilege. Default positions stay central.
 */
export async function toggleCentralAction(id: string, current: boolean) {
    await requireModuleWrite("tenure");
    const rcf = ictAdmin;
    try {
        const { data: pos } = await rcf.supabase
            .from('leadership_positions').select('is_default, slug').eq('id', id).single();
        // The ICT Coordinator is the System Admin, never a central.
        if (pos?.slug === 'ict-coord') {
            return { success: false, error: "The ICT Coordinator is the System Admin, not a central." };
        }
        if (current && pos?.is_default) {
            return { success: false, error: "Default positions are always central." };
        }
        const { error } = await rcf.supabase
            .from('leadership_positions').update({ is_central: !current }).eq('id', id);
        if (error) return { success: false, error: error.message };
        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Gets detailed information about a specific unit including assigned leaders
 */
export async function getUnitDetails(unitId: string) {
    await requireModuleRead("tenure");
    const rcf = ictAdmin;

    // Get active tenure ID
    const { data: active } = await rcf.supabase
        .from('tenures')
        .select('id')
        .eq('is_active', true)
        .single();
    
    if (!active) return { leaders: [] };

    // Fetch leaders for this unit in the active tenure
    const { data: leaders } = await rcf.supabase
        .from('leadership')
        .select(`
            id,
            position:leadership_positions(title, category),
            profile:profiles(id, first_name, last_name, avatar_url, phone_number)
        `)
        .eq('unit_id', unitId)
        .eq('tenure_id', active.id);

    return { leaders };
}

// ============================================================================
// LEADERSHIP & CABINET MANAGEMENT
// ============================================================================

/**
 * Slugify a label into a stable position handle (lowercase, kebab-case).
 * Mirrors the backfill logic in db/migrations/0004.
 */
function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Creates a new leadership position (role) with a stable, unique slug.
 *
 * The ict-lib PositionSchema has no alias/slug, so we insert directly. The slug is
 * derived from the provided slug/alias/title, is set ONCE here, and is never changed
 * on update (immutable) — access config references positions by slug.
 */
export async function createPositionAction(formData: FormData) {
    await requireModuleWrite("tenure");
    const rcf = ictAdmin;
    try {
        const title = ((formData.get("title") as string) || "").trim();
        const alias = ((formData.get("alias") as string) || "").trim();
        const rawSlug = ((formData.get("slug") as string) || "").trim();
        const description = ((formData.get("description") as string) || "").trim();
        const category = formData.get("category") as any;

        if (!title) return { success: false, error: "Role title is required." };

        const slug = slugify(rawSlug || alias || title);
        if (!slug) return { success: false, error: "A valid slug (letters/numbers) is required." };

        // Central privilege can be set at create; CENTRAL-category roles are central by default.
        const isCentral = formData.get("isCentral") === "true" || category === "CENTRAL";

        const { error } = await rcf.supabase.from("leadership_positions").insert({
            title,
            alias: alias || null,
            slug,
            category,
            description: description || null,
            is_central: isCentral,
            is_active: true,
        });

        if (error) {
            if (error.code === "23505") {
                return { success: false, error: "That role title or slug is already in use." };
            }
            return { success: false, error: error.message };
        }

        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Toggles a position's active status
 */
export async function togglePositionAction(id: string, currentStatus: boolean, data: any) {
    await requireModuleWrite("tenure");
    const rcf = ictAdmin;
    try {
        // The two seeded defaults (VP Admin / ICT Coordinator) may never be disabled.
        if (currentStatus && data?.is_default) {
            return { success: false, error: "This is a protected default role and cannot be disabled." };
        }

        // Never send slug/id — slug is immutable; PositionSchema strips unknown keys,
        // but we drop them explicitly for clarity.
        const { slug: _slug, id: _id, is_default: _def, ...rest } = data ?? {};
        void _slug; void _id; void _def;
        await rcf.admin.updatePosition(id, { ...rest, isActive: !currentStatus });

        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Searches for members by name, email, or phone number
 * Returns formatted results with unit/team memberships
 */
export async function searchMemberAction(query: string) {
    const rcf = RcfIctClient.asAdmin(); 

    const { data, error } = await rcf.supabase
        .rpc('search_members_detailed', { 
            query_text: query.trim() 
        });

    if (error) {
        console.error("Search RPC Error:", error);
        return [];
    }

    return data.map((user: any) => ({
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone_number: user.phone_number,
        department: user.department,
        level: user.level, // <--- Now available! (e.g. "500 Level")
        avatar_url: user.avatar_url,
        units: user.units?.join(", ") || null,
        teams: user.teams?.join(", ") || null,
        leadership: user.leadership?.map((l:any) => l.title).join(", ") || null
    }));
}
/**
 * Assigns a member to a leadership position
 */
export async function assignLeaderAction(formData: FormData) {
    const rcf = RcfIctClient.asAdmin();
    await requireModuleWrite("tenure");

    const tenureId = formData.get("tenureId") as string;
    const profileId = formData.get("profileId") as string;
    const positionId = formData.get("positionId") as string;
    const unitId = formData.get("unitId") as string;
    const classSetId = formData.get("classSetId") as string;
    // Sub-leaders (assistants) share the same position with is_lead = false.
    const isLead = formData.get("isLead") !== "false";

    try {
        // Enforce the single-President rule (mirrors ict-lib assignLeader).
        const { data: position } = await rcf.supabase
            .from("leadership_positions").select("category").eq("id", positionId).single();
        if (!position) return { success: false, error: "Position not found." };

        if (position.category === "PRESIDENT") {
            const { data: existingPresident } = await rcf.supabase
                .from("leadership")
                .select("id, position:leadership_positions!inner(category)")
                .eq("tenure_id", tenureId)
                .eq("position.category", "PRESIDENT")
                .maybeSingle();
            if (existingPresident) {
                return { success: false, error: "A President has already been appointed for this tenure." };
            }
        }

        // A position may have only ONE lead per context; assistants are unlimited.
        // NULL scopes must be matched with .is(), not .eq().
        if (isLead) {
            let leadQuery = rcf.supabase
                .from("leadership")
                .select("id")
                .eq("tenure_id", tenureId)
                .eq("position_id", positionId)
                .eq("is_lead", true);
            leadQuery = unitId ? leadQuery.eq("unit_id", unitId) : leadQuery.is("unit_id", null);
            leadQuery = classSetId ? leadQuery.eq("class_set_id", classSetId) : leadQuery.is("class_set_id", null);
            const { data: existingLead } = await leadQuery.maybeSingle();
            if (existingLead) {
                return { success: false, error: "This position already has a lead here. Add them as an assistant instead." };
            }
        }

        const { error } = await rcf.supabase.from("leadership").insert({
            tenure_id: tenureId,
            profile_id: profileId,
            position_id: positionId,
            unit_id: unitId || null,
            class_set_id: classSetId || null,
            is_lead: isLead,
        });
        if (error) {
            if (error.code === '23505') {
                return { success: false, error: "This member is already assigned to this role context." };
            }
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
/**
 * Assigns a leader to a specific unit (used in ManageUnitModal)
 * Auto-fills tenure ID from active tenure
 */
export async function addUnitLeaderAction(formData: FormData) {
    await requireModuleWrite("tenure");
    const rcf = ictAdmin;
    
    // Get active tenure
    const { data: tenure } = await rcf.supabase
        .from('tenures')
        .select('id')
        .eq('is_active', true)
        .single();
    
    if (!tenure) {
        return { success: false, error: "No active tenure" };
    }

    // Append tenure ID and call main assign function
    formData.append("tenureId", tenure.id);
    return assignLeaderAction(formData);
}

/**
 * Removes a leadership assignment
 */
export async function removeUnitLeaderAction(id: string) {
    await requireModuleWrite("tenure");
    const rcf = ictAdmin;
    try {
        await rcf.supabase.from('leadership').delete().eq('id', id);
        
        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

