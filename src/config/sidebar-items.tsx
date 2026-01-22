import {
    LayoutDashboard,
    UserCircle,
    LocationEditIcon,
    Crown,
    SquaresUnite
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface SidebarItem {
    name: string;
    href: string;
    icon: LucideIcon;
    color?: string; // For dashboard cards
    description?: string; // For dashboard cards
    comingSoon?: boolean;
    adminOnly?: boolean;
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
    // {
    //     name: "Attendance",
    //     href: "/dashboard/attendance",
    //     icon: QrCode,
    //     color: "bg-purple-500",
    //     description: "Scan QR codes for Service & Unit meetings.",
    //     comingSoon: true,
    // },
    // {
    //     name: "Academics",
    //     href: "/dashboard/academics",
    //     icon: BookOpen,
    //     color: "bg-emerald-500",
    //     description: "CGPA Calculator & Past Questions.",
    //     comingSoon: true,
    // },
    // {
    //     name: "Elections",
    //     href: "/dashboard/voting",
    //     icon: Vote,
    //     color: "bg-orange-500",
    //     description: "Vote for FYB and Executive roles.",
    //     comingSoon: true,
    // },
    // {
    //     name: "Events",
    //     href: "/dashboard/events",
    //     icon: CalendarCheck,
    //     color: "bg-indigo-500",
    //     description: "Register for conferences and retreats.",
    //     comingSoon: true,
    // },
    // {
    //     name: "Financials",
    //     href: "/dashboard/dues",
    //     icon: Wallet,
    //     color: "bg-pink-500",
    //     description: "Pay offering, dues, and pledges.",
    //     comingSoon: true,
    // },
];

// Admin-only items
export const adminSidebarItems: SidebarItem[] = [
    {
        name: "Tenure Manager",
        href: "/dashboard/tenure",
        icon: Crown,
        color: "bg-rcf-navy",
        description:
            "Manage tenure configuration, structure, and appointments.",
        adminOnly: true,
    },
    {
        name: "Zone Manager",
        href: "/dashboard/zones",
        icon: LocationEditIcon,
        color: "bg-rcf-navy",
        description: "Manage tenure zones, pastors and members",
        adminOnly: true,
    },
    {
        name: "Workforce Manager",
        href: "/dashboard/units",
        icon: SquaresUnite,
        color: "bg-rcf-navy",
        description: "Manage Unit/Team members",
        adminOnly: true,
    },
];

/**
 * Get sidebar items filtered by admin status
 * @param isAdmin - Whether the user is an admin
 * @returns Filtered sidebar items
 */
export function getSidebarItems(isAdmin: boolean): SidebarItem[] {
    const items = [...baseSidebarItems];
    
    if (isAdmin) {
        items.push(...adminSidebarItems);
    }
    
    return items;
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
