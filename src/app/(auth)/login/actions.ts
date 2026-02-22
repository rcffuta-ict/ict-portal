"use server";

import { RcfIctClient } from "@rcffuta/ict-lib/server";
import { cookies } from "next/headers";
import { getAdminClient, broadcastOracleEvent } from "@/src/lib/supabase/server";

const RAFFLE_BASE = parseInt(process.env.RAFFLE_ID_BASE || "42700", 10);

async function generateRaffleId(eventId: string): Promise<number> {
    const supabase = getAdminClient();
    const { data: existing } = await supabase
        .from("event_registrations")
        .select("raffle_id")
        .eq("event_id", eventId)
        .not("raffle_id", "is", null);

    const taken = new Set((existing || []).map((r: any) => r.raffle_id as number));
    let base = RAFFLE_BASE;

    for (let attempt = 0; attempt < 500; attempt++) {
        const jitter = Math.floor(Math.random() * 100);
        const id = base + jitter;
        if (!taken.has(id)) return id;
        const bandCount = [...taken].filter(
            (x) => Math.floor(x / 100) === Math.floor(base / 100)
        ).length;
        if (bandCount >= 80) base += 100;
    }
    throw new Error("Could not generate unique raffle ID");
}

async function getEmailByPhone(phone: string): Promise<string | null> {
    const cleaned = phone.replace(/\D/g, "").slice(-10);
    const supabase = getAdminClient();
    const { data } = await supabase
        .from("profiles")
        .select("email")
        .ilike("phone_number", `%${cleaned}`)
        .maybeSingle();
    return data?.email ?? null;
}

export async function loginAction(formData: FormData) {
    const identifier = (formData.get("identifier") as string)?.trim();
    const password = formData.get("password") as string;

    if (!identifier || !password)
        return { success: false, error: "Please fill in all fields." };

    try {
        const supabase = getAdminClient();
        const rcf = RcfIctClient.fromEnv();

        let email = identifier;
        if (!identifier.includes("@")) {
            const resolved = await getEmailByPhone(identifier);
            if (!resolved)
                return { success: false, error: "No account found with that phone number." };
            email = resolved;
        }

        // Step 1: Authenticate
        const { user, session } = await rcf.auth.login(email, password);
        if (!user || !session)
            return { success: false, error: "Invalid credentials." };

        // Step 2: Set session cookies
        const cookieStore = await cookies();
        const isProduction = process.env.NODE_ENV === "production";
        const cookieOptions = {
            path: "/",
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax" as const,
            maxAge: 60 * 60 * 24 * 7,
        };
        cookieStore.set("sb-access-token", session.access_token, cookieOptions);
        if (session.refresh_token)
            cookieStore.set("sb-refresh-token", session.refresh_token, cookieOptions);

        // Step 3: Full profile via ict-lib
        const fullProfile = await rcf.member.getFullProfile(user.id);

        // console.log("User profile",fullProfile);
        if (!fullProfile)
            return { success: false, error: "Profile not found. Contact admin." };
        if (!fullProfile.academics?.currentLevel || fullProfile.academics.currentLevel === 'N/A')
            return { success: false, error: "You have no level information, please update your profile" };

        // Step 4: Auto-register for the CFM event
        const eventSlug = process.env.CFM_EVENT_SLUG || "cfm";
        const { data: event } = await supabase
            .from("events")
            .select("id, title, date")
            .eq("slug", eventSlug)
            .maybeSingle();

        if (!event)
            return { success: false, error: "Event not found. Contact admin." };

        const { data: existing } = await supabase
            .from("event_registrations")
            .select("id, raffle_id")
            .eq("event_id", event.id)
            .eq("email", email)
            .maybeSingle();

        let raffleId: number | null = existing?.raffle_id ?? null;

        if (!existing) {
            raffleId = await generateRaffleId(event.id);
            await supabase.from("event_registrations").insert({
                event_id: event.id,
                first_name: fullProfile.profile.firstName,
                last_name: fullProfile.profile.lastName,
                email: email,
                phone_number: fullProfile.profile.phoneNumber ?? "",
                level: fullProfile.academics?.currentLevel ?? "",
                gender: fullProfile.profile.gender ?? "",
                raffle_id: raffleId,
                is_rcf_member: true,
            });
            broadcastOracleEvent("stats:update", {}).catch(() => {});
        }

        return {
            success: true,
            data: {
                profile: fullProfile,
                raffleId,
                eventTitle: event.title ?? "Combined Family Meeting",
                eventDate: event.date ?? "",
            },
        };
    } catch (error: any) {
        console.error("[loginAction]", error);
        return { success: false, error: error?.message || "Login failed. Please try again." };
    }
}
