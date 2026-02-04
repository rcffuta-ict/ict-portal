'use server'

import { ict, ictAdmin } from "@/lib/ict";

const EVENT_SLUG = "singles-weekend-26";

/**
 * Find registration by phone number or email for self check-in
 */
export async function findRegistrationByIdentifier(identifier: string) {
  try {
    // Get event first
    const { data: event, error: eventError } = await ict.supabase
      .from('events')
      .select('id')
      .eq('slug', EVENT_SLUG)
      .single();

    if (eventError || !event) {
      return { 
        success: false, 
        error: "Event not found." 
      };
    }

    // Try to find by phone or email
    const isEmail = identifier.includes('@');
    
    let registration = null;
    let regError = null;

    if (isEmail) {
      // Search by email
      const result = await ict.supabase
        .from('event_registrations')
        .select('id, first_name, last_name, email, phone_number, gender, checked_in_at, coupon_code, coupon_active, coupon_used_at')
        .eq('event_id', event.id)
        .eq('email', identifier)
        .single();
      
      registration = result.data;
      regError = result.error;
    } else {
      // Search by phone - handle multiple formats
      // Normalize the input phone number
      const normalizedPhone = identifier.replace(/\s+/g, '').replace(/-/g, '');
      
      // Generate possible phone formats to search
      const phoneVariants: string[] = [];
      
      if (normalizedPhone.startsWith('+234')) {
        // Input: +2348012345678 -> also try 08012345678
        phoneVariants.push(normalizedPhone);
        phoneVariants.push('0' + normalizedPhone.slice(4));
      } else if (normalizedPhone.startsWith('234')) {
        // Input: 2348012345678 -> also try +234... and 0...
        phoneVariants.push(normalizedPhone);
        phoneVariants.push('+' + normalizedPhone);
        phoneVariants.push('0' + normalizedPhone.slice(3));
      } else if (normalizedPhone.startsWith('0')) {
        // Input: 08012345678 -> also try +234...
        phoneVariants.push(normalizedPhone);
        phoneVariants.push('+234' + normalizedPhone.slice(1));
        phoneVariants.push('234' + normalizedPhone.slice(1));
      } else {
        // Input: 8012345678 -> try with 0, +234, 234 prefixes
        phoneVariants.push(normalizedPhone);
        phoneVariants.push('0' + normalizedPhone);
        phoneVariants.push('+234' + normalizedPhone);
        phoneVariants.push('234' + normalizedPhone);
      }

      // Search for any of the phone variants
      const result = await ict.supabase
        .from('event_registrations')
        .select('id, first_name, last_name, email, phone_number, gender, checked_in_at, coupon_code, coupon_active, coupon_used_at')
        .eq('event_id', event.id)
        .in('phone_number', phoneVariants)
        .limit(1)
        .single();
      
      registration = result.data;
      regError = result.error;
    }

    if (regError || !registration) {
      return { 
        success: false, 
        error: isEmail 
          ? "No registration found with this email. Please check and try again."
          : "No registration found with this phone number. Please check and try again."
      };
    }

    const participantName = `${registration.first_name} ${registration.last_name}`;

    // Already checked in
    if (registration.checked_in_at) {
      return {
        success: true,
        alreadyCheckedIn: true,
        data: {
          registrationId: registration.id,
          participantName,
          firstName: registration.first_name,
          checkedInAt: registration.checked_in_at,
          wantsCoupon: !!registration.coupon_code,
          couponCode: registration.coupon_code || null,
          hasUsedCoupon: registration.coupon_code && !registration.coupon_active
        }
      };
    }

    // Return info for confirmation
    // Include coupon info so UI can skip the question if they already have a coupon
    return {
      success: true,
      verified: true,
      data: {
        registrationId: registration.id,
        participantName,
        firstName: registration.first_name,
        email: registration.email,
        gender: registration.gender,
        hasCoupon: !!registration.coupon_code,
        couponCode: registration.coupon_code || null
      }
    };

  } catch (error) {
    console.error('Find registration error:', error);
    return { 
      success: false, 
      error: "An unexpected error occurred. Please try again." 
    };
  }
}

/**
 * Verify registration before check-in (step 1)
 * Returns attendee info without marking as checked in
 */
export async function verifyRegistration(registrationId: string) {
  try {
    const { data: registration, error: regError } = await ict.supabase
      .from('event_registrations')
      .select('*, events(*)')
      .eq('id', registrationId)
      .single();

    if (regError || !registration) {
      return { 
        success: false, 
        error: "Registration not found. Please ensure your QR code is valid." 
      };
    }

    if (registration.events?.slug !== EVENT_SLUG) {
      return { 
        success: false, 
        error: "Invalid QR code for this event." 
      };
    }

    const participantName = `${registration.first_name} ${registration.last_name}`;

    // Already checked in
    if (registration.checked_in_at) {
      return {
        success: true,
        alreadyCheckedIn: true,
        data: {
          registrationId: registration.id,
          participantName,
          firstName: registration.first_name,
          checkedInAt: registration.checked_in_at,
          wantsCoupon: !!registration.coupon_code,
          couponCode: registration.coupon_code || null,
          hasUsedCoupon: registration.coupon_code && !registration.coupon_active
        }
      };
    }

    // Return verification info (not yet checked in)
    return {
      success: true,
      verified: true,
      data: {
        registrationId: registration.id,
        participantName,
        firstName: registration.first_name,
        email: registration.email,
        gender: registration.gender
      }
    };

  } catch (error) {
    console.error('Verification error:', error);
    return { 
      success: false, 
      error: "An unexpected error occurred. Please try again." 
    };
  }
}

/**
 * Complete check-in with shopping preference (step 2)
 */
export async function completeCheckIn(registrationId: string, wantsCoupon: boolean) {
  try {
    const { data: registration, error: regError } = await ict.supabase
      .from('event_registrations')
      .select('*, events(*)')
      .eq('id', registrationId)
      .single();

    if (regError || !registration) {
      return { 
        success: false, 
        error: "Registration not found." 
      };
    }

    if (registration.events?.slug !== EVENT_SLUG) {
      return { 
        success: false, 
        error: "Invalid registration for this event." 
      };
    }

    const participantName = `${registration.first_name} ${registration.last_name}`;

    // Already checked in - just return status
    if (registration.checked_in_at) {
      return {
        success: true,
        alreadyCheckedIn: true,
        data: {
          participantName,
          firstName: registration.first_name,
          checkedInAt: registration.checked_in_at,
          wantsCoupon: !!registration.coupon_code,
          couponCode: registration.coupon_code || null,
          hasUsedCoupon: registration.coupon_code && !registration.coupon_active
        }
      };
    }

    // Process check-in
    const checkInTime = new Date().toISOString();
    
    // Generate coupon code ONLY if they want shopping
    // coupon_active = true means the coupon is valid and not yet used
    let couponCode = registration.coupon_code || null;
    if (wantsCoupon && !couponCode) {
      // Generate new coupon code only if they want one and don't have one
      const randomPart = `${Math.random().toString(36).substring(2, 6).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      couponCode = `AGAPE26-${randomPart}`;
    }

    // Build update object - always set checked_in_at
    const updateData: Record<string, unknown> = {
      checked_in_at: checkInTime,
    };

    // Only update coupon fields if they want a coupon
    if (wantsCoupon) {
      updateData.coupon_code = couponCode;
      updateData.coupon_active = true;
    }

    const { error: updateError } = await ict.supabase
      .from('event_registrations')
      .update(updateData)
      .eq('id', registrationId);

    if (updateError) {
      return { 
        success: false, 
        error: "Failed to process check-in. Please try again." 
      };
    }

    return {
      success: true,
      data: {
        participantName,
        firstName: registration.first_name,
        checkedInAt: checkInTime,
        wantsCoupon,
        couponCode: couponCode,
        hasUsedCoupon: false
      }
    };

  } catch (error) {
    console.error('Check-in error:', error);
    return { 
      success: false, 
      error: "An unexpected error occurred. Please contact support." 
    };
  }
}

/**
 * Process check-in from QR code scan (legacy - auto check-in with coupon)
 * @param registrationId - The registration ID from QR code
 */
export async function processCheckIn(registrationId: string) {
  try {
    // 1. Fetch the registration
    const { data: registration, error: regError } = await ict.supabase
      .from('event_registrations')
      .select('*, events(*)')
      .eq('id', registrationId)
      .single();

    if (regError || !registration) {
      return { 
        success: false, 
        error: "Registration not found. Please ensure your QR code is valid." 
      };
    }

    // 2. Verify this is for the correct event
    if (registration.events?.slug !== EVENT_SLUG) {
      return { 
        success: false, 
        error: "Invalid QR code for this event." 
      };
    }

    const participantName = `${registration.first_name} ${registration.last_name}`;

    // 3. Check if already checked in
    if (registration.checked_in_at) {
      return {
        success: true,
        alreadyCheckedIn: true,
        data: {
          participantName,
          checkedInAt: registration.checked_in_at,
          couponCode: registration.coupon_active ? registration.coupon_code : null,
          hasUsedCoupon: !!registration.coupon_used_at
        }
      };
    }

    // 4. Process check-in
    const checkInTime = new Date().toISOString();
    
    // 5. Generate coupon code if not exists
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
      .eq('id', registrationId);

    if (updateError) {
      return { 
        success: false, 
        error: "Failed to process check-in. Please try again." 
      };
    }

    return {
      success: true,
      data: {
        participantName,
        checkedInAt: checkInTime,
        couponCode: couponCode,
        hasUsedCoupon: false
      }
    };

  } catch (error) {
    console.error('Check-in error:', error);
    return { 
      success: false, 
      error: "An unexpected error occurred. Please contact support." 
    };
  }
}

/**
 * Validate a coupon (for vendor use)
 * Accepts the coupon code shown to attendees
 */
export async function validateCoupon(couponCode: string) {
  try {
    // Get event
    const { data: event } = await ict.supabase
      .from('events')
      .select('id, config')
      .eq('slug', EVENT_SLUG)
      .single();

    if (!event) {
      return { success: false, error: "Event not found" };
    }

    // Normalize the input - trim spaces
    const normalizedInput = couponCode.trim();
    
    if (!normalizedInput || normalizedInput.length < 4) {
      return { success: false, error: "Invalid coupon code format" };
    }

    // Try to find with exact match first, then try with/without dash
    // DB format is: AGAPE26-XXXXXXXX
    let registration = null;
    let regError = null;

    // Build search variants
    const searchVariants: string[] = [normalizedInput];
    
    // If input has dash, also try without
    if (normalizedInput.includes('-')) {
      searchVariants.push(normalizedInput.replace(/-/g, ''));
    } else {
      // If input has no dash, try adding one after AGAPE26
      if (normalizedInput.toUpperCase().startsWith('AGAPE26')) {
        const withDash = 'AGAPE26-' + normalizedInput.substring(7);
        searchVariants.push(withDash);
      }
    }

    // Search for any variant (case-insensitive)
    for (const variant of searchVariants) {
      const result = await ict.supabase
        .from('event_registrations')
        .select('*')
        .eq('event_id', event.id)
        .ilike('coupon_code', variant)
        .maybeSingle();
      
      if (result.data) {
        registration = result.data;
        break;
      }
      if (result.error) {
        regError = result.error;
      }
    }

    // console.debug("Coupon lookup for", normalizedInput, "variants:", searchVariants, "result:", registration, regError);

if (regError) {
  console.error("Database error:", regError);
  return { success: false, error: "Database query failed" };
}

if (!registration) {
  return { success: false, error: "Invalid coupon code" };
}

    

    // if (regError || !registration) {
    //   return { success: false, error: "Invalid coupon code" };
    // }

    // Check if coupon is still active (not yet used)
    if (!registration.coupon_active) {
      return { 
        success: false, 
        error: "Coupon has already been used"
      };
    }

    return {
      success: true,
      data: {
        registrationId: registration.id,
        participantName: `${registration.first_name} ${registration.last_name}`,
        couponCode: registration.coupon_code
      }
    };

  } catch (error) {
    console.error('Coupon validation error:', error);
    return { success: false, error: "Failed to validate coupon" };
  }
}

/**
 * Redeem/invalidate a coupon (marks it as used by setting coupon_active = false)
 */
export async function redeemCoupon(registrationId: string) {
  try {
    // We update ONLY if coupon_used_at is still null.
    // This handles the "already redeemed" check at the database level.
    const { data: updatedRow, error } = await ictAdmin.supabase
      .from('event_registrations')
      .update({ 
        coupon_active: false,
        coupon_used_at: new Date().toISOString()
      })
      .eq('id', registrationId)
      .is('coupon_used_at', null) // Only update if not already redeemed
      .select('first_name, last_name, coupon_code')
      .maybeSingle();
    


    if (error) {
      console.error("Redeem update error:", error);
      return { success: false, error: "Database error occurred." };
    }

    // If updatedRow is null, it means the .eq() or .is() filters failed 
    // (i.e., ID is wrong OR it was already redeemed)
    if (!updatedRow) {
      return { 
        success: false, 
        error: "Coupon is invalid or has already been redeemed." 
      };
    }

    return { 
      success: true,
      data: {
        participantName: `${updatedRow.first_name} ${updatedRow.last_name}`,
        couponCode: updatedRow.coupon_code
      }
    };
  } catch (err) {
    console.error('Coupon redeem unexpected error:', err);
    return { success: false, error: "An unexpected error occurred." };
  }
}