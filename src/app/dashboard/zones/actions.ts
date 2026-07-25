/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { revalidatePath } from "next/cache";
import { ictAdmin } from "@/lib/ict";
import { getActiveTenure } from "@/utils/action";
import { requireContext, requireAccess } from "@/lib/access-control";

/**
 * Zone module. Hall/zone pastors are NOT leadership positions — they live in the
 * dedicated `zone_pastors` table and do not get portal login by virtue of being a
 * pastor. The "coordinator" is an admin (VP Admin / ICT Coordinator).
 */

// --- LOADER ---
export async function getZoneModuleData() {
    const ctx = await requireContext();
    const tenure = await getActiveTenure();
    const tenureId = tenure?.id ?? null;

    if (ctx.isAdmin) {
        const zones = await getZonesOverview(tenureId);
        return { role: "COORDINATOR", zones, tenureId, authorized: true };
    }

    // Is the current user a pastor this tenure?
    if (tenureId) {
        const { data: pastor } = await ictAdmin.supabase
            .from("zone_pastors")
            .select("zone_id")
            .eq("profile_id", ctx.profile.id)
            .eq("tenure_id", tenureId)
            .maybeSingle();
        if (pastor?.zone_id) {
            const members = await ictAdmin.zone.getZoneMembers(pastor.zone_id);
            return { role: "PASTOR", members, zoneId: pastor.zone_id, authorized: true };
        }
    }

    return { role: "NONE", authorized: true };
}

async function getZonesOverview(tenureId: string | null) {
    const { data: zones } = await ictAdmin.supabase
        .from("residential_zones")
        .select("id, name, description")
        .order("name");

    const results = await Promise.all(
        (zones || []).map(async (z: any) => {
            const [{ count: memberCount }, { count: pastorCount }] = await Promise.all([
                ictAdmin.supabase.from("profiles").select("id", { count: "exact", head: true }).eq("residential_zone_id", z.id),
                ictAdmin.supabase
                    .from("zone_pastors")
                    .select("id", { count: "exact", head: true })
                    .eq("zone_id", z.id)
                    .eq("tenure_id", tenureId ?? ""),
            ]);
            return { ...z, memberCount: memberCount ?? 0, pastorCount: pastorCount ?? 0 };
        }),
    );
    return results;
}

// --- WRITE ACTIONS ---

export async function createZoneAction(formData: FormData) {
    try {
        await requireAccess("ADMIN");
        await ictAdmin.zone.createZone(
            formData.get("name") as string,
            formData.get("description") as string,
        );
        revalidatePath("/dashboard/zones");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/** Assign a hall/zone pastor (by email) into the zone_pastors table. */
export async function assignPastorAction(formData: FormData) {
    try {
        await requireAccess("ADMIN");
        const email = (formData.get("email") as string)?.trim().toLowerCase();
        const zoneId = formData.get("zoneId") as string;
        const tenureId = formData.get("tenureId") as string;

        const { data: profile } = await ictAdmin.supabase
            .from("profiles")
            .select("id")
            .eq("email", email)
            .maybeSingle();
        if (!profile) return { success: false, error: "No member found with that email." };

        const { error } = await ictAdmin.supabase
            .from("zone_pastors")
            .insert({ profile_id: profile.id, zone_id: zoneId, tenure_id: tenureId });
        if (error) {
            if (error.code === "23505") return { success: false, error: "That member is already a pastor of this zone." };
            throw error;
        }
        revalidatePath("/dashboard/zones");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/** Zone details for the coordinator: pastors (from zone_pastors) + members. */
export async function getZoneDetailsAction(zoneId: string, tenureId: string) {
    if (!tenureId) throw new Error("No active tenure given");

    const [{ data: pastorRows }, members] = await Promise.all([
        ictAdmin.supabase
            .from("zone_pastors")
            .select("id, profile:profiles(id, first_name, last_name, email, phone_number, avatar_url)")
            .eq("zone_id", zoneId)
            .eq("tenure_id", tenureId),
        ictAdmin.zone.getZoneMembers(zoneId),
    ]);

    // Flatten to the shape the coordinator view expects (leadershipId kept as the row id).
    const pastors = (pastorRows || []).map((r: any) => {
        const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
        return {
            leadershipId: r.id,
            first_name: p?.first_name,
            last_name: p?.last_name,
            email: p?.email,
            phone_number: p?.phone_number,
            avatar_url: p?.avatar_url,
        };
    });

    return { pastors, members };
}

export async function removePastorAction(zonePastorId: string) {
    try {
        await requireAccess("ADMIN");
        const { error } = await ictAdmin.supabase.from("zone_pastors").delete().eq("id", zonePastorId);
        if (error) throw error;
        revalidatePath("/dashboard/zones");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
