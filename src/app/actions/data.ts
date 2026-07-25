/**
 * Server actions for fetching data with authentication
 * Follows the pattern from AUTHENTICATION.md
 */

'use server'

import { validateSession, getAuthenticatedClient } from '@/lib/auth-utils';
import { createAuthUser, type AuthUser } from '@/lib/auth-roles';

/**
 * Get initial dashboard data with authentication check
 * Returns null if user is not authenticated
 */
export async function getInitialDashboardData(): Promise<{
  user: AuthUser;
  // Add other initial data here as needed
} | null> {
  try {
    const { valid, user } = await validateSession();
    
    if (!valid || !user) {
      return null;
    }
    
    // Get the authenticated client
    const rcf = await getAuthenticatedClient();
    
    if (!rcf) {
      return null;
    }
    
    // Fetch full user profile
    const profile = await rcf.member.getFullProfile(user.id);
    
    if (!profile) {
      return null;
    }
    
    // Inject email if missing in profile
    profile.profile.email = user.email || "";
    
    // Create AuthUser with role
    const authUser = createAuthUser(profile, user.email || "");
    
    // TODO: Add other data fetching here
    // For example:
    // const courses = await rcf.supabase.from('courses').select('*');
    
    return {
      user: authUser,
      // courses: courses.data || [],
    };
    
  } catch (error) {
    console.error("Dashboard data fetch error:", error);
    return null;
  }
}