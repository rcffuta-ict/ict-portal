/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { ict } from "@/lib/ict"; // Using your initialized client

const EVENT_SLUG = "singles-weekend-26";

// Generate a unique coupon code
function generateCouponCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'AGAPE26-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function getEventDetails() {
  const { data } = await ict.supabase
    .from('events')
    .select('*')
    .eq('slug', EVENT_SLUG)
    .single();
    
  return data;
}

export async function checkExistingRegistration(email: string, phone?: string) {
  const { data: event } = await ict.supabase
    .from('events')
    .select('id')
    .eq('slug', EVENT_SLUG)
    .single();

  if (!event) return { exists: false };

  // Try email first
  const { data: existingByEmail } = await ict.supabase
    .from('event_registrations')
    .select('first_name, last_name, email, phone_number, checked_in_at, coupon_code')
    .eq('event_id', event.id)
    .eq('email', email.toLowerCase().trim())
    .single();

  if (existingByEmail) {
    return { exists: true, registration: existingByEmail };
  }

  // Try phone if provided
  if (phone) {
    let normalizedPhone = phone.replace(/[^0-9+]/g, "");
    if (normalizedPhone.startsWith("0")) normalizedPhone = "+234" + normalizedPhone.slice(1);
    else if (normalizedPhone.startsWith("234")) normalizedPhone = "+" + normalizedPhone;

    const { data: existingByPhone } = await ict.supabase
      .from('event_registrations')
      .select('first_name, last_name, email, phone_number, checked_in_at, coupon_code')
      .eq('event_id', event.id)
      .eq('phone_number', normalizedPhone)
      .single();

    if (existingByPhone) {
      return { exists: true, registration: existingByPhone };
    }
  }
  
  return { exists: false };
}

interface RegistrationData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  gender: string;
  level: string;
  relationship_status?: string;
  referral_source?: string;
  questions_content?: string;
  is_rcf_member?: boolean;
}

export async function registerAgapeAction(input: FormData | RegistrationData) {
  // 1. Get Event ID
  const { data: event } = await ict.supabase
    .from('events')
    .select('id')
    .eq('slug', EVENT_SLUG)
    .single();

  if (!event) return { success: false, error: "Event registration is closed." };

  // 2. Extract & Sanitize Data - handle both FormData and plain objects
  let phoneRaw: string;
  let email: string;
  let data: {
    event_id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    gender: string;
    level: string;
    relationship_status: string;
    referral_source: string;
    questions_content: string;
    is_rcf_member: boolean;
    coupon_code: string;
    coupon_active: boolean;
  };

  if (input instanceof FormData) {
    phoneRaw = input.get("phone") as string;
    email = (input.get("email") as string).toLowerCase().trim();
    
    let phone = phoneRaw.replace(/[^0-9+]/g, "");
    if (phone.startsWith("0")) phone = "+234" + phone.slice(1);
    else if (phone.startsWith("234")) phone = "+" + phone;

    data = {
      event_id: event.id,
      first_name: input.get("firstname") as string,
      last_name: input.get("lastname") as string,
      email,
      phone_number: phone,
      gender: input.get("gender") as string,
      level: input.get("level") as string,
      relationship_status: input.get("relationship_status") as string || "",
      referral_source: input.get("referral_source") as string || "",
      questions_content: input.get("questions_content") as string || "",
      is_rcf_member: input.get("is_rcf_member") === "true",
      coupon_code: null as any,//generateCouponCode(),
      coupon_active: false,
    };
  } else {
    phoneRaw = input.phone_number;
    email = input.email.toLowerCase().trim();
    
    let phone = phoneRaw.replace(/[^0-9+]/g, "");
    if (phone.startsWith("0")) phone = "+234" + phone.slice(1);
    else if (phone.startsWith("234")) phone = "+" + phone;

    data = {
      event_id: event.id,
      first_name: input.first_name,
      last_name: input.last_name,
      email,
      phone_number: phone,
      gender: input.gender,
      level: input.level,
      relationship_status: input.relationship_status || "",
      referral_source: input.referral_source || "",
      questions_content: input.questions_content || "",
      is_rcf_member: input.is_rcf_member ?? true,
      coupon_code: null as any,//generateCouponCode(),
      coupon_active: false,
    };
  }

  // 3. Insert to DB
  try {
    // Check for duplicates manually first (cleaner error msg)
    const { data: existing } = await ict.supabase
        .from('event_registrations')
        .select('id, first_name, last_name, phone_number, checked_in_at, coupon_code')
        .eq('event_id', event.id)
        .or(`email.eq.${data.email},phone_number.eq.${data.phone_number}`)
        .single();

    if (existing) {
        return { 
          success: false, 
          alreadyRegistered: true,
          registration: {
            first_name: existing.first_name,
            last_name: existing.last_name,
            phone_number: existing.phone_number,
            checked_in_at: existing.checked_in_at,
            coupon_code: existing.coupon_code
          },
          error: "You are already registered for Agape '26!" 
        };
    }

    const { error } = await ict.supabase
      .from('event_registrations')
      .insert(data);

    if (error) throw error;

    return { 
      success: true,
      data: {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        coupon_code: data.coupon_code,
      }
    };

  } catch (error: any) {
    console.error("Agape Reg Error:", error);
    return { success: false, error: "Registration failed. Please try again." };
  }
}