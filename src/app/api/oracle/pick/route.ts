import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, broadcastOracleEvent } from "@/src/lib/supabase/server";

async function verifyAdmin(request: NextRequest): Promise<boolean> {
    const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((e) => e.trim().toLowerCase());
    const token = request.cookies.get("sb-access-token")?.value;
    if (!token) return false;
    const supabase = getAdminClient();
    const { data: { user } } = await supabase.auth.getUser(token);
    return adminEmails.includes(user?.email?.toLowerCase() ?? "");
}

export async function POST(request: NextRequest) {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { level, gender } = await request.json();
    const supabase = getAdminClient();
    const eventSlug = process.env.CFM_EVENT_SLUG || "cfm";

    const { data: event } = await supabase
        .from("events")
        .select("id")
        .eq("slug", eventSlug)
        .maybeSingle();

    if (!event)
        return NextResponse.json({ error: "Event not found" }, { status: 404 });

    // Build filtered query on event_registrations
    let query = supabase
        .from("event_registrations")
        .select("id, raffle_id, first_name, last_name, level, gender, email")
        .eq("event_id", event.id)
        .not("raffle_id", "is", null);

    if (level) query = query.eq("level", level);
    if (gender) query = query.eq("gender", gender);

    const { data: registrations, error } = await query;

    if (error || !registrations?.length)
        return NextResponse.json(
            { error: "No eligible registrants found for that filter." },
            { status: 404 }
        );

    // Pick a random winner
    const winner = registrations[Math.floor(Math.random() * registrations.length)];

    // Look up unit from profile via email
    let unitName: string | null = null;
    const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", winner.email)
        .maybeSingle();

    if (profile?.id) {
        const { data: membership } = await supabase
            .from("membership_units")
            .select("units(name)")
            .eq("profile_id", profile.id)
            .limit(1)
            .maybeSingle();
        unitName = (membership?.units as any)?.name ?? null;
    }

    const picked = {
        raffleId: winner.raffle_id,
        firstName: winner.first_name,
        lastName: winner.last_name,
        level: winner.level,
        gender: winner.gender,
        unit: unitName,
    };

    // Broadcast "preparing" → oracle TV clears, then "selection" → spinner lands
    await broadcastOracleEvent("preparing", {});
    await new Promise((r) => setTimeout(r, 300));
    await broadcastOracleEvent("selection", { raffleId: winner.raffle_id });

    return NextResponse.json({ success: true, data: picked });
}
