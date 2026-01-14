"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard,
    UserCircle,
    LogOut,
} from "lucide-react";
import clsx from "clsx";
import { Logo } from "../ui/logo";
import { useProfileStore } from "@/lib/stores/profile.store";

const sidebarItems = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "My Identity", href: "/dashboard/profile", icon: UserCircle },
    // { name: "Attendance", href: "/dashboard/attendance", icon: QrCode },
    // { name: "Academics", href: "/dashboard/academics", icon: BookOpen },
    // { name: "Elections", href: "/dashboard/voting", icon: Vote },
    // { name: "Events", href: "/dashboard/events", icon: CalendarCheck },
    // { name: "Financials", href: "/dashboard/dues", icon: Wallet },
];

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();

    const user = useProfileStore((state) => state.user);

    console.log(user);

    const initials = user
        ? `${user.profile.firstName[0]}${user.profile.lastName[0]}`
        : "??";

    const handleSignOut = () => {
        router.replace("/");
    };

    const handleNavClick = () => {
        // Close mobile menu on navigation
        if (onClose) onClose();
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity md:hidden"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar */}
            <aside
                className={clsx(
                    "fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-gray-200 bg-rcf-navy text-white transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
            {/* 1. Brand / Logo Area */}
            <div className="flex h-16 items-center justify-center gap-3 border-b border-white/10">
                <Logo variant="white" width={50} />
            </div>

            {/* 2. Navigation Items */}
            <div className="flex-1 overflow-y-auto py-6 px-3">
                <nav className="space-y-1">
                    {sidebarItems.map((item) => {
                        const isActive = pathname === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={handleNavClick}
                                className={clsx(
                                    "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-white text-rcf-navy shadow-sm" // Active State
                                        : "text-gray-300 hover:bg-white/10 hover:text-white" // Inactive State
                                )}
                            >
                                <item.icon
                                    className={clsx(
                                        "h-5 w-5 shrink-0 transition-colors",
                                        isActive
                                            ? "text-rcf-navy"
                                            : "text-gray-400 group-hover:text-white"
                                    )}
                                />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* 3. Footer / User Actions */}
            <div className="border-t border-white/10 p-4">
                <div className="flex flex-col gap-1">
                    {/* <button className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white">
                        <Settings className="h-5 w-5 text-gray-400 group-hover:text-white" />
                        Settings
                    </button> */}

                    <button
                        onClick={handleSignOut}
                        className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200"
                    >
                        <LogOut className="h-5 w-5" />
                        Sign Out
                    </button>
                </div>

                {/* Mini Profile Summary */}
                <div className="mt-auto p-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-rcf-navy">
                            {initials}
                        </div>
                        <div>
                            <p className="font-bold text-sm">
                                {user?.profile.firstName}
                            </p>
                            <p className="text-xs text-slate-400">
                                {user?.academics.currentLevel || "Member"}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
        </>
    );
}
