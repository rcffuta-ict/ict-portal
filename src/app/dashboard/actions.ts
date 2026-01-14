'use server'

import { RcfIctClient } from "@rcffuta/ict-lib";

export async function getUserProfile() {
    const rcf = RcfIctClient.fromEnv();

    try {
        const { data: { user } } = await rcf.supabase.auth.getUser();

        if (!user) {
            return null;
        }

        // One call to get everything structured perfectly
        const fullProfile = await rcf.member.getFullProfile(user.id);

        if (fullProfile) {
            // Inject the email from Auth User if it wasn't in the profile table
            fullProfile.profile.email = user.email || "";
        }

        return fullProfile || null;
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
}

export async function getProfile(userId: string) {
    const rcf = RcfIctClient.fromEnv();

    try {
        const profile = await rcf.member.getFullProfile(userId);
        return profile || null;
    } catch (error) {
        console.error("Error fetching profile:", error);
        return null;
    }
}
