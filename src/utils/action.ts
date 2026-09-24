"use server"

import type { Tenure } from "@/lib/types/portal";
import { tenureLabel } from "@/lib/tenure";
import { db } from "@/lib/db";
import { requireAccess } from "@/lib/access-control";

export async function getActiveTenure(): Promise<Tenure | null> {
    try {
        // Service-role client: RLS is default-deny, so anon reads no longer work.
        const { data } = await db
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

/**
 * The active tenure's short label (its theme once coronated, its session until then),
 * or null when there is no active tenure — so a footer can simply leave it out.
 */
export async function getActiveTenureLabel(): Promise<string | null> {
    try {
        const dt = await getActiveTenure();
        return dt ? tenureLabel(dt) : null;
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
    return db;
};

/**
 * Position-based admin check by email (used where only an email is available).
 *
 * Reads the PRIVILEGE TAGS directly — the same source `rcf_profile_context` uses — so
 * this can no longer disagree with the rest of the system. It previously tested the
 * `is_default` / `category` columns, which migration 0013 dropped: both were
 * hand-maintained duplicates of what the tags already say.
 *
 * SYSADMIN (ICT Coordinator), PRESIDENT and CENTRAL (the VPs) are the church-wide
 * offices. Deliberately NOT scoped to the active tenure, matching the previous
 * behaviour of this function.
 */
export const checkIsAdminByEmail = async (email: string) => {
    if (!email) return false;

    try {
        const { data: profile } = await db
            .from("profiles")
            .select("id")
            .eq("email", email)
            .maybeSingle();

        if (!profile) return false;

        const { data: rows, error } = await db
            .from("leadership")
            .select("id, position:leadership_positions(position_privileges(privilege))")
            .eq("profile_id", profile.id)
            // Ended appointments confer nothing -- see migration 0014.
            .is("ended_at", null);

        if (error) {
            console.error("checkIsAdminByEmail: leadership lookup failed:", error.message);
            return false;
        }

        const ADMIN_TAGS = new Set(["SYSADMIN", "PRESIDENT", "CENTRAL"]);

        return (rows ?? []).some((r) => {
            const pos = Array.isArray(r.position) ? r.position[0] : r.position;
            const privileges = (pos?.position_privileges ?? []) as { privilege: string }[];
            return privileges.some((pp) => ADMIN_TAGS.has(pp.privilege));
        });
    } catch (error) {
        console.error("checkIsAdminByEmail failed:", error);
        return false;
    }
};
