/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { db } from "@/lib/db";
import { getInviteByToken, consumeInvite, logInviteEvent } from "@/lib/invites";
import { requiredTestEmailDomain, testEmailError } from "@/lib/env";
import { parseGender } from "@/lib/gender";
import { parseLevelTokenInput } from "@/lib/level-token";
import { parseEmailList } from "@/lib/email-list";
import { getDepartments } from "@/lib/departments-db";
import { findProfileByEmail } from "@/lib/profile-lookup";
import { findDepartment } from "@/lib/departments";

/**
 * /profile: create or update a member's record, by level token.
 *
 * There is no self-registration. A profile can only be created (or updated) with a
 * level coordinator's token, from a shared link or typed in on /profile, and the token
 * pins the record to that coordinator's generation (class_set). Everything runs on the
 * service-role client, so every action here re-checks the token itself.
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
        const { data } = await db
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
        // Outside production only @rcffuta.test addresses are accepted, so the form can
        // say so next to the field instead of after a failed submit.
        testEmailDomain: requiredTestEmailDomain(),
    };
}

/**
 * Public: check a level token someone TYPED on /profile (no link).
 *
 * Only level tokens are accepted here: the one-off invite tokens are long and only ever
 * arrive inside a link. The same message covers "not a token" and "no such token".
 */
export async function openLevelTokenAction(raw: string) {
    const token = parseLevelTokenInput(raw);
    if (!token) {
        return { valid: false as const, reason: "That isn't a level token. It looks like RCF-7KX2P." };
    }
    const res = await validateInviteAction(token);
    if (!res.valid) return res;
    if (res.purpose !== "level") {
        return { valid: false as const, reason: "That isn't a level token. Ask your level coordinator for it." };
    }
    return { ...res, token };
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

        if (!email.trim()) return { success: false as const, error: "Enter your email address." };

        const profile = await findProfileByEmail<any>(email, `${PREFILL_COLUMNS}, class_set_id`);

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

/**
 * Public: the department list for the forms. Reference data about the university, so
 * it needs no token, and it carries nothing about any member. Deactivated departments
 * come too (flagged) so a member recorded against one still sees its name.
 */
export async function listDepartmentsAction() {
    try {
        return { success: true as const, data: await getDepartments(true) };
    } catch (e: any) {
        return { success: false as const, error: e.message || "Couldn't load departments.", data: [] };
    }
}

/** Public: fetch residential zones for the location step (service role — RLS deny). */
export async function getZonesAction() {
    try {
        const { data } = await db
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
        // Normalised rather than passed through: this is a PUBLIC endpoint, and
        // profiles_gender_check rejects anything but male/female/NULL.
        gender: parseGender(p.gender),
        dob: p.dob || null,
        matric_number: p.matricNumber?.trim() || null,
        // Already resolved to the course code by submitRegistrationAction. The database
        // trigger (rcf_sync_profile_department) sets department_id and the school.
        department: p.department || null,
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
        const emails = parseEmailList(payload.email).emails;
        if (emails.length !== 1) {
            return { success: false, error: "Enter one valid email address." };
        }
        // Enforced here, not only in the form: this endpoint is public.
        const testError = testEmailError(emails[0]);
        if (testError) return { success: false, error: testError };

        // The department must be one on the list, stored as its course code. The form
        // offers only those, but this endpoint is public, so it's checked here too.
        if (payload.department) {
            const dept = findDepartment(payload.department, await getDepartments());
            if (!dept) return { success: false, error: "Choose your department from the list." };
            payload = { ...payload, department: dept.alias };
        }

        const columns = { ...mapProfileColumns(payload), email: emails[0] };
        // entry_year comes from the generation, not the member.
        const entryYear = inv.classSet?.entryYear ?? null;
        const actorName = [payload.firstName, payload.lastName].filter(Boolean).join(" ");

        // A LEVEL token may target any member OF ITS OWN generation — the id comes from
        // the client, so re-verify the membership here rather than trusting the lookup step.
        let updateId: string | null = inv.purpose === "update" ? inv.targetProfileId : null;
        if (inv.purpose === "level" && targetProfileId) {
            const { data: target } = await db
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
            const { error } = await db
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
        const existing = await findProfileByEmail(columns.email, "id, email");
        if (existing) {
            return {
                success: false,
                exists: true,
                error: "A profile with this email already exists. Update your details instead.",
            };
        }

        const { data: created, error } = await db
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
