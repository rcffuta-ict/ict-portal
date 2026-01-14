/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { cookies } from "next/headers";
import { validateSession, getAuthenticatedClient } from "@/lib/auth-utils";

/**
 * Verify the current session and return user data
 * This will auto-refresh tokens if needed
 */
export async function verifySession() {
    try {
        const { valid, user } = await validateSession();
        
        if (!valid || !user) {
            return { success: false, error: "Session expired or invalid" };
        }
        
        // Get the authenticated client (with refreshed tokens if needed)
        const rcf = await getAuthenticatedClient();
        
        if (!rcf) {
            return { success: false, error: "Failed to authenticate" };
        }
        
        // Fetch fresh user profile
        const fullProfile = await rcf.member.getFullProfile(user.id);
        
        if (!fullProfile) {
            return { success: false, error: "Failed to fetch user profile" };
        }
        
        // Inject email if missing
        fullProfile.profile.email = user.email || "";
        
        // Update session cookies with potentially refreshed tokens
        const { data: { session } } = await rcf.supabase.auth.getSession();
        
        if (session) {
            const cookieStore = await cookies();
            
            cookieStore.set("sb-access-token", session.access_token, {
                path: "/",
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                maxAge: 60 * 60 * 24 * 7, // 1 week
            });
            
            if (session.refresh_token) {
                cookieStore.set("sb-refresh-token", session.refresh_token, {
                    path: "/",
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    maxAge: 60 * 60 * 24 * 7,
                });
            }
        }
        
        return { success: true, data: fullProfile };
    } catch (error: any) {
        console.error("Session verification failed:", error);
        return { success: false, error: error.message || "Session verification failed" };
    }
}

/**
 * Refresh session tokens manually
 * Useful for long-running sessions
 */
export async function refreshSessionAction() {
    try {
        const rcf = await getAuthenticatedClient();
        
        if (!rcf) {
            return { success: false, error: "No active session" };
        }
        
        const { data: { session }, error } = await rcf.supabase.auth.refreshSession();
        
        if (error || !session) {
            return { success: false, error: "Failed to refresh session" };
        }
        
        // Update cookies
        const cookieStore = await cookies();
        
        cookieStore.set("sb-access-token", session.access_token, {
            path: "/",
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 7,
        });
        
        if (session.refresh_token) {
            cookieStore.set("sb-refresh-token", session.refresh_token, {
                path: "/",
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                maxAge: 60 * 60 * 24 * 7,
            });
        }
        
        return { success: true };
    } catch (error: any) {
        console.error("Token refresh failed:", error);
        return { success: false, error: error.message || "Token refresh failed" };
    }
}
