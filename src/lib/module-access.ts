/**
 * Data-driven module access — the single source of truth for who may READ / WRITE
 * each Tool module (tenure | zones | workforce | level).
 *
 * Access is configured at runtime in the `module_access` table (see migration 0004),
 * managed by the ICT Coordinator (src/app/dashboard/settings). Each module lists
 * `read_slugs` / `write_slugs`; every entry is EITHER a position slug (e.g. `vp-admin`)
 * OR a category token (`CENTRAL` | `UNIT` | `TEAM` | `LEVEL` | `ZONE` | `PRESIDENT`).
 *
 * A user "holds" a token when, in the active tenure, they hold a position whose slug
 * matches (slug token) or whose category matches (category token). Admins (VP Admin /
 * ICT Coordinator / PRESIDENT scope) ALWAYS pass, so config can never lock them out.
 *
 * Server-only: reads the service-role-locked `module_access` table via ictAdmin.
 * Resolvers themselves are pure over a ProfileContext + config, so they're cheap to
 * reuse (e.g. resolving `accessibleModules` once at login).
 *
 * Server-only: reads the service-role client. Never import into a client component.
 */
import { ictAdmin } from "@/lib/ict";
import type { ProfileContext } from "@/lib/auth/profile-context";
import {
    MODULES,
    type ModuleId,
    type WriteScope,
    type ModuleAccessRow,
    type ModuleAccessConfig,
} from "@/lib/modules";

// Re-export the shared primitives so existing server-side imports keep working.
export { MODULES };
export type { ModuleId, WriteScope, ModuleAccessRow, ModuleAccessConfig };

function emptyRow(module: ModuleId): ModuleAccessRow {
    return { module, readSlugs: [], writeSlugs: [], writeScope: "ALL" };
}

/**
 * Read the module_access config, keyed by module. Missing rows fall back to an empty
 * (deny-all-but-admins) row so callers can index every module safely.
 */
export async function getModuleAccessConfig(): Promise<ModuleAccessConfig> {
    const config = Object.fromEntries(
        MODULES.map((m) => [m, emptyRow(m)]),
    ) as ModuleAccessConfig;

    const { data, error } = await ictAdmin.supabase
        .from("module_access")
        .select("module, read_slugs, write_slugs, write_scope");

    if (error) {
        console.error("getModuleAccessConfig failed:", error.message);
        return config;
    }

    for (const row of data ?? []) {
        const moduleId = row.module as ModuleId;
        if (!MODULES.includes(moduleId)) continue;
        config[moduleId] = {
            module: moduleId,
            readSlugs: row.read_slugs ?? [],
            writeSlugs: row.write_slugs ?? [],
            writeScope: (row.write_scope as WriteScope) ?? "ALL",
        };
    }

    return config;
}

/**
 * The set of access tokens a context "holds" from its active-tenure leadership:
 * every position slug plus every position category. Compared against a module's lists.
 */
function heldTokens(ctx: ProfileContext): Set<string> {
    const tokens = new Set<string>();
    for (const l of ctx.leadership ?? []) {
        if (l.slug) tokens.add(l.slug);
        if (l.category) tokens.add(l.category);
    }
    return tokens;
}

function matches(held: Set<string>, allowList: string[]): boolean {
    return allowList.some((token) => held.has(token));
}

/** True if the context may READ the module (admins always pass). */
export function canReadModule(
    ctx: ProfileContext,
    module: ModuleId,
    config: ModuleAccessConfig,
): boolean {
    if (ctx.isAdmin) return true;
    return matches(heldTokens(ctx), config[module].readSlugs);
}

/** True if the context may WRITE the module (admins always pass). */
export function canWriteModule(
    ctx: ProfileContext,
    module: ModuleId,
    config: ModuleAccessConfig,
): boolean {
    if (ctx.isAdmin) return true;
    return matches(heldTokens(ctx), config[module].writeSlugs);
}

/**
 * The modules a context may READ — resolved once (e.g. at login) and carried on the
 * session so the client sidebar never needs the config or the user's slug list.
 */
export function resolveAccessibleModules(
    ctx: ProfileContext,
    config: ModuleAccessConfig,
): ModuleId[] {
    return MODULES.filter((m) => canReadModule(ctx, m, config));
}

/** Convenience: read config + resolve accessible modules in one call. */
export async function getAccessibleModules(ctx: ProfileContext): Promise<ModuleId[]> {
    const config = await getModuleAccessConfig();
    return resolveAccessibleModules(ctx, config);
}

/**
 * Return a copy of the context with `accessibleModules` attached — call this in every
 * server action that hands a ProfileContext to the client (login / session refresh) so
 * the sidebar can gate Tools client-side. No-op-safe on null.
 */
export async function attachAccessibleModules<T extends ProfileContext | null>(
    ctx: T,
): Promise<T> {
    if (!ctx) return ctx;
    const accessibleModules = await getAccessibleModules(ctx);
    return { ...ctx, accessibleModules };
}
