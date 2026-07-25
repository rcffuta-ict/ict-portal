"use server"

import { Tenure } from "@rcffuta/ict-lib/server";
import { ictAdmin } from "@/lib/ict";
import { requireAccess } from "@/lib/access-control";

export async function getActiveTenure(): Promise<Tenure | null> {
    try {
        // Service-role client: RLS is default-deny, so anon reads no longer work.
        const { data } = await ictAdmin.supabase
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
        return null;
    }
}

// ============================================================================
// SECURITY & AUTHORIZATION
// ============================================================================

/**
 * Ensures the current session belongs to an ADMIN (VP Admin / ICT Coordinator /
 * PRESIDENT scope) and returns the service-role client for privileged DB writes.
 * @throws Error if unauthorized.
 */
export const checkAdminAccess = async () => {
    await requireAccess("ADMIN"); // throws if not an admin
    return ictAdmin;
};

/**
 * Position-based admin check by email (used where only an email is available).
 * Returns true if the profile with this email currently holds a default admin
 * position (VP Admin / ICT Coordinator) or a PRESIDENT-scope role.
 */
export const checkIsAdminByEmail = async (email: string) => {
    if (!email) return false;

    try {
        const { data: profile } = await ictAdmin.supabase
            .from("profiles")
            .select("id")
            .eq("email", email)
            .maybeSingle();

        if (!profile) return false;

        const { data: rows } = await ictAdmin.supabase
            .from("leadership")
            .select("id, position:leadership_positions(is_default, category)")
            .eq("profile_id", profile.id);

        return (rows || []).some((r) => {
            const pos = Array.isArray(r.position) ? r.position[0] : r.position;
            return pos?.is_default === true || pos?.category === "PRESIDENT";
        });
    } catch (error) {
        console.error("checkIsAdminByEmail failed:", error);
        return false;
    }
};
