/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { ictAdmin } from "@/lib/ict";
import { requireModuleRead, canManageLevel } from "@/lib/access-control";
import { getActiveTenure } from "@/utils/action";
import { computeLevel } from "@/lib/levels";
import { getProfileContext, type ProfileContext } from "@/lib/auth/profile-context";

/**
 * Level module — level (generation) member management for level coordinators.
 *
 * Read scope (per the `module_access` "level" config): CENTRAL/PRESIDENT & admins see
 * every generation; a LEVEL coordinator sees only the generation(s) they oversee.
 * Write (invite links) stays with the coordinators — see the invite actions in
 * ../invites/actions.ts, which enforce `canManageLevel`.
 */

/** True when the context should see ALL generations (not just its own). */
function seesAllLevels(ctx: ProfileContext): boolean {
    return (
        ctx.isAdmin ||
        (ctx.leadership ?? []).some(
            (l) => l.category === "CENTRAL" || l.category === "PRESIDENT",
        )
    );
}

type GenderTally = { total: number; male: number; female: number };
const emptyTally = (): GenderTally => ({ total: 0, male: 0, female: 0 });

export async function getLevelModuleData() {
    try {
        const ctx = await requireModuleRead("level");
        const tenure = await getActiveTenure();
        const session = tenure?.session ?? null;
        const seesAll = seesAllLevels(ctx);

        // Generations this user WRITES (coordinates).
        const managedIds = new Set(
            (ctx.leadership ?? [])
                .filter((l) => l.category === "LEVEL" && l.classSetId)
                .map((l) => l.classSetId as string),
        );

        // Which class_sets to show.
        let setsQuery = ictAdmin.supabase
            .from("class_sets")
            .select("id, family_name, entry_year, is_foundation, level_override")
            .order("entry_year", { ascending: false });
        if (!seesAll) {
            if (managedIds.size === 0) {
                return { authorized: true, seesAll: false, generations: [] as any[] };
            }
            setsQuery = setsQuery.in("id", [...managedIds]);
        }
        const { data: sets } = await setsQuery;

        // Member gender tallies per class_set.
        const { data: profs } = await ictAdmin.supabase
            .from("profiles")
            .select("class_set_id, gender");
        const stats = new Map<string, GenderTally>();
        for (const p of profs ?? []) {
            if (!p.class_set_id) continue;
            if (!stats.has(p.class_set_id)) stats.set(p.class_set_id, emptyTally());
            const t = stats.get(p.class_set_id)!;
            t.total += 1;
            if (p.gender === "male") t.male += 1;
            else if (p.gender === "female") t.female += 1;
        }

        const generations = (sets ?? []).map((s: any) => ({
            classSetId: s.id,
            familyName: s.family_name,
            entryYear: s.entry_year,
            isFoundation: s.is_foundation,
            level: s.level_override || computeLevel(s.entry_year, s.is_foundation, session),
            stats: stats.get(s.id) || emptyTally(),
            canWrite: ctx.isAdmin || managedIds.has(s.id),
        }));

        return { authorized: true, seesAll, generations };
    } catch (e: any) {
        return { authorized: false, error: e.message || "Access denied" };
    }
}

/** Can the current context READ this generation (central/admin, or its coordinator)? */
async function canReadLevel(ctx: ProfileContext, classSetId: string): Promise<boolean> {
    if (seesAllLevels(ctx)) return true;
    return canManageLevel(ctx, classSetId);
}

/** One generation's meta + the caller's write capability (for the detail page). */
export async function getGenerationAction(classSetId: string) {
    try {
        const ctx = await requireModuleRead("level");
        if (!(await canReadLevel(ctx, classSetId))) {
            return { authorized: false as const };
        }
        const tenure = await getActiveTenure();
        const session = tenure?.session ?? null;

        const { data: s } = await ictAdmin.supabase
            .from("class_sets")
            .select("id, family_name, entry_year, is_foundation, level_override")
            .eq("id", classSetId)
            .maybeSingle();
        if (!s) return { authorized: false as const };

        const managedIds = new Set(
            (ctx.leadership ?? [])
                .filter((l) => l.category === "LEVEL" && l.classSetId)
                .map((l) => l.classSetId as string),
        );

        return {
            authorized: true as const,
            generation: {
                classSetId: s.id,
                familyName: s.family_name,
                entryYear: s.entry_year,
                isFoundation: s.is_foundation,
                level: s.level_override || computeLevel(s.entry_year, s.is_foundation, session),
                canWrite: ctx.isAdmin || managedIds.has(s.id),
            },
        };
    } catch (e: any) {
        return { authorized: false as const, error: e.message };
    }
}

/** Members of a generation (read-gated for centrals/admins + the coordinator). */
export async function getLevelMembersAction(classSetId: string) {
    try {
        const ctx = await requireModuleRead("level");
        if (!(await canReadLevel(ctx, classSetId))) {
            return { success: false, error: "You don't have access to this level.", data: [] };
        }
        const { data } = await ictAdmin.supabase
            .from("profiles")
            .select("id, first_name, last_name, email, phone_number, department, avatar_url, matric_number, gender")
            .eq("class_set_id", classSetId)
            .order("first_name");
        return { success: true, data: data || [] };
    } catch (e: any) {
        return { success: false, error: e.message, data: [] };
    }
}

/**
 * Full detail for one member — every field the app holds (bio, academics, location,
 * roles, unit, teams). Only readable by someone who can read the member's generation.
 */
export async function getMemberDetailAction(profileId: string) {
    try {
        const ctx = await requireModuleRead("level");
        const { data: prof } = await ictAdmin.supabase
            .from("profiles").select("class_set_id").eq("id", profileId).maybeSingle();
        if (!prof) return { success: false, error: "Member not found." };
        if (prof.class_set_id == null || !(await canReadLevel(ctx, prof.class_set_id))) {
            return { success: false, error: "You don't have access to this member." };
        }
        const context = await getProfileContext(profileId);
        if (!context) return { success: false, error: "Could not load member." };
        return { success: true, data: context };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
