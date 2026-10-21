/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSysAdmin, requirePresidentOrSysAdmin } from "@/lib/access-control";
import { getModuleAccessConfig } from "@/lib/module-access";
import { MODULES, isPolicyFixedModule, type ModuleId, type ModuleAccessConfig, type WriteScope } from "@/lib/modules";
import { normalizeAccessToken } from "@/lib/privileges";
import { getSessionProfileId } from "@/lib/auth/session";
import { listPositions } from "@/lib/positions";
import type { ProfileContext } from "@/lib/auth/profile-context";

export interface PositionOption {
    title: string;
    alias: string | null;
    slug: string;
    /**
     * What kind of office this is, DERIVED from its privilege tags (migration 0013
     * dropped the stored `category` column). Display and grouping only.
     */
    category: string;
    isActive: boolean;
}

export interface UnitOption {
    id: string;
    name: string;
    slug: string;
}

export interface SettingsData {
    authorized: boolean;
    config?: ModuleAccessConfig;
    positions?: PositionOption[];
    units?: UnitOption[];
    /** Whether this viewer may change settings (System Admin). The President is read-only. */
    canWrite?: boolean;
}

/**
 * Load the module_access config + the position/unit catalogues (for the token-input
 * suggestions + validation). Readable by the System Admin (manages it) and the President
 * (sees everything, read-only). Writes are gated separately (requireSysAdmin).
 */
export async function getSettingsData(): Promise<SettingsData> {
    try {
        const ctx = await requirePresidentOrSysAdmin();
        const config = await getModuleAccessConfig();

        const [positions, unitsRes] = await Promise.all([
            listPositions(),
            db
                .from("units")
                .select("id, name, slug")
                .order("name", { ascending: true }),
        ]);

        return {
            authorized: true,
            canWrite: ctx.isSysAdmin,
            config,
            positions: [...positions]
                .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title))
                .map((p) => ({
                    title: p.title,
                    alias: p.alias,
                    slug: p.slug ?? "",
                    category: p.category,
                    isActive: p.is_active,
                })),
            units: (unitsRes.data ?? []).map((u) => ({ id: u.id, name: u.name, slug: u.slug })),
        };
    } catch {
        return { authorized: false };
    }
}

/** Normalise + de-dupe tokens so what's stored matches how the resolver compares them. */
function cleanTokens(tokens: string[]): string[] {
    return Array.from(
        new Set((tokens ?? []).map((t) => normalizeAccessToken(t)).filter(Boolean)),
    );
}

export interface UpdateModuleAccessInput {
    module: ModuleId;
    readTokens: string[];
    writeTokens: string[];
    writeScope: WriteScope;
}

/**
 * Persist one module's read/write access + write scope. System Admin only (the
 * President can view Settings but is globally write-blocked).
 * Tokens are stored verbatim (privilege tags); an unknown token simply matches
 * nobody, so no validation is required for safety.
 */
export async function updateModuleAccessAction(
    input: UpdateModuleAccessInput,
): Promise<{ success: boolean; error?: string }> {
    try {
        await requireSysAdmin();

        if (!MODULES.includes(input.module)) {
            return { success: false, error: "Unknown module." };
        }
        if (isPolicyFixedModule(input.module)) {
            return { success: false, error: "This module's access is fixed by fellowship policy and can't be changed here." };
        }

        const profileId = await getSessionProfileId();
        const writeScope: WriteScope = input.writeScope === "OWN" ? "OWN" : "ALL";

        const { error } = await db
            .from("module_access")
            .update({
                read_slugs: cleanTokens(input.readTokens),
                write_slugs: cleanTokens(input.writeTokens),
                write_scope: writeScope,
                updated_at: new Date().toISOString(),
                updated_by: profileId,
            })
            .eq("module", input.module);

        if (error) return { success: false, error: error.message };

        revalidatePath("/dashboard/settings");
        return { success: true };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : "Update failed",
        };
    }
}

// ---------------------------------------------------------------------------
// Lo! admins — leaders the System Admin trusts to moderate Lo! (see src/lib/lo-admin.ts)
// ---------------------------------------------------------------------------

export interface LoLeaderOption {
    profileId: string;
    name: string;
    email: string | null;
    /** The offices they hold this tenure, e.g. "Choir Coordinator, Assistant Prayer Secretary". */
    offices: string;
    /** Has an active portal login. Without one they could never use the access. */
    hasLogin: boolean;
    /** Already a Lo! admin this tenure. */
    isLoAdmin: boolean;
    grantedAt: string | null;
}

export interface LoAdminsData {
    authorized: boolean;
    canWrite?: boolean;
    /** No active tenure: nobody leads, so nobody can be appointed. */
    tenureId?: string | null;
    leaders?: LoLeaderOption[];
    error?: string;
}

function actorName(ctx: ProfileContext): string | null {
    return [ctx.profile.firstName, ctx.profile.lastName].filter(Boolean).join(" ") || null;
}

async function activeTenureId(): Promise<string | null> {
    const { data } = await db.from("tenures").select("id").eq("is_active", true).maybeSingle();
    return (data?.id as string | undefined) ?? null;
}

/**
 * Every leader of the active tenure, marked with whether they can sign in and whether
 * they are already a Lo! admin. One list rather than a search round-trip per keystroke:
 * a tenure has a few dozen leaders, and filtering them in the browser is instant on a
 * slow connection.
 */
export async function getLoAdminsData(): Promise<LoAdminsData> {
    try {
        const ctx = await requirePresidentOrSysAdmin();
        const tenureId = await activeTenureId();
        if (!tenureId) return { authorized: true, canWrite: ctx.isSysAdmin, tenureId: null, leaders: [] };

        const { data: rows, error } = await db
            .from("leadership")
            .select("profile_id, is_lead, profile:profiles!leadership_profile_id_fkey(first_name, last_name, email), position:leadership_positions(title)")
            .eq("tenure_id", tenureId);
        if (error) throw new Error(error.message);

        const byProfile = new Map<string, { name: string; email: string | null; offices: string[] }>();
        for (const row of (rows ?? []) as any[]) {
            const p = Array.isArray(row.profile) ? row.profile[0] : row.profile;
            const pos = Array.isArray(row.position) ? row.position[0] : row.position;
            const entry = byProfile.get(row.profile_id) ?? {
                name: [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "Unnamed member",
                email: p?.email ?? null,
                offices: [] as string[],
            };
            if (pos?.title) entry.offices.push(row.is_lead ? pos.title : `Assistant ${pos.title}`);
            byProfile.set(row.profile_id, entry);
        }

        const ids = [...byProfile.keys()];
        const [logins, grants] = await Promise.all([
            ids.length
                ? db.from("profile_login").select("profile_id").eq("is_active", true).in("profile_id", ids)
                : Promise.resolve({ data: [] as { profile_id: string }[] }),
            db.from("lo_admins").select("profile_id, granted_at").eq("tenure_id", tenureId).is("revoked_at", null),
        ]);

        const withLogin = new Set((logins.data ?? []).map((l) => l.profile_id as string));
        const granted = new Map((grants.data ?? []).map((g) => [g.profile_id as string, g.granted_at as string]));

        const leaders: LoLeaderOption[] = ids
            .map((id) => {
                const e = byProfile.get(id)!;
                return {
                    profileId: id,
                    name: e.name,
                    email: e.email,
                    offices: e.offices.join(", "),
                    hasLogin: withLogin.has(id),
                    isLoAdmin: granted.has(id),
                    grantedAt: granted.get(id) ?? null,
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));

        return { authorized: true, canWrite: ctx.isSysAdmin, tenureId, leaders };
    } catch (e) {
        const message = e instanceof Error ? e.message : "";
        if (/access denied|authentication/i.test(message)) return { authorized: false };
        return { authorized: true, error: "Couldn't load Lo! admins." };
    }
}

async function auditLoAdmin(ctx: ProfileContext, action: string, targetId: string, targetName: string | null) {
    const { error } = await db.from("admin_audit_log").insert({
        actor_profile_id: ctx.profile.id,
        actor_name: actorName(ctx),
        target_profile_id: targetId,
        target_name: targetName,
        action,
        field: "lo_admin",
        old_value: action === "lo_admin.revoke" ? "true" : "false",
        new_value: action === "lo_admin.revoke" ? "false" : "true",
    });
    if (error) console.error("lo admin audit failed:", error.message);
}

/**
 * Make a leader a Lo! admin for the active tenure. Re-checks, on the server, everything
 * the picker shows: System Admin only, the person leads in the active tenure, and they
 * have an active login. No login is ever created here.
 */
export async function addLoAdminAction(profileId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const ctx = await requireSysAdmin();
        const tenureId = await activeTenureId();
        if (!tenureId) return { success: false, error: "There is no active tenure." };

        const [lead, login, profile] = await Promise.all([
            db.from("leadership").select("id").eq("tenure_id", tenureId).eq("profile_id", profileId).limit(1),
            db.from("profile_login").select("id").eq("profile_id", profileId).eq("is_active", true).maybeSingle(),
            db.from("profiles").select("first_name, last_name").eq("id", profileId).maybeSingle(),
        ]);
        if (!lead.data?.length) return { success: false, error: "Only leaders of the current tenure can be Lo! admins." };
        if (!login.data) {
            return { success: false, error: "Their office has no portal login, so they couldn't sign in to moderate." };
        }

        const { error } = await db.from("lo_admins").insert({
            profile_id: profileId,
            tenure_id: tenureId,
            granted_by: ctx.profile.id,
        });
        // The partial unique index: already a Lo! admin. Not an error worth showing.
        if (error && error.code !== "23505") return { success: false, error: error.message };

        const name = [profile.data?.first_name, profile.data?.last_name].filter(Boolean).join(" ") || null;
        await auditLoAdmin(ctx, "lo_admin.grant", profileId, name);
        revalidatePath("/dashboard/settings");
        return { success: true };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Couldn't add them." };
    }
}

/** Take Lo! admin away. Effective on their very next request — access is checked live. */
export async function removeLoAdminAction(profileId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const ctx = await requireSysAdmin();
        const tenureId = await activeTenureId();
        if (!tenureId) return { success: false, error: "There is no active tenure." };

        const { data, error } = await db
            .from("lo_admins")
            .update({ revoked_at: new Date().toISOString(), revoked_by: ctx.profile.id })
            .eq("profile_id", profileId)
            .eq("tenure_id", tenureId)
            .is("revoked_at", null)
            .select("id");
        if (error) return { success: false, error: error.message };
        if (!data?.length) return { success: true };

        const { data: profile } = await db.from("profiles").select("first_name, last_name").eq("id", profileId).maybeSingle();
        const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || null;
        await auditLoAdmin(ctx, "lo_admin.revoke", profileId, name);
        revalidatePath("/dashboard/settings");
        return { success: true };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Couldn't remove them." };
    }
}
