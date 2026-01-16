/**
 * Auth Utilities for Session Management
 * Handles Supabase token refresh and validation
 */

import { RcfIctClient } from "@rcffuta/ict-lib/server";

/**
 * Check if the current session is valid and refresh if needed
 * Call this from server components/actions before making authenticated requests
 */
export async function getAuthenticatedClient(): Promise<RcfIctClient | null> {
    try {
        const rcf = RcfIctClient.fromEnv();
        
        // Get current session from Supabase
        const { data: { session }, error } = await rcf.supabase.auth.getSession();
        
        if (error || !session) {
            console.log("No valid session found");
            return null;
        }
        
        // Check if token is expired or will expire soon (within 5 minutes)
        const expiresAt = session.expires_at || 0;
        const now = Math.floor(Date.now() / 1000);
        const isExpiringSoon = expiresAt - now < 300; // 5 minutes buffer
        
        if (isExpiringSoon) {
            console.log("Token expiring soon, refreshing...");
            
            // Refresh the session
            const { data: { session: newSession }, error: refreshError } = 
                await rcf.supabase.auth.refreshSession();
            
            if (refreshError || !newSession) {
                console.error("Token refresh failed:", refreshError);
                return null;
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
