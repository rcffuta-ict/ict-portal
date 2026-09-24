/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import type { BioData, LocationData } from "@/lib/types/portal";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { updateLocationInfo } from "@/lib/fellowship";
import { getSessionProfileId } from "@/lib/auth/session";
import { requireSysAdmin } from "@/lib/access-control";
import { parseGender } from "@/lib/gender";
import { getAcademicSettings, loadRecords } from "@/lib/academics-db";
import { bySemester, classOf, semesterLabel } from "@/lib/academics";

/**
 * Update a member's own profile.
 *
 * AUTHORIZATION — this action writes through the SERVICE-ROLE client, which bypasses
 * RLS, so it has to establish who the caller is by itself. It does that from the
 * session cookie via `getSessionProfileId()`; it never trusts an id sent by the client.
 *
 * `targetId` therefore only means "edit someone else", and that path requires the
 * System Admin. Left off (the normal case), the caller edits themselves and any id the
 * browser happened to send is ignored entirely.
 *
 * This used to take `userId` as a plain argument with no session check at all, which
 * made it an unauthenticated write over every member's record — server actions are
 * reachable as POST endpoints, and `src/proxy.ts` only checks that a token is present,
 * so it was no help here.
 */
export async function updateProfileAction(formData: FormData, targetId?: string) {
    try {
        const callerId = await getSessionProfileId();
        if (!callerId) {
            return { success: false, error: "You need to sign in again." };
        }

        const userId = targetId && targetId !== callerId ? targetId : callerId;
        if (userId !== callerId) {
            // Editing someone else is a System Admin capability; throws otherwise.
            await requireSysAdmin();
        }

        // BIO DATA
        const bioData: Partial<BioData> = {
            firstName: formData.get("firstName") as string,
            lastName: formData.get("lastName") as string,
            middleName: formData.get("middleName") as string,
            phoneNumber: formData.get("phoneNumber") as string,
            // parseGender, not the raw field: an unselected <select> submits "",
            // which profiles_gender_check rejects outright -- so leaving gender
            // unset failed the ENTIRE profile save with a constraint error.
            gender: parseGender(formData.get("gender")),
            dob: formData.get("dob") as string,
        };

        // LOCATION DATA
        const locationData: LocationData = {
            schoolAddress: formData.get("schoolAddress") as string,
            homeAddress: formData.get("homeAddress") as string,
            residentialZoneId: (formData.get("residentialZoneId") as string) || undefined,
        };

        // Optional Cloudinary avatar (only written when present in the form).
        const avatarUrl = formData.get("avatarUrl") as string | null;
        const avatarPublicId = formData.get("avatarPublicId") as string | null;
        const hasAvatarField = formData.has("avatarUrl");

        const bioResult = await db
            .from('profiles')
            .update({
                first_name: bioData.firstName,
                last_name: bioData.lastName,
                middle_name: bioData.middleName,
                phone_number: bioData.phoneNumber,
                gender: bioData.gender ?? null,
                dob: bioData.dob || null,
                // Only touch avatar columns when the editor submitted them.
                ...(hasAvatarField
                    ? { avatar_url: avatarUrl || null, avatar_public_id: avatarPublicId || null }
                    : {}),
            })
            .eq('id', userId);

        if (bioResult.error) throw bioResult.error;

        // Supabase resolves with an error rather than throwing, so this result is checked
        // too — an earlier version only inspected the bio update and reported a silent
        // failure here as success.
        await updateLocationInfo(userId, locationData);

        // NOTE: there is deliberately no "current level" write. Level is COMPUTED from
        // the member's generation (`class_sets` + the active session, via
        // `rcf_compute_level`) — there is no `academics` table and no `current_level`
        // column. A previous version wrote to `from('academics')` and, because its
        // result was never checked, discarded every such edit without a word.

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

/**
 * The signed-in member's own semester results, for the "My results" card. Only when the
 * Academic Unit has switched it on (academic_settings.members_see_own); otherwise
 * `enabled: false` and no grades. Always the caller's own record, from the session.
 */
export async function getMyResultsAction() {
    try {
        const profileId = await getSessionProfileId();
        if (!profileId) return { success: false as const, error: "You need to sign in again." };
        const settings = await getAcademicSettings();
        if (!settings.membersSeeOwn) return { success: true as const, enabled: false as const, records: [] };
        const records = (await loadRecords([profileId])).sort(bySemester).reverse();
        return {
            success: true as const,
            enabled: true as const,
            records: records.map((r) => ({
                id: r.id,
                label: semesterLabel(r.session, r.semester),
                gpa: r.gpa,
                cgpa: r.cgpa,
                classLabel: classOf(r.cgpa)?.label ?? null,
            })),
        };
    } catch (e: any) {
        return { success: false as const, error: e.message || "Couldn't load your results." };
    }
}
