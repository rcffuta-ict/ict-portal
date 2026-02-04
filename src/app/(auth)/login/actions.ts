/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { RcfIctClient } from "@rcffuta/ict-lib/server";
import { cookies } from "next/headers";

export async function loginAction(formData: FormData) {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const rcf = RcfIctClient.fromEnv();

    try {
        // 1. Attempt Login via Library
        const { user, session } = await rcf.auth.login(email, password);
        
        if (!user || !session) {
            return { success: false, error: "Invalid credentials" };
        }

        // 2. CRITICAL: Manually set the cookie for Next.js Persistence
        // Since the library uses vanilla supabase-js, we must bridge the session to Next.js cookies
        const cookieStore = await cookies();
        const isProduction = process.env.NODE_ENV === "production";

        const cookieOptions = {
            path: "/",
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax" as const,
            maxAge: 60 * 60 * 24 * 7, // 1 week
        };

        cookieStore.set("sb-access-token", session.access_token, cookieOptions);
        
        if (session.refresh_token) {
            cookieStore.set("sb-refresh-token", session.refresh_token, cookieOptions);
        }

        // 3. Fetch the Full Profile (Roles, Family, Units)
        // We use the member service we created earlier
        const fullProfile = await rcf.member.getFullProfile(user.id);

        if (fullProfile) {
            // Inject email if missing in profile table
            fullProfile.profile.email = user.email || "";
        }
        

        return { success: true, data: fullProfile };

    } catch (error: any) {
        console.error("Login Error:", error);
        return { success: false, error: error.message || "Login failed" };
    }
}