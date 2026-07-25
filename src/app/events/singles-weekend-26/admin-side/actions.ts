'use server'

import { ict } from "@/lib/ict";
import { revalidatePath } from "next/cache";

const EVENT_SLUG = "singles-weekend-26";

export async function getAgapeStats() {
  // 1. Fetch Event & Config
  const { data: event } = await ict.supabase
    .from('events')
    .select('*')
    .eq('slug', EVENT_SLUG)
    .single();

  if (!event) throw new Error("Event not found");

  // 2. Fetch All Registrations
  const { data: regs, error } = await ict.supabase
    .from('event_registrations')
    .select('*')
    .eq('event_id', event.id);

  if (error) throw error;

  const registrations = regs || [];

  // 3. Compute Demographics
  const total = registrations.length;
  const checkedIn = registrations.filter(r => r.checked_in_at).length;
  
  const gender = {
    brothers: registrations.filter(r => r.gender.toLowerCase() === 'male').length,
    sisters: registrations.filter(r => r.gender.toLowerCase() === 'female').length
  };

  // Relationship status breakdown
  const relationshipStatus: Record<string, number> = {};
  registrations.forEach(r => {
    const status = r.relationship_status || 'not_specified';
    relationshipStatus[status] = (relationshipStatus[status] || 0) + 1;
  });

  // RCF Membership breakdown
  const rcfMembers = registrations.filter(r => r.is_rcf_member).length;
  const guests = registrations.filter(r => !r.is_rcf_member).length;

  // Level breakdown
  const levels: Record<string, number> = {};
  registrations.forEach(r => {
    const lvl = r.level || 'Unknown';
    levels[lvl] = (levels[lvl] || 0) + 1;
  });

  // 4. Coupon Stats
  const coupons = {
    generated: registrations.filter(r => r.coupon_active).length,
    redeemed: registrations.filter(r => r.coupon_used_at).length
  };

  return {
    totalRegistered: total,
    checkedIn,
    brothers: gender.brothers,
    sisters: gender.sisters,
    levelBreakdown: levels,
    relationshipStatus,
    rcfMembers,
    guests,
    coupons,
    registrants: registrations.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  };
}

export async function updateEventConfig(formData: FormData) {
  const maxItems = formData.get('max_shopping_items');
  
  const { data: event } = await ict.supabase
    .from('events')
    .select('config')
    .eq('slug', EVENT_SLUG)
    .single();

  const newConfig = {
    ...event?.config,
    max_shopping_items: Number(maxItems)
  };

  await ict.supabase
    .from('events')
    .update({ config: newConfig })
    .eq('slug', EVENT_SLUG);

  revalidatePath('/events/singles-weekend-26/admin');
  return { success: true };
}

export async function checkInByPhone(phone: string) {
  // Normalize phone
  let normalizedPhone = phone.replace(/[^0-9+]/g, "");
  if (normalizedPhone.startsWith("0")) {
    normalizedPhone = "+234" + normalizedPhone.slice(1);
  } else if (normalizedPhone.startsWith("234") && !normalizedPhone.startsWith("+")) {
    normalizedPhone = "+" + normalizedPhone;
  }

  // Get event
  const { data: event } = await ict.supabase
    .from('events')
    .select('id')
    .eq('slug', EVENT_SLUG)
    .single();

  if (!event) {
    return { success: false, error: "Event not found" };
  }

  // Find registration by phone
  const { data: registration } = await ict.supabase
    .from('event_registrations')
    .select('*')
    .eq('event_id', event.id)
    .eq('phone_number', normalizedPhone)
    .single();

  if (!registration) {
    return { success: false, error: "No registration found for this phone number" };
  }

  // Check if already checked in
  if (registration.checked_in_at) {
    return {
      success: true,
      alreadyCheckedIn: true,
      data: {
        first_name: registration.first_name,
        last_name: registration.last_name,
        checkedInAt: registration.checked_in_at,
        couponCode: registration.coupon_active ? registration.coupon_code : null,
      }
    };
  }

  // Process check-in
  const checkInTime = new Date().toISOString();
  let couponCode = registration.coupon_code;
  
  if (!couponCode) {
    couponCode = `AG26-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  }

  const { error: updateError } = await ict.supabase
    .from('event_registrations')
    .update({ 
      checked_in_at: checkInTime,
      coupon_active: true,
      coupon_code: couponCode
    })
    .eq('id', registration.id);

  if (updateError) {
    return { success: false, error: "Failed to check in" };
  }

  return {
    success: true,
    data: {
      first_name: registration.first_name,
      last_name: registration.last_name,
      checkedInAt: checkInTime,
      couponCode: couponCode,
    }
  };
}

export async function redeemCouponAction(couponCode: string) {
  // Get event
  const { data: event } = await ict.supabase
    .from('events')
    .select('id')
    .eq('slug', EVENT_SLUG)
    .single();

  if (!event) {
    return { success: false, error: "Event not found" };
  }

  // Find registration by coupon code
  const { data: registration } = await ict.supabase
    .from('event_registrations')
    .select('*')
    .eq('event_id', event.id)
    .eq('coupon_code', couponCode)
    .single();

  if (!registration) {
    return { success: false, error: "Invalid coupon code" };
  }

  // Check if coupon is still active
  if (!registration.coupon_active) {
    return { 
      success: false, 
      error: "This coupon has already been used",
      data: {
        first_name: registration.first_name,
        last_name: registration.last_name,
        used_at: registration.coupon_used_at,
      }
    };
  }

  // Check if user has checked in
  if (!registration.checked_in_at) {
    return { 
      success: false, 
      error: "Attendee must check in first before using coupon" 
    };
  }

  // Redeem coupon
  const { error: updateError } = await ict.supabase
    .from('event_registrations')
    .update({ 
      coupon_active: false,
      coupon_used_at: new Date().toISOString()
    })
    .eq('id', registration.id);

  if (updateError) {
    return { success: false, error: "Failed to redeem coupon" };
  }

  return {
    success: true,
    data: {
      first_name: registration.first_name,
      last_name: registration.last_name,
    }
  };
}