'use server'

import { revalidatePath } from "next/cache";
import { ictAdmin } from "@/lib/ict";
import { requireIctCoord } from "@/lib/access-control";
import { getModuleAccessConfig } from "@/lib/module-access";
import { MODULES, type ModuleId, type ModuleAccessConfig, type WriteScope } from "@/lib/modules";
import { getSessionProfileId } from "@/lib/auth/session";

export interface PositionOption {
    title: string;
    alias: string | null;
    slug: string;
    category: string;
    isActive: boolean;
}

export interface SettingsData {
    authorized: boolean;
    config?: ModuleAccessConfig;
    positions?: PositionOption[];
}

/**
 * Load the module_access config + the position catalogue (for the pill-input
 * suggestions). ICT Coordinator only.
 */
export async function getSettingsData(): Promise<SettingsData> {
    try {
        await requireIctCoord();
        const config = await getModuleAccessConfig();

        const { data: positions } = await ictAdmin.supabase
            .from("leadership_positions")
            .select("title, alias, slug, category, is_active")
            .order("category", { ascending: true })
            .order("title", { ascending: true });

        return {
            authorized: true,
            config,
            positions: (positions ?? []).map((p) => ({
                title: p.title,
                alias: p.alias,
                slug: p.slug,
                category: p.category,
                isActive: p.is_active,
            })),
        };
    } catch {
        return { authorized: false };
    }
}

function cleanTokens(tokens: string[]): string[] {
    return Array.from(
        new Set((tokens ?? []).map((t) => t.trim()).filter(Boolean)),
    );
}

export interface UpdateModuleAccessInput {
    module: ModuleId;
    readTokens: string[];
    writeTokens: string[];
    writeScope: WriteScope;
}

/**
 * Persist one module's read/write access + write scope. ICT Coordinator only.
 * Tokens are stored verbatim (position slugs and/or category tokens); an unknown
 * token simply matches nobody, so no validation is required for safety.
 */
export async function updateModuleAccessAction(
    input: UpdateModuleAccessInput,
): Promise<{ success: boolean; error?: string }> {
    try {
        await requireIctCoord();

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
