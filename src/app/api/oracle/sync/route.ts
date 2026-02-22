import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/src/lib/supabase/server";
import { getOracleStore } from "@/src/lib/oracleStore";

// async function verifyAdmin(request: NextRequest): Promise<boolean> {
//     const adminEmails = (process.env.ADMIN_EMAILS || "")
//         .split(",")
//         .map((e) => e.trim().toLowerCase());
//     const token = request.cookies.get("sb-access-token")?.value;
//     if (!token) return false;
//     const supabase = getAdminClient();
//     const { data: { user } } = await supabase.auth.getUser(token);
//     return adminEmails.includes(user?.email?.toLowerCase() ?? "");
// }

export async function POST(request: NextRequest) {
    const isAdmin = true; // await verifyAdmin(request);
    if (!isAdmin)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getAdminClient();
    const eventSlug = process.env.CFM_EVENT_SLUG || "cfm";

    const { data: event } = await supabase
        .from("events")
        .select("id")
        .eq("slug", eventSlug)
        .maybeSingle();

    if (!event)
        return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const { data: registrations, error } = await supabase
        .from("event_registrations")
        .select("id, raffle_id, first_name, last_name, level, gender, email")
        .eq("event_id", event.id)
        .not("raffle_id", "is", null);

    if (error || !registrations) {
        return NextResponse.json({ error: "Failed to fetch registrations" }, { status: 500 });
    }

    const emails = registrations.map(r => r.email);
    
    const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("email", emails);

    let profileMap = new Map<string, string>();
    let unitMap = new Map<string, string>();

    if (profiles && profiles.length > 0) {
        profiles.forEach(p => profileMap.set(p.email, p.id));
        const profileIds = profiles.map(p => p.id);

        const { data: memberships } = await supabase
            .from("membership_units")
            .select("profile_id, units(name)")
            .in("profile_id", profileIds);

        if (memberships) {
            let pIdToUnit = new Map<string, string>();
            memberships.forEach(m => {
                const name = (m.units as any)?.name;
                if (name) pIdToUnit.set(m.profile_id, name);
            });

            profileMap.forEach((pid, email) => {
                if (pIdToUnit.has(pid)) {
                    unitMap.set(email, pIdToUnit.get(pid)!);
                }
            });
        }
    }

    const store = getOracleStore();
    store.registrations = registrations.map(r => ({
        id: r.id,
        raffle_id: r.raffle_id,
        first_name: r.first_name,
        last_name: r.last_name,
        level: r.level,
        gender: r.gender,
        email: r.email,
        unit: unitMap.get(r.email) || null,
    }));

    // Reset picked history on full sync
    store.pickedHistory = [];

    return NextResponse.json({ success: true, count: store.registrations.length });
}
