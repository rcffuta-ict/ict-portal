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

/** True when the context should READ ALL generations: the read-bypass tier or CENTRAL. */
function seesAllLevels(ctx: ProfileContext): boolean {
    if (ctx.isAdmin) return true;
    return (ctx.leadership ?? []).some((l) =>
        (l.privileges ?? []).some((p) => p.tag === "CENTRAL"),
    );
}

/** A LEVEL scope token → its canonical level label (mirrors access-control.ts). */
function levelTokenToLabel(token: string): string | null {
    const t = token.trim().toLowerCase();
    if (t === "pds-uabs" || t === "pds/uabs") return "PDS/UABS";
    if (/^[1-5]00$/.test(t)) return `${t} Level`;
    return null;
}

type ClassSetRow = { id: string; entry_year: number | null; is_foundation: boolean | null; level_override: string | null };

/**
 * The class_set ids the context can WRITE via its LEVEL privileges, resolved against
 * the active session (a level token → the generation currently at that level; an
 * un-scoped/'all' LEVEL → every generation). Empty when the context holds no LEVEL tag.
 */
function managedLevelIds(ctx: ProfileContext, sets: ClassSetRow[], session: string | null): Set<string> {
    const scopes = (ctx.leadership ?? [])
        .flatMap((l) => l.privileges ?? [])
        .filter((p) => p.tag === "LEVEL")
        .map((p) => p.scope);
    if (scopes.length === 0) return new Set();
    if (scopes.some((s) => s == null || s.toLowerCase() === "all")) {
        return new Set(sets.map((s) => s.id));
    }
    const labels = new Set(scopes.map((s) => levelTokenToLabel(s as string)).filter(Boolean) as string[]);
    const ids = new Set<string>();
    for (const s of sets) {
        const effective = s.level_override || computeLevel(s.entry_year, s.is_foundation, session);
        if (effective && labels.has(effective)) ids.add(s.id);
    }
    return ids;
}

type GenderTally = { total: number; male: number; female: number };
const emptyTally = (): GenderTally => ({ total: 0, male: 0, female: 0 });

export async function getLevelModuleData() {
    try {
        const ctx = await requireModuleRead("level");
        const tenure = await getActiveTenure();
        const session = tenure?.session ?? null;
        const seesAll = seesAllLevels(ctx);
        const canWriteAny = ctx.isSysAdmin || ctx.isVpAdmin; // write-bypass tier

        // Fetch all generations first (needed to resolve level-token scopes to ids).
        const { data: allSets } = await ictAdmin.supabase
            .from("class_sets")
            .select("id, family_name, entry_year, is_foundation, level_override")
            .order("entry_year", { ascending: false });

        // Generations this user WRITES (coordinates), resolved from LEVEL scopes.
        const managedIds = managedLevelIds(ctx, allSets ?? [], session);

        // Which class_sets to show: everything for read-all, else only managed ones.
        const sets = seesAll ? (allSets ?? []) : (allSets ?? []).filter((s) => managedIds.has(s.id));
        if (!seesAll && sets.length === 0) {
            return { authorized: true, seesAll: false, generations: [] as any[] };
        }

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
            canWrite: canWriteAny || managedIds.has(s.id),
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

        // WRITE capability is resolved through the LEVEL-scope logic (write-bypass tier
        // or a matching LEVEL privilege); CENTRAL/President can read but not write here.
        const canWrite = await canManageLevel(ctx, s.id);

        return {
            authorized: true as const,
            generation: {
                classSetId: s.id,
                familyName: s.family_name,
                entryYear: s.entry_year,
                isFoundation: s.is_foundation,
                level: s.level_override || computeLevel(s.entry_year, s.is_foundation, session),
                canWrite,
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
