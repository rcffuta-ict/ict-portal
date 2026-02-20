'use server'

import { ict, ictAdmin } from "@/lib/ict";
import { revalidatePath } from "next/cache";

function isUserAdmin(email: string | null | undefined): boolean {
    if (!email) return false;
    const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS || "";
    // Handle comma-separated list
    const allowedEmails = adminEmails.split(",").map(e => e.trim().toLowerCase());
    return allowedEmails.includes(email.toLowerCase());
}

export async function getEvents() {
  try {
    const { data: events, error } = await ict.supabase
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
    const { data: event, error } = await ict.supabase
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
    const { data: registrations, error } = await ict.supabase
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
}, email: string) {
  try {
    // Check authentication and authorization
    // const user = await getCurrentUser();
    // console.log("User:", user);
    if (!email || !isUserAdmin(email)) {
        return { success: false, error: "Unauthorized: Admin access required" };
    }

    // Basic validation
    if (!data.title || !data.slug) {
      return { success: false, error: "Title and Slug are required" };
    }

    // Insert event using admin client to ensure permissions if RLS is strict
    // although ict.supabase might work if RLS allows authenticated insert for admins,
    // using ictAdmin is safer if configured.
    // Based on `src/lib/ict.ts`, `ictAdmin` is `RcfIctClient.asAdmin()`.
    // However, `RcfIctClient` stores `supabase` as a property.
    // Let's use `ict.supabase` first, assuming the user is logged in as admin.
    // Wait, server actions run on server. `ictAdmin` uses service role key?
    // In `src/lib/ict.ts`: `export const ictAdmin = RcfIctClient.asAdmin();`
    // Let's check `ict.ts` again.

    const { error } = await ictAdmin.supabase
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
}, email: string) {
  try {
    // Check authentication and authorization
    // const user = await getCurrentUser();
    if (!email || !isUserAdmin(email)) {
        return { success: false, error: "Unauthorized: Admin access required" };
    }

    if (!id) return { success: false, error: "Event ID is required" };

    const { error } = await ictAdmin.supabase
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
    const { data: existing } = await ict.supabase
      .from('event_registrations')
      .select('id')
      .eq('event_id', data.event_id)
      .eq('email', data.email)
      .maybeSingle();

    if (existing) {
      return { success: false, error: "You are already registered for this event", alreadyRegistered: true };
    }

    const { data: registration, error } = await ict.supabase
      .from('event_registrations')
      .insert({
        event_id: data.event_id,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone_number: data.phone_number,
        gender: data.gender,
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
    const { count, error: countError } = await ict.supabase
      .from('event_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);

    const { data: recent, error: recentError } = await ict.supabase
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
