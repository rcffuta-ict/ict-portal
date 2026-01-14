import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { FullUserProfile, UserBio, UserLocation, UserAcademics } from '@rcffuta/ict-lib';

interface ProfileState {
    user: FullUserProfile | null;
    userId: string | null; // Simplified type for easier usage
    isLoading: boolean;
    lastRefresh: number | null; // Timestamp of last session refresh

    // Core Actions
    setUser: (user: FullUserProfile) => void;
    setUserId: (userId: string) => void;
    clearUser: () => void;
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
        isLoading: true,
        lastRefresh: null,

        // 2. Actions
        setUserId: (userId) => set({ userId, isLoading: false }, false, "SET_USER_ID"),
        
        setUser: (user) => set({ 
            user, 
            userId: user.profile.id, // <--- CRITICAL: Sync ID with Profile
            isLoading: false,
            lastRefresh: Date.now(), // Track when user was set
        }, false, "SET_USER"),
        
        clearUser: () => set({ 
            user: null, 
            userId: null, // <--- CRITICAL: Clear ID on logout
            isLoading: false,
            lastRefresh: null,
        }, false, "CLEAR_USER"),

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
          lastRefresh: state.lastRefresh,
          // Don't persist isLoading
        }),
      }
    )
  )
);