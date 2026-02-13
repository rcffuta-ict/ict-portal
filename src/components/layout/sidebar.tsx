"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import clsx from "clsx";
import { Logo } from "../ui/logo";
import { useProfileStore } from "@/lib/stores/profile.store";
import { useMemo } from "react";
import { isUserAdmin, eventSidebarItems, baseSidebarItems, adminSidebarItems } from "@/config/sidebar-items";

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();

    const user = useProfileStore((state) => state.user);
    const clearUser = useProfileStore((state) => state.clearUser);

    // Check if user is an admin
    const isAdmin = useMemo(() => {
        return isUserAdmin(user?.profile?.email);
    }, [user?.profile?.email]);

    // Get sidebar items based on admin status
    const sidebarItems = useMemo(() => {
        const items = [...baseSidebarItems];
        if (isAdmin) {
            items.push(...adminSidebarItems);
        }
        return items;
    }, [isAdmin]);

    const initials = user
        ? `${user.profile.firstName[0]}${user.profile.lastName[0]}`
        : "??";

    const handleSignOut = async () => {
        // 1. Clear Zustand store (removes from localStorage too)
        clearUser();

        // 2. Call logout server action to clear cookies
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout error:', error);
        }

        // 3. Redirect to home/login
        router.replace("/login");
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
                    "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-rcf-navy text-white transition-transform duration-300 ease-in-out",
                    "md:relative md:translate-x-0",
                    "safe-top safe-bottom", // Safe area padding for mobile devices
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
                style={{
                    // Use dynamic viewport height for better mobile support
                    height: '100vh',
                    maxHeight: '-webkit-fill-available',
                }}
            >
            {/* 1. Brand / Logo Area */}
            <div className="flex h-16 shrink-0 items-center justify-center gap-3 border-b border-white/10 safe-left">
                <Logo variant="white" width={50} />
            </div>

            {/* 2. Navigation Items */}
            <div className="flex-1 overflow-y-auto py-6 px-3 overscroll-contain safe-left safe-right">
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

                {/* Events Section */}
                {eventSidebarItems.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-white/10">
                        <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                            Events
                        </p>
                        <nav className="space-y-1">
                            {eventSidebarItems.map((item) => {
                                const isActive = pathname === item.href;

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={handleNavClick}
                                        className={clsx(
                                            "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                            isActive
                                                ? "bg-white text-rcf-navy shadow-sm"
                                                : "text-gray-300 hover:bg-white/10 hover:text-white"
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
                )}
            </div>

            {/* 3. Footer / User Actions */}
            <div className="shrink-0 border-t border-white/10 p-4 pb-safe safe-left safe-right safe-bottom">
                {/* Sign Out Button */}
                <div className="mb-3">
                    <button
                        onClick={handleSignOut}
                        className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200"
                    >
                        <LogOut className="h-5 w-5" />
                        Sign Out
                    </button>
                </div>

                {/* Mini Profile Summary */}
                <div className="rounded-lg bg-white/5 p-3">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 rounded-full bg-blue-100 flex items-center justify-center font-bold text-rcf-navy text-sm">
                            {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="font-bold text-sm truncate">
                                {user?.profile.firstName}
                            </p>
                            <p className="text-xs text-slate-400 truncate">
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
