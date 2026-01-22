/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { checkIsAdminByEmail } from "@/utils/action";
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
        return { role: 'ADMIN', units, tenureId, authorized: true };
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