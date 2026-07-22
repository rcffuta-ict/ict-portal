/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { ictAdmin } from "@/lib/ict";
import { requireModuleRead, canManageLevel } from "@/lib/access-control";
import { getActiveTenure } from "@/utils/action";
import { computeLevel } from "@/lib/levels";
import { getProfileContext, type ProfileContext } from "@/lib/auth/profile-context";
import {
    listInvitesByClassSet,
    listInviteEventsByClassSet,
    createInvite,
    revokeInvite,
    logInviteEvent,
} from "@/lib/invites";
import { revalidatePath } from "next/cache";
import { EXPORT_FIELDS, MIN_EXPORT_FIELDS } from "./export-fields";

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

/**
 * Members of a generation, PAGED (read-gated for centrals/admins + the coordinator).
 *
 * Paging and search both run in Postgres — a generation can hold several hundred
 * profiles, and shipping all of them to a phone on mobile data just to filter in the
 * browser is exactly the thing this project can't afford.
 */
export async function getLevelMembersAction(
    classSetId: string,
    opts: { page?: number; pageSize?: number; query?: string } = {},
) {
    try {
        const ctx = await requireModuleRead("level");
        if (!(await canReadLevel(ctx, classSetId))) {
            return { success: false, error: "You don't have access to this level.", data: [], total: 0 };
        }

        const pageSize = Math.min(Math.max(opts.pageSize ?? 24, 1), 100);
        const page = Math.max(opts.page ?? 1, 1);
        const from = (page - 1) * pageSize;

        let q = ictAdmin.supabase
            .from("profiles")
            .select(
                "id, first_name, last_name, email, phone_number, department, avatar_url, matric_number, gender",
                { count: "exact" },
            )
            .eq("class_set_id", classSetId);

        const term = opts.query?.trim();
        if (term) {
            // Escape PostgREST's or() delimiters before interpolating the user's text.
            const safe = term.replace(/[,()\\]/g, " ");
            q = q.or(
                ["first_name", "last_name", "email", "phone_number", "matric_number"]
                    .map((c) => `${c}.ilike.%${safe}%`)
                    .join(","),
            );
        }

        const { data, count } = await q
            .order("first_name")
            .range(from, from + pageSize - 1);

        return {
            success: true,
            data: data || [],
            total: count ?? 0,
            page,
            pageSize,
            hasMore: (count ?? 0) > from + (data?.length ?? 0),
        };
    } catch (e: any) {
        return { success: false, error: e.message, data: [], total: 0 };
    }
}

/**
 * Headline stats for a generation: gender split and workforce participation.
 * "Worker" = belongs to at least one WORKFORCE unit (`units.is_workforce`), so loose
 * units (e.g. Sisters Unit) correctly don't count someone as a worker.
 */
export async function getLevelStatsAction(classSetId: string) {
    try {
        const ctx = await requireModuleRead("level");
        if (!(await canReadLevel(ctx, classSetId))) {
            return { success: false, error: "You don't have access to this level." };
        }

        const { data: members } = await ictAdmin.supabase
            .from("profiles")
            .select("id, gender")
            .eq("class_set_id", classSetId);

        const rows = members ?? [];
        const ids = rows.map((m) => m.id);

        const workerIds = new Set<string>();
        if (ids.length) {
            const { data: memberships } = await ictAdmin.supabase
                .from("membership_units")
                .select("profile_id, unit:units(is_workforce)")
                .in("profile_id", ids);
            for (const m of (memberships ?? []) as any[]) {
                const unit = Array.isArray(m.unit) ? m.unit[0] : m.unit;
                if (unit?.is_workforce) workerIds.add(m.profile_id);
            }
        }

        const male = rows.filter((m) => m.gender === "male").length;
        const female = rows.filter((m) => m.gender === "female").length;

        return {
            success: true,
            stats: {
                total: rows.length,
                male,
                female,
                unspecified: rows.length - male - female,
                workers: workerIds.size,
                nonWorkers: rows.length - workerIds.size,
            },
        };
    } catch (e: any) {
        return { success: false, error: e.message };
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
        if (!prof) return { success: false as const, error: "Member not found.", canWrite: false };
        if (prof.class_set_id == null || !(await canReadLevel(ctx, prof.class_set_id))) {
            return { success: false as const, error: "You don't have access to this member.", canWrite: false };
        }
        const context = await getProfileContext(profileId);
        if (!context) return { success: false as const, error: "Could not load member.", canWrite: false };
        // `canWrite` drives the member-page update-link control only; the invite action
        // re-checks `canManageLevel` itself, so this flag is UI convenience, not a gate.
        const canWrite = await canManageLevel(ctx, prof.class_set_id);
        return { success: true as const, data: context, canWrite, classSetId: prof.class_set_id };
    } catch (e: any) {
        return { success: false as const, error: e.message, canWrite: false };
    }
}

// ---------------------------------------------------------------------------
// Level tokens
// ---------------------------------------------------------------------------
//
// A LEVEL TOKEN belongs to the generation, not to a person or a purpose. One token
// backs both flows — the *link* is assembled at share time
// (`/register?invite=<token>&reason=register|update`) — so the raw token stays a plain
// string a coordinator can paste anywhere. Generate/revoke needs WRITE on the level;
// listing is the same, since a token is a credential and shouldn't be visible to
// read-only viewers.

/** Every token attached to a generation (active AND revoked), newest first. */
export async function listLevelInvitesAction(classSetId: string) {
    try {
        const ctx = await requireModuleRead("level");
        if (!(await canManageLevel(ctx, classSetId))) {
            return { success: false, error: "You don't coordinate this level.", data: [] };
        }
        const rows = (await listInvitesByClassSet(classSetId)).filter(
            (i: any) => i.purpose !== "reset",
        );

        // Resolve creator names in one extra query (rather than an embed) so the shape
        // doesn't depend on the FK constraint name.
        const creatorIds = Array.from(new Set(rows.map((r: any) => r.created_by).filter(Boolean)));
        const creators = new Map<string, string>();
        if (creatorIds.length) {
            const { data: people } = await ictAdmin.supabase
                .from("profiles")
                .select("id, first_name, last_name")
                .in("id", creatorIds);
            for (const p of people ?? []) {
                creators.set(p.id, [p.first_name, p.last_name].filter(Boolean).join(" "));
            }
        }

        return {
            success: true,
            data: rows.map((r: any) => ({
                ...r,
                created_by_name: creators.get(r.created_by) || null,
            })),
        };
    } catch (e: any) {
        return { success: false, error: e.message, data: [] };
    }
}

/** Generate a new level token. Write access on the level required. */
export async function generateLevelTokenAction(classSetId: string, label?: string) {
    try {
        const ctx = await requireModuleRead("level");
        if (!(await canManageLevel(ctx, classSetId))) {
            return { success: false, error: "You don't coordinate this level." };
        }
        const { token, id } = await createInvite({
            createdBy: ctx.profile.id,
            purpose: "level",
            classSetId,
            label: label?.trim() || null,
        });
        await logInviteEvent({
            inviteId: id,
            action: "generated",
            profileId: ctx.profile.id,
            actorName: [ctx.profile.firstName, ctx.profile.lastName].filter(Boolean).join(" "),
            actorEmail: ctx.profile.email ?? null,
        });
        revalidatePath(`/dashboard/level/${classSetId}`);
        return { success: true, token };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/** Revoke a level token. Write access on the level that OWNS the token is required. */
export async function revokeLevelTokenAction(inviteId: string) {
    try {
        const ctx = await requireModuleRead("level");
        const { data: invite } = await ictAdmin.supabase
            .from("registration_invites")
            .select("id, class_set_id, is_active")
            .eq("id", inviteId)
            .maybeSingle();
        if (!invite?.class_set_id) return { success: false, error: "Token not found." };
        if (!(await canManageLevel(ctx, invite.class_set_id))) {
            return { success: false, error: "You don't coordinate this level." };
        }
        await revokeInvite(inviteId);
        await logInviteEvent({
            inviteId,
            action: "revoked",
            profileId: ctx.profile.id,
            actorName: [ctx.profile.firstName, ctx.profile.lastName].filter(Boolean).join(" "),
            actorEmail: ctx.profile.email ?? null,
        });
        revalidatePath(`/dashboard/level/${invite.class_set_id}`);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/** Everything that has been done with this generation's tokens, newest first. */
export async function getLevelTokenActivityAction(classSetId: string) {
    try {
        const ctx = await requireModuleRead("level");
        if (!(await canManageLevel(ctx, classSetId))) {
            return { success: false, error: "You don't coordinate this level.", data: [] };
        }
        const events = await listInviteEventsByClassSet(classSetId);
        return {
            success: true,
            data: events.map((e: any) => {
                const inv = Array.isArray(e.invite) ? e.invite[0] : e.invite;
                return {
                    id: e.id,
                    action: e.action,
                    actorName: e.actor_name,
                    actorEmail: e.actor_email,
                    profileId: e.profile_id,
                    createdAt: e.created_at,
                    token: inv?.token ?? null,
                    label: inv?.label ?? null,
                };
            }),
        };
    } catch (e: any) {
        return { success: false, error: e.message, data: [] };
    }
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

const EXPORT_FIELD_KEYS = new Set(EXPORT_FIELDS.map((f) => f.key));
const EXPORT_LABELS = new Map(EXPORT_FIELDS.map((f) => [f.key, f.label]));

/** Profile columns the export may read (keys that map 1:1 onto `profiles`). */
const PROFILE_COLUMNS = [
    "first_name", "last_name", "middle_name", "email", "phone_number", "gender",
    "matric_number", "department", "faculty", "school_address", "home_address",
];

/**
 * RFC4180 cell + spreadsheet formula-injection guard: a value starting with =, +, -, @
 * (or a tab/CR) is executed as a formula by Excel/Sheets, so prefix it with an apostrophe.
 */
function csvCell(value: unknown): string {
    if (value === null || value === undefined) return "";
    let s = String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Export a generation's members as CSV, limited to the caller-selected fields.
 *
 * Read-gated exactly like the member list (`canReadLevel`) — an export is just a bulk
 * read, so it must not be easier to obtain than the screen it mirrors. Field keys are
 * validated against the shared whitelist, and the minimum-two-fields rule is enforced
 * here as well as in the UI.
 */
export async function exportLevelMembersAction(classSetId: string, fields: string[]) {
    try {
        const ctx = await requireModuleRead("level");
        if (!(await canReadLevel(ctx, classSetId))) {
            return { success: false, error: "You don't have access to this level." };
        }

        const selected = (fields ?? []).filter((f) => EXPORT_FIELD_KEYS.has(f));
        if (selected.length < MIN_EXPORT_FIELDS) {
            return {
                success: false,
                error: `Select at least ${MIN_EXPORT_FIELDS} fields to export.`,
            };
        }

        const tenure = await getActiveTenure();
        const session = tenure?.session ?? null;

        const { data: set } = await ictAdmin.supabase
            .from("class_sets")
            .select("id, family_name, entry_year, is_foundation, level_override")
            .eq("id", classSetId)
            .maybeSingle();
        if (!set) return { success: false, error: "Generation not found." };

        const { data: members } = await ictAdmin.supabase
            .from("profiles")
            .select(`id, residential_zone_id, ${PROFILE_COLUMNS.join(", ")}`)
            .eq("class_set_id", classSetId)
            .order("first_name");

        const rows = (members ?? []) as any[];
        const ids = rows.map((m) => m.id);

        // Derived columns — fetched only when actually selected.
        const zoneNames = new Map<string, string>();
        if (selected.includes("zone")) {
            const { data: zones } = await ictAdmin.supabase
                .from("residential_zones")
                .select("id, name");
            for (const z of zones ?? []) zoneNames.set(z.id, z.name);
        }

        const unitByProfile = new Map<string, string>();
        const teamsByProfile = new Map<string, string[]>();
        if ((selected.includes("unit") || selected.includes("teams")) && ids.length) {
            const { data: memberships } = await ictAdmin.supabase
                .from("membership_units")
                .select("profile_id, unit:units(name, type)")
                .in("profile_id", ids);
            for (const m of (memberships ?? []) as any[]) {
                const unit = Array.isArray(m.unit) ? m.unit[0] : m.unit;
                if (!unit) continue;
                if (unit.type === "TEAM") {
                    teamsByProfile.set(m.profile_id, [
                        ...(teamsByProfile.get(m.profile_id) ?? []),
                        unit.name,
                    ]);
                } else {
                    unitByProfile.set(m.profile_id, unit.name);
                }
            }
        }

        const level = set.level_override || computeLevel(set.entry_year, set.is_foundation, session);

        const valueFor = (m: any, key: string): unknown => {
            switch (key) {
                case "level": return level;
                case "generation": return set.family_name;
                case "zone": return m.residential_zone_id ? zoneNames.get(m.residential_zone_id) : "";
                case "unit": return unitByProfile.get(m.id) ?? "";
                case "teams": return (teamsByProfile.get(m.id) ?? []).join("; ");
                default: return m[key];
            }
        };

        const header = selected.map((k) => csvCell(EXPORT_LABELS.get(k) ?? k)).join(",");
        const body = rows.map((m) => selected.map((k) => csvCell(valueFor(m, k))).join(","));
        const csv = [header, ...body].join("\r\n");

        const slug = (set.family_name || "generation")
            .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const filename = `${slug || "generation"}-members-${new Date().toISOString().slice(0, 10)}.csv`;

        return { success: true, csv, filename, count: rows.length };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
