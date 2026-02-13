/**
 * Enhanced Access Control Utilities
 * Integrates with existing checkAdminAccess pattern from utils/action.ts
 */

'use server'


import { validateSession } from "@/lib/auth-utils";
import { type AuthUser, createAuthUser } from "@/lib/auth-roles";
import { ictAdmin } from "./ict";

/**
 * Enhanced admin check that follows the same pattern as utils/action.ts
 * But returns user data instead of throwing
 */
export async function checkEnhancedAdminAccess(): Promise<{
  isAdmin: boolean;
  user: AuthUser | null;
  error?: string;
}> {
  try {
    // 1. Get validated session (handles refresh if needed)
    const { valid, user } = await validateSession();

    if (!valid || !user || !user.email) {
      return { isAdmin: false, user: null, error: "Invalid session" };
    }

    // const rcf = RcfIctClient.fromEnv();

    // 2. Check email whitelist (from environment variable)
    const allowedEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());

    const isEmailAdmin = allowedEmails.includes(user.email.toLowerCase());

    // 4. Get full profile for role-based check
    let authUser: AuthUser | null = null;
    try {
      const fullProfile = await ictAdmin.member.getFullProfile(user.id);
      if (fullProfile) {
        fullProfile.profile.email = user.email;
        authUser = createAuthUser(fullProfile, user.email);
      }
    } catch (profileError) {
      console.error("Failed to fetch profile:", profileError);
    }

    // 5. Admin access if either email whitelisted OR role-based admin
    const isRoleAdmin = authUser?.role === 'ADMIN';
    const hasAdminAccess = isEmailAdmin || isRoleAdmin;

    return {
      isAdmin: hasAdminAccess,
      user: authUser,
      error: hasAdminAccess ? undefined : "Access denied: Not authorized for admin access"
    };

  } catch (error: unknown) {
    console.error("Admin access check failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { isAdmin: false, user: null, error: errorMessage };
  }
}

/**
 * Check if user has moderator access (can manage events, view reports, etc.)
 */
export async function checkModeratorAccess(): Promise<{
  isModerator: boolean;
  user: AuthUser | null;
  error?: string;
}> {
  try {
    const { valid, user } = await validateSession();

    if (!valid || !user) {
      return { isModerator: false, user: null, error: "Invalid session" };
    }

    // const rcf = RcfIctClient.fromEnv();
    const fullProfile = await ictAdmin.member.getFullProfile(user.id);

    if (!fullProfile) {
      return { isModerator: false, user: null, error: "Profile not found" };
    }

    fullProfile.profile.email = user.email || "";
    const authUser = createAuthUser(fullProfile, user.email || "");

    // Check admin access first (admins are also moderators)
    const adminCheck = await checkEnhancedAdminAccess();
    if (adminCheck.isAdmin) {
      return { isModerator: true, user: authUser };
    }

    // Check moderator role
    const isModerator = ['ADMIN', 'MODERATOR'].includes(authUser.role);

    return {
      isModerator,
      user: authUser,
      error: isModerator ? undefined : "Access denied: Moderator access required"
    };

  } catch (error: unknown) {
    console.error("Moderator access check failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { isModerator: false, user: null, error: errorMessage };
  }
}

/**
 * Reusable access control for protected server actions
 * @param requiredLevel - 'USER' | 'MODERATOR' | 'ADMIN'
 */
export async function requireAccess(requiredLevel: 'USER' | 'MODERATOR' | 'ADMIN') {
  if (requiredLevel === 'ADMIN') {
    const adminCheck = await checkEnhancedAdminAccess();
    if (!adminCheck.isAdmin) {
      throw new Error(adminCheck.error || "Admin access required");
    }
    return adminCheck.user!;
  }

  if (requiredLevel === 'MODERATOR') {
    const modCheck = await checkModeratorAccess();
    if (!modCheck.isModerator) {
      throw new Error(modCheck.error || "Moderator access required");
    }
    return modCheck.user!;
  }

  // Basic user access
  const { valid, user } = await validateSession();
  if (!valid || !user) {
    throw new Error("Authentication required");
  }

//   const rcf = RcfIctClient.fromEnv();
  const fullProfile = await ictAdmin.member.getFullProfile(user.id);

  if (!fullProfile) {
    throw new Error("Profile not found");
  }

  fullProfile.profile.email = user.email || "";
  return createAuthUser(fullProfile, user.email || "");
}
