'use server'

import { RcfIctClient } from "@rcffuta/ict-lib";

// Hardcoded for the event
const EVENT_SLUG = "sisters-conf-26";

export async function getDashboardData() {
    const rcf = RcfIctClient.fromEnv();

    // 1. Get Event Info
    const event = await rcf.event.getEventBySlug(EVENT_SLUG);
    if (!event) throw new Error("Event not found");

    // 2. Get All Registrations
    const { data: attendees, error } = await rcf.supabase
        .from('event_registrations')
        .select('*')
        .eq('event_id', event.id)
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    // 3. Calculate Stats
    const total = attendees.length;
    const checkedIn = attendees.filter(a => a.checked_in_at).length;
    const guests = attendees.filter(a => a.level === 'Guest').length;
    const members = total - guests;

    // Group by Level
    const levels: Record<string, number> = {
        '100L': 0, '200L': 0, '300L': 0, '400L': 0, '500L': 0
    };
    
    attendees.forEach(a => {
        if (levels[a.level] !== undefined) levels[a.level]++;
    });

    return {
        event,
        stats: { total, checkedIn, guests, members, levels },
        attendees
    };
}

export async function checkInUserAction(ticketId: string) {
    const rcf = new RcfIctClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    try {
        const user = await rcf.event.checkInUser(ticketId);
        return { success: true, data: user };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}