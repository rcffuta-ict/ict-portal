'use server'

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { parseGender } from "@/lib/gender";
import { requiredTestEmailDomain, testEmailError } from "@/lib/env";
import { canManageEvents, eventAccessFor, NO_EVENT_ACCESS, type EventAccess } from "@/lib/event-access";
import { recogniseEventMember } from "@/lib/event-member";
import { getSessionProfileId } from "@/lib/auth/session";
import { getRegistrationConfig } from "@/lib/event-utils";

// Who may create and edit events: the System Admin (src/lib/event-access.ts). This used
// to take an `email` argument from the caller and ask whether that address belonged to
// an admin — so anyone could call it with an admin's address and get through. Identity
// comes from the session cookie, never from the request body.

/** A unit assigned to an event must exist; store its slug or nothing. */
async function checkedConfig(config: any): Promise<{ config: any } | { error: string }> {
    const unit = typeof config?.unit === "string" ? config.unit.trim() : "";
    if (!unit) {
        const rest = { ...(config ?? {}) };
        delete rest.unit;
        return { config: rest };
    }
    const { data } = await db.from("units").select("slug").eq("slug", unit).maybeSingle();
    if (!data) return { error: "That unit doesn't exist." };
    return { config: { ...config, unit } };
}

/** What the current viewer may do on the events screens — drives buttons only. */
export async function getEventsCapabilityAction(): Promise<{ canCreate: boolean }> {
    return { canCreate: await canManageEvents() };
}

/** What the current viewer may do with one event — drives the admin link and console. */
export async function getMyEventAccessAction(slug: string): Promise<EventAccess> {
    const { data: event } = await db.from("events").select("config").eq("slug", slug).maybeSingle();
    if (!event) return NO_EVENT_ACCESS;
    const { read, write, manage } = await eventAccessFor(event.config);
    return { read, write, manage };
}

/** Units to choose from when assigning one to an event. System Admin only. */
export async function listEventUnitsAction() {
    if (!(await canManageEvents())) return [];
    const { data } = await db.from("units").select("slug, name, type").order("name");
    return data ?? [];
}

export async function getEvents() {
    try {
        const { data: events, error } = await db
            .from('events')
            .select('*')
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching events:', error);
            return {
                success: false,
                error: 'Failed to fetch events',
                data: null
            };
        }

        return {
            success: true,
            data: events || [],
            error: null
        };
    } catch (error) {
        console.error('Unexpected error:', error);
        return {
            success: false,
            error: 'An unexpected error occurred',
            data: null
        };
    }
}

export async function getEventBySlug(slug: string) {
    try {
        const { data: event, error } = await db
            .from('events')
            .select('*')
            .eq('slug', slug)
            .single();

        if (error) {
            console.error('Error fetching event:', error);
            return {
                success: false,
                error: 'Event not found',
                data: null
            };
        }

        return {
            success: true,
            data: event,
            error: null,
            // Outside production only @rcffuta.test addresses may register (see src/lib/env.ts).
            testEmailDomain: requiredTestEmailDomain(),
        };
    } catch (error) {
        console.error('Unexpected error:', error);
        return {
            success: false,
            error: 'An unexpected error occurred',
            data: null
        };
    }
}

export async function createEvent(data: {
  title: string;
  slug: string;
  description?: string;
  date: string;
  is_active: boolean;
  is_recurring: boolean;
  is_exclusive: boolean;
  config?: any;
}) {
    try {
        if (!(await canManageEvents())) {
            return { success: false, error: "Only the System Admin can create or edit events." };
        }
        // Only when config is being set: an edit that leaves it out must not wipe it.
        if (data.config !== undefined) {
            const checked = await checkedConfig(data.config);
            if ("error" in checked) return { success: false, error: checked.error };
            data = { ...data, config: checked.config };
        }

        // Basic validation
        if (!data.title || !data.slug) {
            return { success: false, error: "Title and Slug are required" };
        }

        // `db` is the service-role client and bypasses RLS — authorization for this action
        // is the caller's responsibility, checked above.
        const { error } = await db
            .from('events')
            .insert({
                title: data.title,
                slug: data.slug,
                description: data.description,
                date: data.date,
                is_active: data.is_active,
                is_recurring: data.is_recurring,
                is_exclusive: data.is_exclusive,
                config: data.config || {}
            });

        if (error) {
            console.error('Error creating event:', error);
            return { success: false, error: error.message };
        }

        revalidatePath('/events');
        revalidatePath('/dashboard');

        return { success: true };
    } catch (error: any) {
        console.error('Error creating event:', error);
        return { success: false, error: error.message || "Failed to create event" };
    }
}

export async function updateEvent(id: string, data: {
  title?: string;
  slug?: string;
  description?: string;
  date?: string;
  is_active?: boolean;
  is_recurring?: boolean;
  is_exclusive?: boolean;
  config?: any;
}) {
    try {
        if (!(await canManageEvents())) {
            return { success: false, error: "Only the System Admin can create or edit events." };
        }
        // Only when config is being set: an edit that leaves it out must not wipe it.
        if (data.config !== undefined) {
            const checked = await checkedConfig(data.config);
            if ("error" in checked) return { success: false, error: checked.error };
            data = { ...data, config: checked.config };
        }

        if (!id) return { success: false, error: "Event ID is required" };

        const { error } = await db
            .from('events')
            .update({
                ...(data.title && { title: data.title }),
                ...(data.slug && { slug: data.slug }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.date && { date: data.date }),
                ...(data.is_active !== undefined && { is_active: data.is_active }),
                ...(data.is_recurring !== undefined && { is_recurring: data.is_recurring }),
                ...(data.is_exclusive !== undefined && { is_exclusive: data.is_exclusive }),
                ...(data.config !== undefined && { config: data.config }),
            })
            .eq('id', id);

        if (error) {
            console.error('Error updating event:', error);
            return { success: false, error: error.message };
        }

        revalidatePath('/events');
        revalidatePath('/dashboard');

        return { success: true };
    } catch (error: any) {
        console.error('Error updating event:', error);
        return { success: false, error: error.message || "Failed to update event" };
    }
}

/**
 * Register for an event. This endpoint is public, so everything that matters is
 * decided here rather than trusted from the form:
 *
 *   - the event must exist, be published and be taking registrations;
 *   - a MEMBERS-ONLY (exclusive) event takes only recognised members — a signed-in
 *     portal user, or a level token plus the email on a member's record (see
 *     src/lib/event-member.ts). Their registration is built from the roster, so the
 *     name, email and level on the ticket are the member's own, not what was typed;
 *   - `is_rcf_member` is decided here too, never taken from the browser.
 */
export async function registerForEvent(data: {
  event_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  gender?: string;
  level?: string;
  department?: string;
  matric_number?: string;
  /** Members-only events: the generation's level token (`RCF-XXXXX`). */
  level_token?: string;
}) {
    try {
        const { data: event, error: eventError } = await db
            .from('events')
            .select('id, is_active, is_exclusive, config')
            .eq('id', data.event_id)
            .maybeSingle();

        if (eventError || !event) return { success: false, error: "This event could not be found." };
        if (!event.is_active || !getRegistrationConfig(event.config).enabled) {
            return { success: false, error: "Registration for this event is closed." };
        }

        let row: Record<string, unknown>;

        if (event.is_exclusive) {
            const recognised = await recogniseEventMember(event.id, {
                levelToken: data.level_token,
                email: data.email,
            });
            if (!recognised.ok) return { success: false, error: recognised.error };

            const m = recognised.member;
            row = {
                first_name: m.firstName,
                last_name: m.lastName,
                email: m.email,
                // The record's phone if it has one; otherwise the one they gave us today.
                phone_number: m.phoneNumber || data.phone_number?.trim() || null,
                gender: parseGender(m.gender),
                level: m.level,
                department: m.department,
                matric_number: m.matricNumber,
                is_rcf_member: true,
            };
        } else {
            const testError = testEmailError(data.email ?? "");
            if (testError) return { success: false, error: testError };
            if (!data.first_name?.trim() || !data.last_name?.trim()) {
                return { success: false, error: "Enter your first and last name." };
            }

            row = {
                first_name: data.first_name.trim(),
                last_name: data.last_name.trim(),
                email: data.email?.trim() || null,
                phone_number: data.phone_number?.trim() || null,
                // event_registrations.gender has NO check constraint, so whatever arrives is
                // what gets stored and every reader downstream has to cope. Normalise here.
                gender: parseGender(data.gender),
                level: data.level,
                department: data.department,
                matric_number: data.matric_number,
                // A member only if a real session says so — not because the form claimed it.
                is_rcf_member: !!(await getSessionProfileId()),
            };
        }

        if (row.email) {
            const { data: existing } = await db
                .from('event_registrations')
                .select('id')
                .eq('event_id', event.id)
                .ilike('email', String(row.email).replace(/[%_\\]/g, "\\$&"))
                .maybeSingle();

            if (existing) {
                return { success: false, error: "You are already registered for this event", alreadyRegistered: true };
            }
        }

        const { data: registration, error } = await db
            .from('event_registrations')
            .insert({ event_id: event.id, ...row })
            .select('id, first_name, last_name')
            .single();

        if (error) {
            // unique_event_phone: someone already registered with this phone number.
            if (error.code === '23505') {
                return { success: false, error: "That phone number is already registered for this event.", alreadyRegistered: true };
            }
            console.error('Error registering for event:', error);
            return { success: false, error: "Registration failed. Please try again." };
        }

        return { success: true, data: registration };
    } catch (error: any) {
        console.error('Error in registerForEvent:', error);
        return { success: false, error: "Registration failed. Please try again." };
    }
}

export async function getEventRegistrationStats(eventId: string) {
    try {
        const { count, error: countError } = await db
            .from('event_registrations')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', eventId);

        const { data: recent, error: recentError } = await db
            .from('event_registrations')
            .select('first_name, last_name, gender')
            .eq('event_id', eventId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (countError || recentError) {
            console.error('Error fetching registration stats:', countError || recentError);
            return { success: false, error: 'Failed to fetch stats' };
        }

        return {
            success: true,
            data: {
                total: count || 0,
                recent: recent || []
            }
        };
    } catch (error) {
        console.error('Unexpected error in getEventRegistrationStats:', error);
        return { success: false, error: 'An error occurred' };
    }
}
