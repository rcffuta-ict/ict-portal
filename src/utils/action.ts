"use server"
import { RcfIctClient, Tenure } from "@rcffuta/ict-lib/server";

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
