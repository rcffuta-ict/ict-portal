import { NextResponse } from "next/server";
import { getAdminClient } from "@/src/lib/supabase/server";

export const revalidate = 0;

export async function GET() {
    const supabase = getAdminClient();
    const eventSlug = process.env.CFM_EVENT_SLUG || "cfm";

    const { data: event } = await supabase
        .from("events")
        .select("id, title")
        .eq("slug", eventSlug)
        .maybeSingle();

    if (!event)
        return NextResponse.json({
            total: 0,
            levels: [],
            eventTitle: "",
            brothers: 0,
            sisters: 0,
        });

    // To determine dynamic level, we need the active tenure
    const { data: activeTenure } = await supabase
        .from("tenures")
        .select("session")
        .eq("is_active", true)
        .maybeSingle();

    const sessionYear = activeTenure ? parseInt(activeTenure.session.split("/")[0]) : new Date().getFullYear();

    // Fetch all registrations for this event to calculate their exact level using entry_year
    const { data: rawRegistrations } = await supabase
        .from("event_registrations")
        .select(`
            gender,
            level,
            email
        `)
        .eq("event_id", event.id);

    // Filter missing/null out
    const registrations = rawRegistrations || [];

    // Since event_registrations.email does not have an explicit foreign key to profiles.email, 
    // we fetch profiles independently to determine entry_year
    const emails = [...new Set(registrations.map(r => r.email).filter(Boolean))] as string[];
    let emailToEntryYear: Record<string, number> = {};

    if (emails.length > 0) {
        const { data: profiles } = await supabase
            .from("profiles")
            .select("email, entry_year")
            .in("email", emails);
        
        if (profiles) {
            profiles.forEach(p => {
                if (p.email && p.entry_year) emailToEntryYear[p.email] = p.entry_year;
            });
        }
    }

    let total = registrations.length;
    let brothers = 0;
    let sisters = 0;
    
    // Bucket exactly these levels (like the UI expects)
    const activeLevels = ["100", "200", "300", "400", "500"];
    const levelCountsMap: Record<string, number> = {
        "100": 0, "200": 0, "300": 0, "400": 0, "500": 0, "Alumni": 0
    };

    for (const reg of registrations) {
        // Gender counting
        const g = reg.gender?.toLowerCase() || "";
        if (g === "male") brothers++;
        if (g === "female") sisters++;

        // Determine dynamic level
        let finalLevel = "N/A";
        
        // 1. Resolve exact level from profile if possible
        const entryYear = reg.email ? emailToEntryYear[reg.email] : undefined;
        if (entryYear) {
            const levelCalc = (sessionYear - entryYear + 1) * 100;
            if (levelCalc >= 600) finalLevel = "Alumni";
            else finalLevel = `${levelCalc}`;
        } else if (reg.level) {
            // 2. Fallback to manually passed-in string inside registration if unbounded
            const cleanLevel = reg.level.replace(/\D/g, "");
            if (cleanLevel) finalLevel = cleanLevel;
        }

        // Increment count if it belongs to valid level bucket
        if (activeLevels.includes(finalLevel)) {
            levelCountsMap[finalLevel]++;
        } else if (finalLevel === "Alumni") {
            levelCountsMap["Alumni"]++;
        }
    }

    const levelCounts = activeLevels.map(level => ({
        level,
        count: levelCountsMap[level]
    }));
    
    // We can also optionally export Alumni if needed, but keeping it map matched.

    return NextResponse.json({
        eventTitle: event.title,
        total,
        levels: levelCounts,
        brothers,
        sisters,
    });
}
