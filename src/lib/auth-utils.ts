/**
 * Auth Utilities for Session Management
 * Handles Supabase token refresh and validation
 * Follows the pattern from AUTHENTICATION.md
 */

import { RcfIctClient } from "@rcffuta/ict-lib/server";
import { cookies } from "next/headers";

/**
 * Check if the current session is valid and refresh if needed
 * Call this from server components/actions before making authenticated requests
 */
export async function getAuthenticatedClient(): Promise<RcfIctClient | null> {
    try {
        const cookieStore = await cookies();
        const accessToken = cookieStore.get('sb-access-token')?.value;
        const refreshToken = cookieStore.get('sb-refresh-token')?.value;

        if (!accessToken) {
            console.log("No access token found in cookies");
            return null;
        }

        const rcf = RcfIctClient.fromEnv();

        // Set the session manually from cookies
        const { error: sessionError } = await rcf.supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || "",
        });

        if (sessionError) {
             // Handle "Refresh Token Already Used" or other auth errors somewhat gracefully
             // This means the user is logged out effectively.
             if (sessionError.message?.includes("Refresh Token") || sessionError.code === "refresh_token_already_used") {
                 console.log("Session invalid: Refresh token already used or expired.");
             } else {
                 console.error("Failed to set session:", sessionError.message);
             }
            return null;
        }

        // Get current session to check expiry
        const { data: { session }, error } = await rcf.supabase.auth.getSession();

        if (error || !session) {
            console.log("No valid session found");
            return null;
        }

        // Check if token is expired or will expire soon (within 5 minutes)
        const expiresAt = session.expires_at || 0;
        const now = Math.floor(Date.now() / 1000);
        const isExpiringSoon = expiresAt - now < 300; // 5 minutes buffer

        if (isExpiringSoon && refreshToken) {
            console.log("Token expiring soon, refreshing...");

            // Refresh the session
            const { data: { session: newSession }, error: refreshError } =
                await rcf.supabase.auth.refreshSession();

            if (refreshError || !newSession) {
                console.error("Token refresh failed:", refreshError);
                return null;
            }

            // Update cookies with new tokens
            const isProduction = process.env.NODE_ENV === "production";
            const cookieOptions = {
                path: "/",
                httpOnly: true,
                secure: isProduction,
                sameSite: "lax" as const,
                maxAge: 60 * 60 * 24 * 7, // 1 week
            };

            cookieStore.set("sb-access-token", newSession.access_token, cookieOptions);

            if (newSession.refresh_token) {
                cookieStore.set("sb-refresh-token", newSession.refresh_token, cookieOptions);
            }

            console.log("Session refreshed successfully");
        }

        return rcf;
    } catch (error) {
        console.error("Auth check failed:", error);
        return null;
    }
}

/**
 * Validate session server-side and return user data
 * Use this to protect routes and fetch fresh user data
 */
export async function validateSession() {
    const rcf = await getAuthenticatedClient();

    if (!rcf) {
        return { valid: false, user: null };
    }

    try {
        const { data: { user }, error } = await rcf.supabase.auth.getUser();

        if (error || !user) {
            return { valid: false, user: null };
        }

        return { valid: true, user };
    } catch (error) {
        console.error("User validation failed:", error);
        return { valid: false, user: null };
    }
}
