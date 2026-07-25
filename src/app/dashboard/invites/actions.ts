/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { revalidatePath } from "next/cache";
import { ictAdmin } from "@/lib/ict";
import { requireContext, canManageLevel } from "@/lib/access-control";
import { createInvite, revokeInvite, listInvitesByCreator } from "@/lib/invites";

/**
 * Level coordinator: create a shareable link that lets someone create (or update)
 * a profile in the coordinator's generation. Only a coordinator of that class_set
 * (or an admin) may create it.
 */
export async function createMemberInviteAction(
    purpose: "create" | "update",
    classSetId: string,
    targetProfileId?: string,
) {
    try {
        const ctx = await requireContext();
        if (!(await canManageLevel(ctx, classSetId))) {
            return { success: false, error: "You don't coordinate this level." };
        }
        if (purpose === "update" && !targetProfileId) {
            return { success: false, error: "An update link needs a target member." };
        }

        const { token } = await createInvite({
            createdBy: ctx.profile.id,
            purpose,
            classSetId,
            targetProfileId: targetProfileId ?? null,
        });
        revalidatePath("/dashboard/units");
        revalidatePath("/dashboard/level");
        return { success: true, token };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/** List the current user's invites (coordinator dashboard). */
export async function listMyInvitesAction() {
    try {
        const ctx = await requireContext();
        const data = await listInvitesByCreator(ctx.profile.id);
        return { success: true, data };
    } catch (e: any) {
        return { success: false, error: e.message, data: [] };
    }
}

/** Revoke an invite. Allowed for its creator or any admin. */
export async function revokeInviteAction(inviteId: string) {
    try {
        const ctx = await requireContext();
        const { data: invite } = await ictAdmin.supabase
            .from("registration_invites")
            .select("created_by, class_set_id")
            .eq("id", inviteId)
            .maybeSingle();
        if (!invite) return { success: false, error: "Invite not found." };
        // Creator, an admin, or the CURRENT coordinator of the link's generation — links
        // belong to the level, so a hand-over must not leave them unrevokable.
        const isLevelCoordinator =
            !!invite.class_set_id && (await canManageLevel(ctx, invite.class_set_id));
        if (invite.created_by !== ctx.profile.id && !ctx.isAdmin && !isLevelCoordinator) {
            return { success: false, error: "You can't revoke this link." };
        }
        await revokeInvite(inviteId);
        revalidatePath("/dashboard/units");
        revalidatePath("/dashboard/level");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
