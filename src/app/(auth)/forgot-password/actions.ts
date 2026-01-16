/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { RcfIctClient } from "@rcffuta/ict-lib";

// 1. Request OTP
export async function requestResetAction(email: string) {
    // Use Admin client to ensure we can write to verification table
    const rcf = RcfIctClient.asAdmin();
    
    try {
        await rcf.auth.initiatePasswordReset(email);
        return { success: true };
    } catch (e: any) {
        // Don't reveal if email exists or not for security, just generic error or success
        // But for this internal tool, we can show error
        return { success: false, error: e.message };
    }
}

// 2. Reset Password
export async function resetPasswordAction(email: string, otp: string, password: string) {
    const rcf = RcfIctClient.asAdmin();
    
    try {
        await rcf.auth.completePasswordReset(email, otp, password);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}