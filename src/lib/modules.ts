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

/** Category tokens recognised in read/write lists (mirror of PositionCategory). */
export const CATEGORY_TOKENS = [
    "PRESIDENT",
    "CENTRAL",
    "UNIT",
    "TEAM",
    "LEVEL",
    "ZONE",
] as const;

export type CategoryToken = (typeof CATEGORY_TOKENS)[number];

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
