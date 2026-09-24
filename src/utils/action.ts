"use server"

import { cache } from "react";
import type { Tenure } from "@/lib/types/portal";
import { tenureLabel } from "@/lib/tenure";
import { db } from "@/lib/db";

/**
 * The active tenure, read once per request (almost every loader and gate needs it).
 * Not exported: this file is "use server", where only async functions may be exported,
 * and every export is a callable endpoint.
 */
const activeTenureOnce = cache(async (): Promise<Tenure | null> => {
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
});

export async function getActiveTenure(): Promise<Tenure | null> {
    return activeTenureOnce();
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

// Removed: `checkAdminAccess` (returned the service-role client from a callable
// server action) and `checkIsAdminByEmail` (authorized by an email the CALLER supplied,
// so anyone could claim to be an admin by naming one). Authorize from the session:
// requireAccess / requireAdminWrite in src/lib/access-control.ts.
