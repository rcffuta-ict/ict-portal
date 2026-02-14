'use server'

import { ict, ictAdmin, getCurrentUser } from "@/lib/ict";
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
        is_exclusive: data.is_exclusive
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
}) {
  try {
    // Check authentication and authorization
    const user = await getCurrentUser();
    if (!user || !user.profile?.email || !isUserAdmin(user.profile.email)) {
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
