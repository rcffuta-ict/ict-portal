"use server"
import { RcfIctClient, Tenure } from "@rcffuta/ict-lib/server";
import { cookies } from "next/headers";

export async function getActiveTenure(): Promise<Tenure | null> {
    const rcf = RcfIctClient.fromEnv();

    try {
        const { data } = await rcf.supabase
            .from("tenures")
            .select("*")
            .eq("is_active", true)
            .single();

        return data || null;
    } catch (error) {
        console.error("Error fetching active tenure:", error);
        return null; // Fallback if no tenure exists
    }
}

export async function getActiveTenureName() {


    try {
        const dt = await getActiveTenure();

        return dt?.name || "No Active Tenure";
    } catch (error) {
        console.error("Error fetching active tenure:", error);
        return null; // Fallback if no tenure exists
    }
}



// ============================================================================
// SECURITY & AUTHORIZATION
// ============================================================================

/**
 * Checks if the current user has admin access to the Executive Console
 * Validates session token and checks email against ADMIN_EMAILS whitelist
 * @returns RcfIctClient instance with admin (service role) permissions
 * @throws Error if unauthorized
 */
export const checkAdminAccess = async () => {
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

export const checkIsAdminByEmail = async (email:string) => {

    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",");
    return adminEmails.includes(email || "");
}