"use server"
import { RcfIctClient } from "@rcffuta/ict-lib";

export async function getActiveTenureName() {
    const rcf = RcfIctClient.fromEnv();

    try {
        const { data } = await rcf.supabase
            .from("tenures")
            .select("name")
            .eq("is_active", true)
            .single();

        return data?.name || null;
    } catch (error) {
        console.error("Error fetching active tenure:", error);
        return null; // Fallback if no tenure exists
    }
}