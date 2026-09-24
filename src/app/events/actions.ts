'use server'

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAdminWrite } from "@/lib/access-control";
import { parseGender } from "@/lib/gender";

/**
 * May the SESSION create or change events? The admin tier, minus the President.
 *
 * This used to take an `email` argument from the caller and ask whether that address
 * belonged to an admin — so anyone could call the action with an admin's address (the
 * staging one is in the repo) and get through. Identity comes from the session cookie,
 * never from the request body.
 */
async function canManageEvents(): Promise<boolean> {
    try {
        await requireAdminWrite();
        return true;
    } catch {
        return false;
    }
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

export async function getEventRegistrations(eventId: string) {
  try {
    const { data: registrations, error } = await db
      .from('event_registrations')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching registrations:', error);
      return {
        success: false,
        error: 'Failed to fetch registrations',
        data: null
      };
    }

    return {
      success: true,
      data: registrations || [],
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
        return { success: false, error: "Unauthorized: Admin access required" };
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
        return { success: false, error: "Unauthorized: Admin access required" };
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

export async function registerForEvent(data: {
  event_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  gender?: string;
  level?: string;
  department?: string;
  matric_number?: string;
  is_rcf_member?: boolean;
}) {
  try {
    // Basic check for existing registration
    const { data: existing } = await db
      .from('event_registrations')
      .select('id')
      .eq('event_id', data.event_id)
      .eq('email', data.email)
      .maybeSingle();

    if (existing) {
      return { success: false, error: "You are already registered for this event", alreadyRegistered: true };
    }

    const { data: registration, error } = await db
      .from('event_registrations')
      .insert({
        event_id: data.event_id,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone_number: data.phone_number,
        // event_registrations.gender has NO check constraint, so whatever arrives is
        // what gets stored and every reader downstream has to cope. Normalise here.
        gender: parseGender(data.gender),
        level: data.level,
        department: data.department,
        matric_number: data.matric_number,
        is_rcf_member: data.is_rcf_member || false
      })
      .select()
      .single();

    if (error) {
      console.error('Error registering for event:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: registration };
  } catch (error: any) {
    console.error('Error in registerForEvent:', error);
    return { success: false, error: error.message || "Failed to register" };
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
