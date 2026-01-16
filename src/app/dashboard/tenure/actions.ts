/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { RcfIctClient } from "@rcffuta/ict-lib";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

// ============================================================================
// SECURITY & AUTHORIZATION
// ============================================================================

/**
 * Checks if the current user has admin access to the Executive Console
 * Validates session token and checks email against ADMIN_EMAILS whitelist
 * @returns RcfIctClient instance with admin (service role) permissions
 * @throws Error if unauthorized
 */
const checkAdminAccess = async () => {
    // 1. Get the session token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get("sb-access-token")?.value;

    if (!token) {
        throw new Error("Unauthorized: No session token found");
    }

    const rcf = RcfIctClient.fromEnv();

    // 2. Validate token and get user
    const { data: { user }, error } = await rcf.supabase.auth.getUser(token);

    if (error || !user || !user.email) {
        console.error("Auth Error:", error);
        throw new Error("Unauthorized: Invalid session");
    }

    // 3. Check email whitelist (from environment variable)
    const allowedEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
    
    if (!allowedEmails.includes(user.email.toLowerCase())) {
        throw new Error("Access Denied: Your email is not whitelisted for the Executive Console.");
    }
    
    // 4. Return admin client for database operations
    return RcfIctClient.asAdmin();
};

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetches all data needed for the tenure dashboard
 * Includes active tenure, units, families, positions, and leadership assignments
 */
export async function getAdminData() {
    try {
        const rcf = await checkAdminAccess();

        // Get active tenure
        const { data: activeTenure } = await rcf.supabase
            .from('tenures')
            .select('*')
            .eq('is_active', true)
            .single();

        // Fetch all master data in parallel
        const [unitsRes, familiesRes, positionsRes, leadershipRes] = await Promise.all([
            rcf.supabase
                .from('units')
                .select('*, members:membership_units(count)')
                .order('name'),
            
            rcf.supabase
                .from('class_sets')
                .select('*, members:profiles(count)')
                .order('entry_year', { ascending: false }),

            rcf.admin.getPositions(false),
            
            rcf.supabase
                .from('leadership')
                .select(`
                    id, 
                    unit_id, units(name),
                    class_set_id, class_sets(family_name, entry_year),
                    position:leadership_positions(title, category),
                    profile:profiles(id, first_name, last_name, avatar_url, phone_number)
                `)
                .eq('tenure_id', activeTenure.id)
                .order('created_at', { ascending: false })
        ]);

        // Transform units with member counts
        const units = (unitsRes.data || []).map((u: any) => ({
            ...u,
            memberCount: u.members?.[0]?.count || 0
        }));

        // Transform families with member counts
        const families = (familiesRes.data || []).map((f: any) => ({
            ...f,
            memberCount: f.members?.[0]?.count || 0
        }));

        return { 
            activeTenure, 
            units, 
            families, 
            positions: positionsRes, 
            leadership: leadershipRes.data || [],
            authorized: true 
        };
    } catch (e: any) {
        console.error("getAdminData Error:", e);
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
    const rcf = await checkAdminAccess();
    try {
        // Deactivate all existing tenures
        await rcf.supabase.from('tenures').update({ is_active: false }).neq('id', '0');
        
        // Create new tenure
        await rcf.admin.createTenure({
            name: formData.get("name") as string,
            session: formData.get("session") as string,
            startDate: new Date(formData.get("startDate") as string),
        });
        
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
    const rcf = await checkAdminAccess();
    try {
        await rcf.supabase
            .from('tenures')
            .update({ 
                name: formData.get("name"), 
                session: formData.get("session") 
            })
            .eq('id', formData.get("id"));
        
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
    const rcf = await checkAdminAccess();
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
    const rcf = await checkAdminAccess();
    try {
        await rcf.admin.createUnit({
            name: formData.get("name") as string,
            type: formData.get("type") as any
        });
        
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
    const rcf = await checkAdminAccess();
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
 * Gets detailed information about a specific unit including assigned leaders
 */
export async function getUnitDetails(unitId: string) {
    const rcf = await checkAdminAccess();
    
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
 * Creates a new leadership position (role)
 */
export async function createPositionAction(formData: FormData) {
    const rcf = await checkAdminAccess();
    try {
        await rcf.admin.createPosition({
            title: formData.get("title") as string,
            category: formData.get("category") as any,
            description: formData.get("description") as string,
            isActive: true
        });
        
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
    const rcf = await checkAdminAccess();
    try {
        await rcf.admin.updatePosition(id, { ...data, isActive: !currentStatus });
        
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
    // Use admin client to bypass RLS
    const rcf = RcfIctClient.asAdmin();

    const { data, error } = await rcf.supabase
        .from('profiles')
        .select(`
            id, 
            first_name, 
            last_name, 
            phone_number,
            avatar_url,
            membership_units (
                units ( name, type )
            )
        `)
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone_number.ilike.%${query}%`)
        .limit(10);

    if (error) {
        console.error("Search Error:", error);
        return [];
    }

    // Transform data to separate units and teams
    const formattedData = data.map((user: any) => {
        const units = user.membership_units
            ?.map((m: any) => m.units)
            .filter((u: any) => u.type === 'UNIT')
            .map((u: any) => u.name);

        const teams = user.membership_units
            ?.map((m: any) => m.units)
            .filter((u: any) => u.type === 'TEAM')
            .map((u: any) => u.name);

        return {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            phone_number: user.phone_number,
            units: units.length > 0 ? units.join(", ") : null,
            teams: teams.length > 0 ? teams.join(", ") : null
        };
    });

    return formattedData;
}

/**
 * Assigns a member to a leadership position
 */
export async function assignLeaderAction(formData: FormData) {
    const rcf = await checkAdminAccess();
    
    // Handle empty strings as undefined for optional UUIDs
    const unitId = formData.get("unitId") as string;
    const classSetId = formData.get("classSetId") as string;

    try {
        await rcf.admin.assignLeader({
            tenureId: formData.get("tenureId") as string,
            profileId: formData.get("profileId") as string,
            positionId: formData.get("positionId") as string,
            unitId: unitId || undefined,
            classSetId: classSetId || undefined
        });
        
        revalidatePath('/dashboard/tenure');
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
    const rcf = await checkAdminAccess();
    
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
    const rcf = await checkAdminAccess();
    try {
        await rcf.supabase.from('leadership').delete().eq('id', id);
        
        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}