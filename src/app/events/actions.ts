'use server'

import { ict } from "@/lib/ict";

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