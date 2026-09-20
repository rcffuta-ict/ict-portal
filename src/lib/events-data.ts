/**
 * Event lookup, registration and check-in.
 *
 * Reproduced from the @rcffuta/ict-lib client's `event.*` methods when that dependency
 * was removed. Behaviour is unchanged except where noted.
 *
 * Server-only: uses the service-role client and performs no authorization.
 */
import { db } from "@/lib/db";

export interface EventRow {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    date: string | null;
    is_active: boolean;
    is_recurring: boolean;
    is_exclusive: boolean;
    config: Record<string, unknown> | null;
}

/** One event by its slug, or null when there is no such event. */
export async function getEventBySlug(slug: string): Promise<EventRow | null> {
    const { data, error } = await db.from("events").select("*").eq("slug", slug).maybeSingle();
    if (error) return null;
    return (data as EventRow) ?? null;
}

/** Register a guest for an event. */
export async function registerForEvent(data: {
    eventId: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phoneNumber: string;
    level?: string | null;
}) {
    const { data: result, error } = await db
        .from("event_registrations")
        .insert({
            event_id: data.eventId,
            first_name: data.firstName,
            last_name: data.lastName,
            email: data.email ?? null,
            phone_number: data.phoneNumber,
            level: data.level ?? null,
        })
        .select()
        .single();
    if (error) throw new Error(error.message);
    return result;
}

/**
 * Check a ticket in. Throws on an unknown ticket or a second scan.
 *
 * Refusing a repeat check-in is the point: it is what makes a ticket single-use, and
 * the door steward needs the difference between "welcome in" and "this has been used"
 * to be loud.
 */
export async function checkInUser(ticketId: string): Promise<{
    fullName: string;
    level: string | null;
    event: string | null;
}> {
    const { data: reg, error } = await db
        .from("event_registrations")
        .select("*, events(title)")
        .eq("id", ticketId)
        .maybeSingle();
    if (error || !reg) throw new Error("Invalid ticket.");
    if (reg.checked_in_at) throw new Error("Already checked in.");

    const { error: updateError } = await db
        .from("event_registrations")
        // ISO string, not a Date: PostgREST serialises a Date to a non-ISO format that
        // Postgres parses inconsistently across locales.
        .update({ checked_in_at: new Date().toISOString() })
        .eq("id", ticketId);
    if (updateError) throw new Error(updateError.message);

    const event = Array.isArray(reg.events) ? reg.events[0] : reg.events;
    return {
        fullName: `${reg.first_name} ${reg.last_name}`,
        level: reg.level ?? null,
        event: event?.title ?? null,
    };
}
