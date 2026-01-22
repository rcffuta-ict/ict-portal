/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'


import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { RcfIctClient } from "@rcffuta/ict-lib/server";

// --- LOADER ---
export async function getZoneModuleData({userId, email, tenureId}:{userId:string, email: string, tenureId: string}) {
    const rcf = RcfIctClient.fromEnv();
    
    // 1. Get User & Active Tenure
    // const cookieStore = await cookies();
    // const token = cookieStore.get("sb-access-token")?.value;
    // if (!token) return { authorized: false };
    // const { data: { user } } = await rcf.supabase.auth.getUser(token);
    
    // const { data: tenure } = await rcf.supabase
    //     .from('tenures').select('id').eq('is_active', true).single();
    
    // if (!user || !tenure) return { authorized: false };

    // 2. Check Role
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",");
    const isCoordinator = adminEmails.includes(email || "");

    if (isCoordinator) {
        // Coordinator sees ALL zones
        const zones = await rcf.zone.getAllZonesOverview();
        return { role: 'COORDINATOR', zones, tenureId: tenureId, authorized: true };
    } else {
        // Check if Hall Pastor
        const { role, zoneId } = await rcf.zone.getUserZoneRole(userId, tenureId);
        
        if (role === 'PASTOR' && zoneId) {
            // Pastor sees THEIR zone members
            const members = await rcf.zone.getZoneMembers(zoneId);
            return { role: 'PASTOR', members, zoneId, authorized: true };
        }
    }

    return { role: 'NONE', authorized: true };
}

// --- WRITE ACTIONS ---

export async function createZoneAction(formData: FormData) {
    const rcf = RcfIctClient.asAdmin();
    // Security check omitted for brevity, ensure you checkAdminAccess()
    try {
        await rcf.zone.createZone(
            formData.get("name") as string,
            formData.get("description") as string
        );
        revalidatePath('/dashboard/zones');
        return { success: true };
    } catch(e:any) { return { success: false, error: e.message }; }
}

export async function assignPastorAction(formData: FormData) {
    const rcf = RcfIctClient.asAdmin();
    try {
        await rcf.zone.assignHallPastor(
            formData.get("tenureId") as string,
            formData.get("email") as string, // Inputting Email
            formData.get("zoneId") as string
        );
        revalidatePath('/dashboard/zones');
        return { success: true };
    } catch(e:any) { return { success: false, error: e.message }; }
}

// Get details for Coordinator when clicking a zone card
export async function getZoneDetailsAction(zoneId: string, tenureId: string) {
    const rcf = RcfIctClient.asAdmin();

    if (!tenureId) throw new Error("No active tenure given");
    
    const [pastors, members] = await Promise.all([
        rcf.zone.getZonePastors(zoneId, tenureId),
        rcf.zone.getZoneMembers(zoneId)
    ]);
    
    return { pastors, members };
}

export async function removePastorAction(leadershipId: string) {
    // 1. Use Admin Client for Write Permission
    const rcf = RcfIctClient.asAdmin();

    try {
        // 2. Delete the row from leadership table
        const { error } = await rcf.supabase
            .from('leadership')
            .delete()
            .eq('id', leadershipId);

        if (error) throw error;

        // 3. Refresh the page data
        revalidatePath('/dashboard/zones');
        
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}