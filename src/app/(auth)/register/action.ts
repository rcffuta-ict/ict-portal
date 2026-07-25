/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { ictAdmin } from "@/lib/ict";
import { getInviteByToken, consumeInvite, logInviteEvent } from "@/lib/invites";

/**
 * Invite-only registration.
 *
 * Public self-registration + the OTP email flow are gone. A profile can only be
 * created (or updated) through a level-coordinator's invite link, which pins the
 * new profile to that coordinator's generation (class_set). A 'reset' invite lets a
 * leader set their own password. Everything runs on the service-role client.
 */

export interface RegistrationPayload {
    firstName: string;
    lastName: string;
    middleName?: string;
    email: string;
    phoneNumber: string;
    gender: "male" | "female" | "";
    dob?: string;
    matricNumber?: string;
    department?: string;
    faculty?: string;
    schoolAddress?: string;
    homeAddress?: string;
    residentialZoneId?: string;
    avatarUrl?: string;
    avatarPublicId?: string;
}

/** Public: validate an invite token and describe what the page should render. */
export async function validateInviteAction(token: string) {
    const result = await getInviteByToken(token);
    if (!result.valid || !result.invite) {
        return { valid: false as const, reason: result.reason || "Invalid link." };
    }

    const inv = result.invite;

    // For 'update' pre-fill the current profile so the member can edit it.
    let prefill: Record<string, string | null> | null = null;
    if (inv.purpose === "update" && inv.targetProfileId) {
        const { data } = await ictAdmin.supabase
            .from("profiles")
            .select("first_name, last_name, middle_name, email, phone_number, gender, dob, matric_number, department, faculty, school_address, home_address, residential_zone_id, avatar_url")
            .eq("id", inv.targetProfileId)
            .maybeSingle();
        prefill = data ?? null;
    }

    return {
        valid: true as const,
        purpose: inv.purpose,
        classSet: inv.classSet,
        targetProfile: inv.targetProfile,
        prefill,
    };
}

const PREFILL_COLUMNS =
    "id, first_name, last_name, middle_name, email, phone_number, gender, dob, matric_number, department, faculty, school_address, home_address, residential_zone_id, avatar_url";

/**
 * Public: on a LEVEL token used with `reason=update`, confirm the person is already in
 * the generation that owns the token and hand back their record to edit.
 *
 * Deliberately narrow: an exact email match only (no listing, no partial search), and the
 * profile must belong to *this* token's class_set — so a token grants edit rights over the
 * members of its own level and nothing else. The same generic message is returned whether
 * the email is unknown or belongs to another level, so the token can't be used to probe
 * which addresses exist in the database.
 */
export async function lookupLevelMemberAction(token: string, email: string) {
    try {
        const result = await getInviteByToken(token);
        if (!result.valid || !result.invite) {
            return { success: false as const, error: result.reason || "Invalid link." };
        }
        const inv = result.invite;
        if (inv.purpose !== "level" || !inv.classSetId) {
            return { success: false as const, error: "This link can't be used to update details." };
        }

        const clean = email.trim().toLowerCase();
        if (!clean) return { success: false as const, error: "Enter your email address." };

        const { data: profile } = await ictAdmin.supabase
            .from("profiles")
            .select(`${PREFILL_COLUMNS}, class_set_id`)
            .eq("email", clean)
            .maybeSingle();

        const notFound =
            "We couldn't find that email in this level. Check the address, or ask your coordinator for help.";
        if (!profile || profile.class_set_id !== inv.classSetId) {
            return { success: false as const, error: notFound };
        }

        // Hand back only the editable columns — the class_set stays server-side.
        const prefill: Record<string, any> = { ...(profile as any) };
        delete prefill.class_set_id;
        return {
            success: true as const,
            profileId: profile.id as string,
            name: [(profile as any).first_name, (profile as any).last_name].filter(Boolean).join(" "),
            prefill: prefill as Record<string, string | null>,
        };
    } catch (e: any) {
        return { success: false as const, error: e.message || "Lookup failed." };
    }
}

/** Public: fetch residential zones for the location step (service role — RLS deny). */
export async function getZonesAction() {
    try {
        const { data } = await ictAdmin.supabase
            .from("residential_zones")
            .select("id, name")
            .order("name");
        return { success: true, data: data ?? [] };
    } catch {
        return { success: false, data: [] };
    }
}

function mapProfileColumns(p: RegistrationPayload) {
    return {
        first_name: p.firstName?.trim(),
        last_name: p.lastName?.trim(),
        middle_name: p.middleName?.trim() || null,
        email: p.email?.trim().toLowerCase(),
        phone_number: p.phoneNumber?.trim() || null,
        gender: p.gender || null,
        dob: p.dob || null,
        matric_number: p.matricNumber?.trim() || null,
        department: p.department || null,
        faculty: p.faculty || null,
        school_address: p.schoolAddress?.trim() || null,
        home_address: p.homeAddress?.trim() || null,
        residential_zone_id: p.residentialZoneId || null,
        avatar_url: p.avatarUrl || null,
        avatar_public_id: p.avatarPublicId || null,
    };
}

/**
 * Public: create or update a profile via a 'create'/'update' invite.
 * The profile is pinned to the invite's class_set (generation).
 */
export async function submitRegistrationAction(
    token: string,
    payload: RegistrationPayload,
    targetProfileId?: string,
) {
    try {
        const result = await getInviteByToken(token);
        if (!result.valid || !result.invite) {
            return { success: false, error: result.reason || "Invalid link." };
        }
        const inv = result.invite;
        if (!payload.firstName || !payload.lastName || !payload.email) {
            return { success: false, error: "First name, last name and email are required." };
        }

        const columns = mapProfileColumns(payload);
        // entry_year comes from the generation, not the member.
        const entryYear = inv.classSet?.entryYear ?? null;
        const actorName = [payload.firstName, payload.lastName].filter(Boolean).join(" ");

        // A LEVEL token may target any member OF ITS OWN generation — the id comes from
        // the client, so re-verify the membership here rather than trusting the lookup step.
        let updateId: string | null = inv.purpose === "update" ? inv.targetProfileId : null;
        if (inv.purpose === "level" && targetProfileId) {
            const { data: target } = await ictAdmin.supabase
                .from("profiles")
                .select("id, class_set_id")
                .eq("id", targetProfileId)
                .maybeSingle();
            if (!target || target.class_set_id !== inv.classSetId) {
                return { success: false, error: "That member isn't in this level." };
            }
            updateId = target.id as string;
        }

        if (updateId) {
            const { error } = await ictAdmin.supabase
                .from("profiles")
                .update({ ...columns, class_set_id: inv.classSetId, entry_year: entryYear, updated_at: new Date().toISOString() })
                .eq("id", updateId);
            if (error) throw error;
            await consumeInvite(inv.id);
            await logInviteEvent({
                inviteId: inv.id,
                action: "update",
                profileId: updateId,
                actorName,
                actorEmail: columns.email ?? null,
            });
            return { success: true, profileId: updateId };
        }

        // create: guard against duplicate email.
        const { data: existing } = await ictAdmin.supabase
            .from("profiles")
            .select("id")
            .eq("email", columns.email)
            .maybeSingle();
        if (existing) {
            return {
                success: false,
                error:
                    "A profile with this email already exists. Use the update link for your level " +
                    "(same token, “Update my details”) to edit it.",
            };
        }

        const { data: created, error } = await ictAdmin.supabase
            .from("profiles")
            .insert({ ...columns, class_set_id: inv.classSetId, entry_year: entryYear })
            .select("id")
            .single();
        if (error) throw error;

        await consumeInvite(inv.id);
        await logInviteEvent({
            inviteId: inv.id,
            action: "register",
            profileId: created.id as string,
            actorName,
            actorEmail: columns.email ?? null,
        });
        return { success: true, profileId: created.id as string };
    } catch (e: any) {
        console.error("submitRegistration error:", e);
        return { success: false, error: e.message || "Registration failed." };
    }
}
