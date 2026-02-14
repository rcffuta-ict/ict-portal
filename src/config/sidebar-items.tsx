import {
    LayoutDashboard,
    UserCircle,
    LocationEditIcon,
    Crown,
    SquaresUnite,
    Heart,
    Calendar,
    MessageCircle
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FullUserProfile, LeadershipRole } from "@rcffuta/ict-lib";

export interface SidebarItem {
    name: string;
    href: string;
    icon: LucideIcon;
    color?: string; // For dashboard cards
    description?: string; // For dashboard cards
    comingSoon?: boolean;
    adminOnly?: boolean;
    section?: string; // Section grouping for sidebar
}

// Base sidebar items available to all users
export const baseSidebarItems: SidebarItem[] = [
    {
        name: "Overview",
        href: "/dashboard",
        icon: LayoutDashboard,
        color: "bg-slate-500",
        description: "Your dashboard overview",
    },
    {
        name: "My Identity",
        href: "/dashboard/profile",
        icon: UserCircle,
        color: "bg-blue-500",
        description: "Manage bio-data, academic info & ID Card.",
    },
    {
        name: "Events",
        href: "/events",
        icon: Calendar,
        color: "bg-purple-500",
        description: "View all upcoming and past events.",
    },
    {
        name: "Lo! App",
        href: "/lo-app",
        icon: MessageCircle,
        color: "bg-pink-600",
        description: "Ask questions, star interesting topics & join the discussion.",
    },
];

// Event items
export const eventSidebarItems: SidebarItem[] = [
    {
        name: "Singles Weekend",
        href: "/events/singles-weekend-26",
        icon: Heart,
        color: "bg-pink-500",
        description: "Register for Agape '26 - Feb 14-15, 2026.",
        section: "Events",
    },
];

// Specific manager items
export const tenureManagerItem: SidebarItem = {
    name: "Tenure Manager",
    href: "/dashboard/tenure",
    icon: Crown,
    color: "bg-rcf-navy",
    description: "Manage tenure configuration, structure, and appointments.",
    adminOnly: true,
};

export const zoneManagerItem: SidebarItem = {
    name: "Zone Manager",
    href: "/dashboard/zones",
    icon: LocationEditIcon,
    color: "bg-rcf-navy",
    description: "Manage tenure zones, pastors and members",
};

export const workforceManagerItem: SidebarItem = {
    name: "Workforce Manager",
    href: "/dashboard/units",
    icon: SquaresUnite,
    color: "bg-rcf-navy",
    description: "Manage Unit/Team members",
};

// Legacy admin items export for backward compatibility if needed,
// but we should rely on getSidebarItems logic.
export const adminSidebarItems: SidebarItem[] = [
    tenureManagerItem,
    zoneManagerItem,
    workforceManagerItem
];

/**
 * Check if user has specific leadership scope
 */
function hasLeadershipScope(user: FullUserProfile | null, scopes: LeadershipRole['scope'][]): boolean {
    if (!user || !user.roles) return false;
    return user.roles.some(role => scopes.includes(role.scope));
}

/**
 * Get sidebar items filtered by user access rights
 * @param user - The user's full profile. If null, only base items are returned.
 * @param isAdminOverride - Optional boolean to force admin status (e.g. from email check)
 * @returns Filtered sidebar items
 */
export function getSidebarItems(user: FullUserProfile | null | boolean, isAdminOverride?: boolean): SidebarItem[] {
    const items = [...baseSidebarItems];

    // Add event items
    items.push(...eventSidebarItems);

    // Determines admin status
    // Support legacy boolean call signature: getSidebarItems(isAdmin: boolean)
    let isAdmin = false;
    let currentUser: FullUserProfile | null = null;

    if (typeof user === 'boolean') {
        isAdmin = user;
    } else {
        currentUser = user;
        // If override is provided, use it, otherwise check email if user exists
        isAdmin = isAdminOverride ?? (currentUser ? isUserAdmin(currentUser.profile.email) : false);
    }

    // 1. Tenure Manager - Admins Only
    if (isAdmin) {
        items.push(tenureManagerItem);
    }

    // 2. Zone Manager - Admins OR Leadership Scope = ZONE
    // "ensure that both admins ... and anyone in a leadership position with scope that is ZONE can access Zone manager"
    const hasZoneAccess = isAdmin || hasLeadershipScope(currentUser, ['ZONE']);
    if (hasZoneAccess && !items.includes(zoneManagerItem)) {
         // Check strictly if isAdmin already added it? No, separated logic above.
         // Actually, if we just push based on conditions, we might duplicate if logic overlaps,
         // but here conditions are:
         // Tenure: Admin
         // Zone: Admin OR ZoneScope
         // Workforce: Admin OR UnitScope
         // So if Admin, we add Tenure.
         // Then if Admin (true), we add Zone.
         // Then if Admin (true), we add Workforce.
         // So Admin gets all 3.
         // Non-admin ZoneScope gets Zone.
         // Non-admin UnitScope gets Workforce.

         // Wait, if isAdmin is true, we should add them if they are not already added.
         // But I am not adding them in a block.
         // logic:
         // if (isAdmin) push(tenure)
         // if (isAdmin || scopeZone) push(zone)
         // if (isAdmin || scopeUnit) push(workforce)

         // This works fine.
        items.push(zoneManagerItem);
    }

    // 3. Workforce Manager - Admins OR Leadership Scope = UNIT or TEAM
    const hasWorkforceAccess = isAdmin || hasLeadershipScope(currentUser, ['UNIT', 'TEAM']);
    if (hasWorkforceAccess && !items.includes(workforceManagerItem)) {
        items.push(workforceManagerItem);
    }

    // De-duplicate just in case (though logic above should prevent it if items are unique obj references)
    // Actually items.includes works by reference.
    // If I add separate consts, it works.

    return items;
}

/**
 * Get event sidebar items separately (for dashboard events section)
 */
export function getEventSidebarItems(): SidebarItem[] {
    return [...eventSidebarItems];
}

/**
 * Check if user email is in admin list
 * @param userEmail - User's email address
 * @returns Whether user is an admin
 */
export function isUserAdmin(userEmail: string | null | undefined): boolean {
    if (!userEmail) return false;

    const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS || "";
    const allowedEmails = adminEmails.split(",").map(e => e.trim().toLowerCase());

    return allowedEmails.includes(userEmail.toLowerCase());
}
