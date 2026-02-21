import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FullUserProfile } from "@rcffuta/ict-lib";

export type SessionData = {
    profile: FullUserProfile;
    raffleId: number | null;
    eventTitle: string;
    eventDate: string;
    /** Timestamp (ms) of when this session was last verified with the server */
    lastRefresh: number;
};

export interface ProfileStoreState {
    session: SessionData | null;
    isLoading: boolean;
    setSession: (data: Omit<SessionData, "lastRefresh">) => void;
    clearSession: () => void;
    setLoading: (loading: boolean) => void;
}

export const useProfileStore = create<ProfileStoreState>()(
    persist(
        (set) => ({
            session: null,
            isLoading: false,
            setSession: (data) =>
                set({ session: { ...data, lastRefresh: Date.now() }, isLoading: false }),
            clearSession: () => set({ session: null }),
            setLoading: (loading) => set({ isLoading: loading }),
        }),
        { name: "cfm-v2-session" }
    )
);
