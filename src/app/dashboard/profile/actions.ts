/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { BioData, LocationData, RcfIctClient } from "@rcffuta/ict-lib/server";
import { revalidatePath } from "next/cache";

export async function updateProfileAction(formData: FormData, userId: string) {

    // We use the Admin Client to bypass RLS if needed, or stick to user client if RLS allows update
    // Using Admin Client is safer for profile updates to ensure fields are written
    const adminRcf = RcfIctClient.asAdmin();

    try {
        // 2. Prepare Data Objects

        // BIO DATA
        const bioData: Partial<BioData> = {
            firstName: formData.get("firstName") as string,
            lastName: formData.get("lastName") as string,
            middleName: formData.get("middleName") as string,
            phoneNumber: formData.get("phoneNumber") as string,
            gender: formData.get("gender") as any,
            dob: formData.get("dob") as string,
        };

        // LOCATION DATA
        const locationData: LocationData = {
            schoolAddress: formData.get("schoolAddress") as string,
            homeAddress: formData.get("homeAddress") as string,
            residentialZoneId: (formData.get("residentialZoneId") as string) || undefined,
        };

        const currentLevel = formData.get("currentLevel") as string;

        // 3. Perform Updates (Parallel)
        const updates = [];

        // Update Bio (Direct DB update since lib might not have a dedicated updateBio method exposed yet)
        updates.push(
            adminRcf.supabase
                .from('profiles')
                .update({
                    first_name: bioData.firstName,
                    last_name: bioData.lastName,
                    middle_name: bioData.middleName,
                    phone_number: bioData.phoneNumber,
                    gender: bioData.gender,
                    dob: bioData.dob || null,
                })
                .eq('id', userId)
        );

        // Update Location (Using lib method which handles validation)
        updates.push(
            adminRcf.auth.updateLocationInfo(userId, locationData)
        );

        if (currentLevel) {
            updates.push(
                adminRcf.supabase
                    .from('academics')
                    .update({ current_level: currentLevel })
                    .eq('id', userId)
            );
        }

        // Execute all
        const results = await Promise.all(updates);

        // Check for DB errors in the Bio update (index 0)
        const bioUpdateResult = results[0];
        if ('error' in bioUpdateResult && bioUpdateResult.error) {
            throw bioUpdateResult.error;
        }

        revalidatePath('/dashboard/profile');
        return { success: true };

    } catch (e: any) {
        // Zod Error Handling
        if (e.errors) {
             // Return readable Zod messages
             const messages = e.errors.map((err: any) => `${err.path}: ${err.message}`).join(", ");
             return { success: false, error: messages };
        }
        return { success: false, error: e.message };
    }
}
