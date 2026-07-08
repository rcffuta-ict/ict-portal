/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { revalidatePath } from "next/cache";
import { ictAdmin } from "@/lib/ict";
import { requireContext, canManageLevel, requireAccess } from "@/lib/access-control";
import { createInvite, revokeInvite, listInvitesByCreator } from "@/lib/invites";
import { ensureLoginProvisioned } from "@/lib/auth/provision";

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
        return { success: true, token };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * VP Admin / ICT Coordinator: issue a single-use credential (reset) link for a
 * leader, so they can set their own password (the "forgot password" path).
 */
export async function createResetInviteAction(leaderProfileId: string) {
    try {
        const admin = await requireAccess("ADMIN"); // VP Admin / ICT Coord / PRESIDENT

        // The target must actually be a leader (holds a leadership position).
        const { data: rows } = await ictAdmin.supabase
            .from("leadership")
            .select("id")
            .eq("profile_id", leaderProfileId)
            .limit(1);
        if (!rows || rows.length === 0) {
            return { success: false, error: "Only leaders can receive a reset link." };
        }

        // Ensure a login row exists (idempotent) before they set a password.
        await ensureLoginProvisioned(leaderProfileId, admin.id);

        const { token } = await createInvite({
            createdBy: admin.id,
            purpose: "reset",
            targetProfileId: leaderProfileId,
            maxUses: 1,
        });
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
            .select("created_by")
            .eq("id", inviteId)
            .maybeSingle();
        if (!invite) return { success: false, error: "Invite not found." };
        if (invite.created_by !== ctx.profile.id && !ctx.isAdmin) {
            return { success: false, error: "You can't revoke this link." };
        }
        await revokeInvite(inviteId);
        revalidatePath("/dashboard/units");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
