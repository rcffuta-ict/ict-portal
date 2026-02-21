"use server";

import { cookies } from "next/headers";
import { RcfIctClient } from "@rcffuta/ict-lib/server";
import { getAdminClient } from "@/src/lib/supabase/server";
import type { SessionData } from "@/src/lib/stores/profile.store";

export async function getSessionAction(): Promise<{
    success: boolean;
    data?: Omit<SessionData, "lastRefresh">;
    error?: string;
}> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("sb-access-token")?.value;

        if (!token) return { success: false, error: "No session token." };

        const supabase = getAdminClient();
        const {
            data: { user },
            error,
        } = await supabase.auth.getUser(token);

        if (error || !user) return { success: false, error: "Invalid or expired session." };

        const rcf = RcfIctClient.fromEnv();
        const profile = await rcf.member.getFullProfile(user.id);
        if (!profile) return { success: false, error: "Profile not found." };

        const eventSlug = process.env.CFM_EVENT_SLUG || "cfm";
        const { data: event } = await supabase
            .from("events")
            .select("id, title, date")
            .eq("slug", eventSlug)
            .maybeSingle();

        let raffleId: number | null = null;
        if (event) {
            const { data: reg } = await supabase
                .from("event_registrations")
                .select("raffle_id")
                .eq("event_id", event.id)
                .eq("email", user.email ?? "")
                .maybeSingle();
            raffleId = reg?.raffle_id ?? null;
        }

        return {
            success: true,
            data: {
                profile,
                raffleId,
                eventTitle: event?.title ?? "Combined Family Meeting",
                eventDate: event?.date ?? "",
            },
        };
    } catch (err: any) {
        console.error("[getSessionAction]", err);
        return { success: false, error: err?.message || "Failed to restore session." };
    }
}
