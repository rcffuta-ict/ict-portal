import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { FullUserProfile, UserBio, UserLocation, UserAcademics } from '@rcffuta/ict-lib';

interface ProfileState {
    user: FullUserProfile | null;
    userId: string | null; // Simplified type for easier usage
    isLoading: boolean;

    // Core Actions
    setUser: (user: FullUserProfile) => void;
    setUserId: (userId: string) => void;
    clearUser: () => void;
    
    // Optimistic Updates
    updateBio: (data: Partial<UserBio>) => void;
    updateLocation: (data: Partial<UserLocation>) => void;
    updateAcademics: (data: Partial<UserAcademics>) => void;
}

export const useProfileStore = create<ProfileState>()(
  devtools((set) => ({
    // 1. Initialize all state values
    user: null,
    userId: null, 
    isLoading: true,

    // 2. Actions
    setUserId: (userId) => set({ userId, isLoading: false }, false, "SET_USER_ID"),
    
    setUser: (user) => set({ 
        user, 
        userId: user.profile.id, // <--- CRITICAL: Sync ID with Profile
        isLoading: false 
    }, false, "SET_USER"),
    
    clearUser: () => set({ 
        user: null, 
        userId: null, // <--- CRITICAL: Clear ID on logout
        isLoading: false 
    }, false, "CLEAR_USER"),

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
  }))
);