/**
 * Role-based utilities for user permissions
 * Implements role detection as per AUTHENTICATION.md
 */

import type { FullUserProfile } from '@rcffuta/ict-lib';

export type UserRole = 'USER' | 'ADMIN' | 'MODERATOR';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  user: FullUserProfile; // ICT lib profile with academics, personal info, etc.
}

/**
 * Determine user role based on profile data
 * Customize this logic based on your institution's requirements
 */
export function determineUserRole(profile: FullUserProfile): UserRole {
  // Check if user is ICT department (admin access)
  if (profile.academics?.department === 'ICT') {
    return 'ADMIN';
  }

  // Check if user has any leadership roles
  if (profile.roles && profile.roles.length > 0) {
    return 'MODERATOR';
  }

  // Default role for regular members
  return 'USER';
}

/**
 * Check if user has admin privileges
 */
export function isAdmin(user: AuthUser | FullUserProfile): boolean {
  if ('role' in user) {
    return user.role === 'ADMIN';
  }
  return determineUserRole(user) === 'ADMIN';
}

/**
 * Check if user has moderator or higher privileges
 */
export function isModerator(user: AuthUser | FullUserProfile): boolean {
  if ('role' in user) {
    return ['ADMIN', 'MODERATOR'].includes(user.role);
  }
  const role = determineUserRole(user);
  return ['ADMIN', 'MODERATOR'].includes(role);
}

/**
 * Convert FullUserProfile to AuthUser
 */
export function createAuthUser(profile: FullUserProfile, email: string): AuthUser {
  return {
    id: profile.profile.id,
    email: email || profile.profile.email || '',
    role: determineUserRole(profile),
    user: profile
  };
}

/**
 * Permission checks for specific actions
 */
export const permissions = {
  canManageUsers: (user: AuthUser) => isAdmin(user),
  canEditProfile: (user: AuthUser, profileId: string) => 
    isAdmin(user) || user.id === profileId,
  canViewAdminDashboard: (user: AuthUser) => isAdmin(user),
  canManageEvents: (user: AuthUser) => isModerator(user),
  canViewReports: (user: AuthUser) => isModerator(user),
} as const;