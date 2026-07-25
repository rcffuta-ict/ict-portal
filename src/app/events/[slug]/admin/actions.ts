'use server'

import { ict } from "@/lib/ict";
import { QAService } from "@rcffuta/ict-lib";

const qaService = new QAService(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getEventAdminStats(slug: string) {
  // 1. Fetch Event
  const { data: event } = await ict.supabase
    .from('events')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!event) return null;

  // 2. Fetch Registrations
  const { data: regs, error } = await ict.supabase
    .from('event_registrations')
    .select('*')
    .eq('event_id', event.id);

  if (error) {
    console.error("Error fetching registrations:", error);
    return null;
  }

  const registrations = regs || [];

  // Compute breakdown
  const total = registrations.length;
  const genderBreakdown = {
    male: registrations.filter(r => r.gender?.toLowerCase() === 'male').length,
    female: registrations.filter(r => r.gender?.toLowerCase() === 'female').length,
    other: registrations.filter(r => r.gender?.toLowerCase() !== 'male' && r.gender?.toLowerCase() !== 'female').length
  };

  const levelBreakdown: Record<string, number> = {};
  registrations.forEach(r => {
    const lvl = r.level || 'Unknown';
    levelBreakdown[lvl] = (levelBreakdown[lvl] || 0) + 1;
  });

  const rcfMembers = registrations.filter(r => r.is_rcf_member).length;
  const guests = total - rcfMembers;

  return {
    event,
    totalRegistered: total,
    genderBreakdown,
    levelBreakdown,
    rcfMembers,
    guests,
    registrants: registrations.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  };
}

export async function getEventQuestions(eventId: string) {
  try {
    const response = await qaService.getEventQuestions(eventId, {
      status: ["visible", "answered", "flagged", "hidden"],
    });
    if (response.error) throw new Error(response.error);
    return { success: true, data: response.data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
