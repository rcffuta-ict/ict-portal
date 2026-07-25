'use server'

import { revalidatePath } from "next/cache";
import { ictAdmin } from "@/lib/ict";
import { requireSysAdmin, requirePresidentOrSysAdmin } from "@/lib/access-control";
import { getModuleAccessConfig } from "@/lib/module-access";
import { MODULES, type ModuleId, type ModuleAccessConfig, type WriteScope } from "@/lib/modules";
import { normalizeAccessToken } from "@/lib/privileges";
import { getSessionProfileId } from "@/lib/auth/session";

export interface PositionOption {
    title: string;
    alias: string | null;
    slug: string;
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

        const [positionsRes, unitsRes] = await Promise.all([
            ictAdmin.supabase
                .from("leadership_positions")
                .select("title, alias, slug, category, is_active")
                .order("category", { ascending: true })
                .order("title", { ascending: true }),
            ictAdmin.supabase
                .from("units")
                .select("id, name, slug")
                .order("name", { ascending: true }),
        ]);

        return {
            authorized: true,
            canWrite: ctx.isSysAdmin,
            config,
            positions: (positionsRes.data ?? []).map((p) => ({
                title: p.title,
                alias: p.alias,
                slug: p.slug,
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

        const profileId = await getSessionProfileId();
        const writeScope: WriteScope = input.writeScope === "OWN" ? "OWN" : "ALL";

        const { error } = await ictAdmin.supabase
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
