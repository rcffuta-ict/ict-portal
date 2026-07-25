/**
 * Client-safe module primitives — constants and types shared by both the server-side
 * access resolver (src/lib/module-access.ts, which pulls in the service-role client)
 * and client components (the sidebar, the ICT Settings editor). Keep this file free of
 * any server-only imports so it can be bundled for the browser.
 */

export const MODULES = ["tenure", "zones", "workforce", "level"] as const;
export type ModuleId = (typeof MODULES)[number];

export type WriteScope = "ALL" | "OWN";

export interface ModuleAccessRow {
    module: ModuleId;
    readSlugs: string[];
    writeSlugs: string[];
    writeScope: WriteScope;
}

export type ModuleAccessConfig = Record<ModuleId, ModuleAccessRow>;

// ---------------------------------------------------------------------------
// Privilege tags (the access model — see db/migrations/0006_privilege_tags.sql)
// ---------------------------------------------------------------------------
// Access is granted by PRIVILEGE TAG (optionally scoped), assigned to a leadership
// position. EXCO scope = a unit/team slug; LEVEL scope = a level token; both un-scoped
// mean "all". PRESIDENT/SYSADMIN are supreme/bypass tags, never listed in module config.

/** Every privilege tag a position can hold. */
export const PRIVILEGE_TAGS = [
    "EXCO",
    "ZONE",
    "LEVEL",
    "CENTRAL",
    "PRESIDENT",
    "SYSADMIN",
] as const;

export type PrivilegeTag = (typeof PRIVILEGE_TAGS)[number];

/** A single privilege held by a position: a tag plus an optional scope (null = all). */
export interface Privilege {
    tag: PrivilegeTag;
    scope: string | null;
}

/**
 * The tags that may appear in a module's read/write config (managed in Settings by
 * the System Admin). PRESIDENT/SYSADMIN are bypass-only and never configured here.
 */
export const CONFIGURABLE_PRIVILEGE_TOKENS = [
    "CENTRAL",
    "EXCO",
    "ZONE",
    "LEVEL",
] as const;

/** The valid LEVEL scope tokens (a level token resolves to the current generation there). */
export const LEVEL_SCOPE_TOKENS = ["100", "200", "300", "400", "500", "pds-uabs"] as const;
export type LevelScopeToken = (typeof LEVEL_SCOPE_TOKENS)[number];

/**
 * @deprecated Legacy name kept so the Settings editor keeps compiling this phase.
 * The vocabulary is now the configurable privilege tags; the scope-aware editor
 * redesign is a later phase.
 */
export const CATEGORY_TOKENS = CONFIGURABLE_PRIVILEGE_TOKENS;
export type CategoryToken = (typeof CONFIGURABLE_PRIVILEGE_TOKENS)[number];

/** Human labels + descriptions for the modules (used in the Settings UI). */
export const MODULE_META: Record<ModuleId, { label: string; description: string }> = {
    tenure: {
        label: "Tenure",
        description: "Session profile, workforce, cabinet and generations.",
    },
    zones: {
        label: "Zones",
        description: "Residential zones, coordinators and members.",
    },
    workforce: {
        label: "Workforce",
        description: "Unit / team membership and coordinators.",
    },
    level: {
        label: "Levels",
        description: "Level (generation) members and invite links.",
    },
};
