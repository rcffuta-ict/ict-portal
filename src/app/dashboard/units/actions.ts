/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { checkIsAdminByEmail, checkAdminAccess } from "@/utils/action";
import { RcfIctClient } from "@rcffuta/ict-lib/server";
import { revalidatePath } from "next/cache";

// --- DATA LOADER ---
export async function getUnitModuleData({userId, email, tenureId}: {userId:string, email: string, tenureId: string}) {
    const rcf = RcfIctClient.fromEnv();
    
    // 1. Check Admin Access
    const isAdmin = await checkIsAdminByEmail(email);

    if (isAdmin) {
        // Admins see ALL units
        const units = await rcf.unit.getAllUnitsOverview();
        
        // Also fetch all leadership positions for admin
        const positions = await rcf.admin.getPositions(false);
        const activePositions = positions?.filter((p: any) => p.is_active && p.category === 'UNIT');
        
        return { role: 'ADMIN', units, tenureId, positions: activePositions, authorized: true };
    } 
    
    // 2. Check Unit Leader Access (Fetch Array)
    const myManagedUnits = await rcf.unit.getMyManagedUnits(userId, tenureId);

    if (myManagedUnits.length > 0) {
        // If they manage at least one thing, they are a LEADER
        return { 
            role: 'LEADER', 
            units: myManagedUnits, // Returns array: [{id: 1, name: 'Choir', type: 'UNIT'}, {id: 2, name: 'Welfare', type: 'TEAM'}]
            tenureId, 
            authorized: true 
        };
    }

    return { role: 'NONE', authorized: true };
}

// --- ACTIONS ---

export async function addWorkerAction(formData: FormData) {
    const rcf = RcfIctClient.asAdmin(); // Use Admin client for writes
    try {
        await rcf.unit.addWorker(
            formData.get("tenureId") as string,
            formData.get("email") as string,
            formData.get("unitId") as string
        );
        revalidatePath('/dashboard/units');
        return { success: true };
    } catch(e: any) { return { success: false, error: e.message }; }
}

export async function removeWorkerAction(membershipId: string) {
    const rcf = RcfIctClient.asAdmin();
    try {
        await rcf.unit.removeWorker(membershipId);
        revalidatePath('/dashboard/units');
        return { success: true };
    } catch(e: any) { return { success: false, error: e.message }; }
}

// Helper for Admin to fetch specific unit members when clicking a card
export async function getUnitDetailsAction(unitId: string) {
    const rcf = RcfIctClient.asAdmin();
    const { data: tenure } = await rcf.supabase.from('tenures').select('id').eq('is_active', true).single();
    if(!tenure) return [];
    
    return await rcf.unit.getUnitMembers(unitId, tenure.id);
}

// ============================================================================
// UNIT POSITION MANAGEMENT (Links leadership positions to units)
// ============================================================================

/**
 * Get all positions assigned to a unit (leader and assistant roles)
 */
export async function getUnitPositionsAction(unitId: string) {
    const rcf = RcfIctClient.asAdmin();
    try {
        const { data, error } = await rcf.supabase
            .from('unit_positions')
            .select(`
                id,
                role_type,
                position:leadership_positions(id, title, category, description)
            `)
            .eq('unit_id', unitId)
            .order('role_type', { ascending: true }); // leaders first
        
        if (error) throw error;
        
        // Transform data to ensure position is an object, not array
        const transformed = (data || []).map((item: any) => ({
            ...item,
            position: Array.isArray(item.position) ? item.position[0] : item.position
        }));
        
        return { success: true, data: transformed };
    } catch (e: any) {
        return { success: false, error: e.message, data: [] };
    }
}

/**
 * Assign a leadership position to a unit as leader or assistant
 */
export async function assignPositionToUnitAction(
    unitId: string, 
    positionId: string, 
    roleType: 'leader' | 'assistant'
) {
    const rcf = RcfIctClient.asAdmin();
    await checkAdminAccess();
    
    try {
        // Check if this position is already assigned to this unit
        const { data: existing } = await rcf.supabase
            .from('unit_positions')
            .select('id')
            .eq('unit_id', unitId)
            .eq('position_id', positionId)
            .single();
        
        if (existing) {
            throw new Error('This position is already assigned to this unit.');
        }
        
        // Check if a leader already exists for this unit (if trying to add leader)
        if (roleType === 'leader') {
            const { data: existingLeader } = await rcf.supabase
                .from('unit_positions')
                .select('id')
                .eq('unit_id', unitId)
                .eq('role_type', 'leader')
                .single();
            
            if (existingLeader) {
                throw new Error('This unit already has a leader position assigned.');
            }
        }
        
        const { error } = await rcf.supabase
            .from('unit_positions')
            .insert({
                unit_id: unitId,
                position_id: positionId,
                role_type: roleType
            });
        
        if (error) throw error;
        
        revalidatePath('/dashboard/units');
        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Remove a position assignment from a unit
 */
export async function removePositionFromUnitAction(unitPositionId: string) {
    const rcf = RcfIctClient.asAdmin();
    await checkAdminAccess();
    
    try {
        const { error } = await rcf.supabase
            .from('unit_positions')
            .delete()
            .eq('id', unitPositionId);
        
        if (error) throw error;
        
        revalidatePath('/dashboard/units');
        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Get all leaders and assistants for a unit in a specific tenure
 * This returns people who are actually assigned to leadership positions
 */
export async function getUnitLeadershipAction(unitId: string, tenureId: string) {
    const rcf = RcfIctClient.asAdmin();
    try {
        // 1. Get all positions assigned to this unit
        const { data: unitPositions, error: upError } = await rcf.supabase
            .from('unit_positions')
            .select(`
                id,
                role_type,
                position_id,
                position:leadership_positions(id, title, category)
            `)
            .eq('unit_id', unitId);
        
        if (upError) throw upError;
        if (!unitPositions || unitPositions.length === 0) {
            return { success: true, data: [] };
        }
        
        // 2. Get leadership assignments for those positions in this tenure
        const positionIds = unitPositions.map((up: any) => up.position_id);
        
        const { data: leadership, error: lError } = await rcf.supabase
            .from('leadership')
            .select(`
                id,
                position_id,
                profile:profiles(id, first_name, last_name, email, phone_number, avatar_url)
            `)
            .eq('tenure_id', tenureId)
            .eq('unit_id', unitId)
            .in('position_id', positionIds);
        
        if (lError) throw lError;
        
        // 3. Combine the data
        const result = (leadership || []).map((l: any) => {
            const unitPos = unitPositions.find((up: any) => up.position_id === l.position_id);
            // Handle position as array or object from Supabase join
            const positionData = Array.isArray(unitPos?.position) ? unitPos?.position[0] : unitPos?.position;
            return {
                unitPositionId: unitPos?.id,
                leadershipId: l.id,
                roleType: unitPos?.role_type || 'assistant',
                positionId: l.position_id,
                positionTitle: positionData?.title || 'Unknown Position',
                profile: l.profile
            };
        });
        
        return { success: true, data: result };
    } catch (e: any) {
        return { success: false, error: e.message, data: [] };
    }
}

/**
 * Get all available leadership positions (for dropdown selection)
 */
export async function getAvailablePositionsAction() {
    const rcf = RcfIctClient.asAdmin();
    try {
        const positions = await rcf.admin.getPositions(false);
        // Filter for active UNIT category positions only
        const unitPositions = positions?.filter((p: any) => p.is_active && p.category === 'UNIT') || [];
        return { success: true, data: unitPositions };
    } catch (e: any) {
        return { success: false, error: e.message, data: [] };
    }
}