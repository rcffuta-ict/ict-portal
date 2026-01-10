'use server'

import { RcfIctClient } from '@rcffuta/ict-lib';
import type { BioData, AcademicData, LocationData } from '@rcffuta/ict-lib';
import { cookies } from 'next/headers';

// Initialize the library with Environment Variables
const rcf = RcfIctClient.fromEnv();


// STEP 1A: INITIATE (Send OTP)
export async function sendVerificationOtp(email: string, firstName: string) {
  const rcf = RcfIctClient.asAdmin(); // Use Admin client to write to verification table safely
  try {
    await rcf.auth.initiateRegistration(email, firstName);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// STEP 1B: VERIFY & CREATE (Complete Step 1)
export async function verifyAndCreateUser(otp: string, data: BioData) {
  const rcf = RcfIctClient.asAdmin(); // Use Admin for verification logic
  try {
    // 1. Verify OTP
    await rcf.auth.verifyRegistrationOtp(data.email, otp);

    // 2. Create User (Standard Flow)
    const result = await rcf.auth.registerUser(data);
    
    if (result.success && result.user) {
        return { success: true, userId: result.user.id };
    }
    return { success: false, error: "Creation failed" };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Step 1: Create Account
export async function registerStepOne(data: BioData) {
  try {
    const result = await rcf.auth.registerUser(data);
    if (result.success && result.user) {
        // We don't need to manually set cookies because Supabase Auth 
        // usually handles session via the client, but since we are doing 
        // server-side registration, we might need to handle the session or 
        // let the client login automatically after. 
        // For simplicity in this flow: We return the User ID to the client 
        // so it can pass it to Step 2.
        return { success: true, userId: result.user.id };
    }
    return { success: false, error: "Registration failed unknown error" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Step 2: Academics
export async function registerStepTwo(userId: string, data: AcademicData) {
  try {
    // Note: In production, we should verify the session here too 
    // to ensure user isn't modifying someone else's data.
    await rcf.auth.updateAcademicInfo(userId, data);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Step 3: Location
export async function registerStepThree(userId: string, data: LocationData) {
  try {
    await rcf.auth.updateLocationInfo(userId, data);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getFamiliesAction() {
    const rcf = RcfIctClient.fromEnv();
    try {
        const families = await rcf.auth.getClassSets();
        return { success: true, data: families };
    } catch (e) {
        return { success: false, data: [] };
    }
}