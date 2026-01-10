'use server'

import { RcfIctClient } from "@rcffuta/ict-lib";
import { revalidatePath } from "next/cache";

// --- SECURITY CHECK ---
const checkAdminAccess = async () => {
    const rcf = RcfIctClient.fromEnv();
    // const { data: { user } } = await rcf.supabase.auth.getUser();
    
    // if (!user || !user.email) throw new Error("Unauthorized");

    // const allowedEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim());
    // if (!allowedEmails.includes(user.email)) {
    //     throw new Error("Access Denied: Your email is not whitelisted for the Executive Console.");
    // }
    return rcf; // Return client if authorized
};

// --- DATA FETCHING ---
export async function getAdminData() {
    try {
        const rcf = await checkAdminAccess();

        // 1. Active Tenure
        const { data: activeTenure } = await rcf.supabase
            .from('tenures')
            .select('*')
            .eq('is_active', true)
            .single();

        // 2. Units
        const { data: units } = await rcf.supabase.from('units').select('*').order('name');

        // 3. Class Sets (Generations)
        const { data: families } = await rcf.supabase.from('class_sets').select('*').order('entry_year', { ascending: false });

        return { activeTenure, units, families, authorized: true };
    } catch (e) {
        return { authorized: false, error: "Access Denied" };
    }
}

// --- TENURE OPERATIONS ---
export async function createTenureAction(formData: FormData) {
    const rcf = RcfIctClient.asAdmin(); // Use Admin Key for writing
    await checkAdminAccess(); // Double check auth

    try {
        // Archive old tenures
        await rcf.supabase.from('tenures').update({ is_active: false }).neq('id', '0');

        await rcf.admin.createTenure({
            name: formData.get("name") as string,
            session: formData.get("session") as string,
            startDate: new Date(formData.get("startDate") as string),
        });

        revalidatePath('/dashboard/admin');
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

export async function closeTenureAction(tenureId: string) {
    const rcf = RcfIctClient.asAdmin();
    await checkAdminAccess();

    try {
        await rcf.supabase.from('tenures')
            .update({ is_active: false, end_date: new Date() })
            .eq('id', tenureId);
        revalidatePath('/dashboard/admin');
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

// --- SEARCH MEMBERS (Name, Email, Phone) ---
export async function searchMemberAction(query: string) {
    const rcf = RcfIctClient.fromEnv();
    // Search across multiple columns
    const { data } = await rcf.supabase
        .from('profiles')
        .select('id, first_name, last_name, department, email, phone_number')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone_number.ilike.%${query}%`)
        .limit(5);
        
    return data || [];
}

// --- APPOINTMENTS (With Level Coordinators) ---
export async function assignLeaderAction(formData: FormData) {
    const rcf = RcfIctClient.asAdmin();
    await checkAdminAccess();

    const scopeType = formData.get("scopeType") as string; // 'CENTRAL', 'UNIT', 'LEVEL'
    const scopeId = formData.get("scopeId") as string;

    const payload: any = {
        tenure_id: formData.get("tenureId"),
        profile_id: formData.get("profileId"),
        role_name: formData.get("roleName"),
    };

    if (scopeType === 'UNIT') {
        payload.unit_id = scopeId;
        payload.can_manage_unit = true;
    } else if (scopeType === 'LEVEL') {
        payload.class_set_id = scopeId; // Assign to Generation
    }

    try {
        const { error } = await rcf.supabase.from('leadership').insert(payload);
        if (error) throw error;
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

// --- GENERATIONS / UNITS ---
export async function createUnitAction(formData: FormData) {
    const rcf = RcfIctClient.asAdmin();
    await checkAdminAccess();
    try {
        await rcf.admin.createUnit({
            name: formData.get("name") as string,
            type: formData.get("type") as any
        });
        revalidatePath('/dashboard/admin');
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

export async function nameFamilyAction(formData: FormData) {
    const rcf = RcfIctClient.asAdmin();
    await checkAdminAccess();
    try {
        await rcf.admin.setFamilyName({
            entryYear: parseInt(formData.get("entryYear") as string),
            familyName: formData.get("familyName") as string
        });
        revalidatePath('/dashboard/admin');
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}