import {
    LayoutDashboard,
    UserCircle,
    LocationEditIcon,
    Crown,
    SquaresUnite,
    Heart,
    Calendar,
    GraduationCap,
    Settings,
} from "lucide-react";
import type { FullUserProfile } from "@rcffuta/ict-lib";
import type { ModuleId } from "@/lib/modules";
import { isProfileAdmin } from "@/lib/auth-roles";
import { LoLogo } from "@/components/lo-app/LoLogo";
import type { ElementType } from "react";

/**
 * The sidebar is segmented into four sections:
 *   - personal / events / apps  → visible to everyone
 *   - tools                     → per-module, gated by `module_access` read config
 *                                 (resolved server-side into `accessibleModules`).
 * Settings is a Tools item visible only to the ICT Coordinator.
 */
export type SidebarSection = "personal" | "events" | "apps" | "tools";

export const SECTION_ORDER: SidebarSection[] = [
    "personal",
    "events",
    "apps",
    "tools",
];

export const SECTION_LABELS: Record<SidebarSection, string> = {
    personal: "Personal",
    events: "Events",
    apps: "Apps",
    tools: "Tools",
};

export interface SidebarItem {
    name: string;
    href: string;
    /** A Lucide icon or any small component rendered as `<item.icon className=… />`. */
    icon: ElementType;
    section: SidebarSection;
    color?: string; // For dashboard cards
    description?: string; // For dashboard cards
    comingSoon?: boolean;
    /** Tools item: read-gated by this module's `module_access` config. */
    module?: ModuleId;
    /** Tools item: visible only to those who can see Settings (System Admin / President). */
    ictOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Item definitions, by section
// ---------------------------------------------------------------------------

const personalItems: SidebarItem[] = [
    {
        name: "Overview",
        href: "/dashboard",
        icon: LayoutDashboard,
        section: "personal",
        color: "bg-slate-500",
        description: "Your dashboard overview",
    },
    {
        name: "My Identity",
        href: "/dashboard/profile",
        icon: UserCircle,
        section: "personal",
        color: "bg-blue-500",
        description: "Manage bio-data, academic info & ID Card.",
    },
];

const eventItems: SidebarItem[] = [
    {
        name: "All Events",
        href: "/events",
        icon: Calendar,
        section: "events",
        color: "bg-purple-500",
        description: "View all upcoming and past events.",
    },
    {
        name: "Singles Weekend",
        href: "/events/singles-weekend-26",
        icon: Heart,
        section: "events",
        color: "bg-pink-500",
        description: "Register for Agape '26 - Feb 14-15, 2026.",
    },
];

const appItems: SidebarItem[] = [
    {
        name: "Lo! App",
        href: "/lo-app",
        icon: () => <LoLogo size="sm" />,
        section: "apps",
        color: "bg-pink-600",
        description: "Ask questions, star topics & join the discussion.",
    },
];

// Tools — each maps to a module gated by `module_access`, except Settings (ICT only).
const toolItems: SidebarItem[] = [
    {
        name: "Tenure",
        href: "/dashboard/tenure",
        icon: Crown,
        section: "tools",
        module: "tenure",
        color: "bg-rcf-navy",
        description: "Session profile, workforce, cabinet & generations.",
    },
    {
        name: "Zones",
        href: "/dashboard/zones",
        icon: LocationEditIcon,
        section: "tools",
        module: "zones",
        comingSoon: true,
        color: "bg-rcf-navy",
        description: "Manage residential zones, coordinators and members.",
    },
    {
        name: "Workforce",
        href: "/dashboard/units",
        icon: SquaresUnite,
        section: "tools",
        module: "workforce",
        comingSoon: true,
        color: "bg-rcf-navy",
        description: "Manage unit / team members.",
    },
    {
        name: "Levels",
        href: "/dashboard/level",
        icon: GraduationCap,
        section: "tools",
        module: "level",
        color: "bg-rcf-navy",
        description: "Manage the members of your level.",
    },
    {
        name: "Settings",
        href: "/dashboard/settings",
        icon: Settings,
        section: "tools",
        ictOnly: true,
        color: "bg-rcf-navy",
        description: "Configure module access and app-wide settings.",
    },
];

// Kept for the dashboard's "Upcoming Events" card grid (actual events, not the index).
export const eventSidebarItems: SidebarItem[] = eventItems.filter(
    (i) => i.href !== "/events",
);

/**
 * Whether the user may SEE the Settings item: the System Admin (manages it) or the
 * President (sees everything, read-only). Prefers the enriched context flags
 * (`isSysAdmin` / `isPresident`) the runtime session carries, and falls back to the
 * `ict-coord` slug / PRESIDENT role for the plain stored profile. Visibility only —
 * the real guards are server-side (`requireSysAdmin` / `requirePresidentOrSysAdmin`).
 */
export function canSeeSettings(user: FullUserProfile | null | undefined): boolean {
    if (!user) return false;
    const ctx = user as unknown as {
        isSysAdmin?: boolean;
        isPresident?: boolean;
        leadership?: { slug?: string | null }[];
    };
    if (ctx.isSysAdmin || ctx.isPresident) return true;
    if (ctx.leadership?.some((l) => l.slug === "ict-coord")) return true;
    return (user.roles ?? []).some(
        (r) => r.title === "ICT Coordinator" || r.scope === "PRESIDENT",
    );
}

/** @deprecated Use {@link canSeeSettings}. Kept for any external importers. */
export const isIctCoordinator = canSeeSettings;

/**
 * Flat, tagged list of sidebar items visible to this user.
 * @param user               the stored profile (enriched ProfileContext at runtime)
 * @param accessibleModules  modules the user may read, resolved server-side
 */
export function getSidebarItems(
    user: FullUserProfile | null,
    accessibleModules: string[] = [],
): SidebarItem[] {
    const items: SidebarItem[] = [
        ...personalItems,
        ...eventItems,
        ...appItems,
    ];

    for (const tool of toolItems) {
        if (tool.ictOnly) {
            if (canSeeSettings(user)) items.push(tool);
            continue;
        }
        if (tool.module && accessibleModules.includes(tool.module)) {
            items.push(tool);
        }
    }

    return items;
}

/** The same items grouped by section (empty sections omitted), for grouped rendering. */
export function getSidebarSections(
    user: FullUserProfile | null,
    accessibleModules: string[] = [],
): { section: SidebarSection; label: string; items: SidebarItem[] }[] {
    const items = getSidebarItems(user, accessibleModules);
    return SECTION_ORDER.map((section) => ({
        section,
        label: SECTION_LABELS[section],
        items: items.filter((i) => i.section === section),
    })).filter((group) => group.items.length > 0);
}

// Admin detection lives in `@/lib/auth-roles` (`isProfileAdmin`), derived from
// leadership positions. Re-exported for components that imported it from here.
export { isProfileAdmin };
