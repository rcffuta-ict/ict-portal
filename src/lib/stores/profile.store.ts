import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { FullUserProfile, UserBio, UserLocation, UserAcademics } from "@/lib/types/portal";

/**
 * The user object handed to the store is actually the enriched ProfileContext
 * (superset of FullUserProfile) returned by the login / session actions, carrying
 * `accessibleModules` resolved server-side from module_access config.
 */
type StoredUser = FullUserProfile & { accessibleModules?: string[] };

interface ProfileState {
    user: FullUserProfile | null;
    userId: string | null; // Simplified type for easier usage
    isLoading: boolean;
    lastRefresh: number | null; // Timestamp of last session refresh
    accessibleModules: string[]; // Tool modules this user may read (sidebar gating)
    /**
     * Whether the server has been asked about this session yet, and what it said.
     *
     * "unknown" and "unauthenticated" are NOT the same thing, and conflating them is
     * what made an expired session look like a hang: the dashboard shell could only
     * ask "is there a user?", so a finished check that found nobody was indistinguishable
     * from a check still in flight, and it showed the loading screen for both.
     */
    authStatus: "unknown" | "authenticated" | "unauthenticated";
    setAuthStatus: (status: "unknown" | "authenticated" | "unauthenticated") => void;

    // Core Actions
    setUser: (user: StoredUser) => void;
    setUserId: (userId: string) => void;
    clearUser: () => void;
    logout: () => void; // Logout with server cleanup
    markRefreshed: () => void; // Mark when session was last refreshed
    
    // Optimistic Updates
    updateBio: (data: Partial<UserBio>) => void;
    updateLocation: (data: Partial<UserLocation>) => void;
    updateAcademics: (data: Partial<UserAcademics>) => void;
}

export const useProfileStore = create<ProfileState>()(
  devtools(
    persist(
      (set) => ({
        // 1. Initialize all state values
        user: null,
        userId: null,
        authStatus: "unknown" as const,
        isLoading: true,
        lastRefresh: null,
        accessibleModules: [],

        // 2. Actions
        setUserId: (userId) => set({ userId, isLoading: false }, false, "SET_USER_ID"),

        setAuthStatus: (authStatus) => set({ authStatus }, false, "SET_AUTH_STATUS"),

        setUser: (user) => set({
            authStatus: "authenticated" as const,
            user,
            userId: user.profile.id, // <--- CRITICAL: Sync ID with Profile
            accessibleModules: user.accessibleModules ?? [], // resolved server-side
            isLoading: false,
            lastRefresh: Date.now(), // Track when user was set
        }, false, "SET_USER"),

        clearUser: () => set({
            authStatus: "unauthenticated" as const,
            user: null,
            userId: null, // <--- CRITICAL: Clear ID on logout
            accessibleModules: [],
            isLoading: false,
            lastRefresh: null,
        }, false, "CLEAR_USER"),

        logout: async () => {
            // Clear local state immediately
            set({
                user: null,
                userId: null,
                accessibleModules: [],
                isLoading: false,
                lastRefresh: null,
            }, false, "LOGOUT");
            
            // Clear server-side cookies
            try {
                const { logoutAction } = await import('@/app/actions/auth');
                await logoutAction();
            } catch (error) {
                console.error("Failed to clear server session:", error);
            }
        },

        markRefreshed: () => set({ 
            lastRefresh: Date.now() 
        }, false, "MARK_REFRESHED"),

        // 3. Optimistic Updates
        updateBio: (data) => set((state) => ({
          user: state.user ? {
            ...state.user,
            profile: { ...state.user.profile, ...data }
          } : null
        }), false, "UPDATE_BIO"),

        updateLocation: (data) => set((state) => ({
            user: state.user ? {
              ...state.user,
              location: { ...state.user.location, ...data }
            } : null
        }), false, "UPDATE_LOCATION"),

        updateAcademics: (data) => set((state) => ({
            user: state.user ? {
              ...state.user,
              academics: { ...state.user.academics, ...data }
            } : null
        }), false, "UPDATE_ACADEMICS"),
      }),
      {
        name: 'rcf-ict-profile-storage', // localStorage key
        partialize: (state) => ({
          user: state.user,
          userId: state.userId,
          accessibleModules: state.accessibleModules,
          lastRefresh: state.lastRefresh,
          // Don't persist isLoading
        }),
      }
    )
  )
);