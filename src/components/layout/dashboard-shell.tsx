"use client";

import { useState, useEffect } from "react";
import { useProfileStore } from "@/lib/stores/profile.store";
import { Preloader } from "@/components/ui/preloader";
// import { getUserProfile } from "./actions"; // Your Server Action
import { StoreInitializer } from "@/components/dashboard/store-initializer";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
// import { redirect } from "next/navigation";

/**
 * The dashboard's client frame: session check, sidebar, mobile header.
 *
 * Rendered by src/app/dashboard/layout.tsx, which is a server component so it can
 * put the session's palette into the first paint (see ThemeStyle).
 */
export function DashboardShell({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const { user, userId, authStatus } = useProfileStore();

    // Handle hydration mismatch
    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 0);
        return () => clearTimeout(timer);
    }, []);

    // Lock body scroll when mobile menu is open
    useEffect(() => {
        if (isMobileMenuOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }

        // Cleanup on unmount
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isMobileMenuOpen]);

    // Three states, not two. A finished check that found nobody is not the same as a
    // check still running — showing "Dashboard Loading..." for both is what made an
    // ordinary expired session look like the app had hung.
    if (!mounted || (!user && !userId)) {
        const signedOut = mounted && authStatus === "unauthenticated";

        return (
            <>
                {mounted && <StoreInitializer />}
                <Preloader
                    title={signedOut ? "Signing you out…" : "Dashboard Loading..."}
                    subtitle={
                        signedOut
                            ? "Your session has expired. Taking you to the login page."
                            : "Preparing your workspace"
                    }
                    showUserIcon={true}
                    variant="default"
                />
                {signedOut && (
                    // A way out that does not depend on the redirect working. If the
                    // proxy and this page ever disagree again, the user can still leave.
                    <div className="fixed inset-x-0 bottom-0 flex justify-center p-6 safe-bottom">
                        <a
                            href="/login"
                            className="inline-flex h-11 items-center justify-center rounded-lg bg-rcf-navy px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-rcf-navy-light focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy focus-visible:ring-offset-2"
                        >
                            Go to login
                        </a>
                    </div>
                )}
            </>
        );
    }

    // 1. Fetch Profile on Server
    // const userData = await getUserProfile();

    // if (!userData) {
    //     redirect('/login');
    // }

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            {/* 2. Hydrate Zustand Store (Client Side will now have the data) */}
            <StoreInitializer />

            {/* Sidebar - responsive */}
            <Sidebar
                isOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
            />

            <div className="flex flex-1 flex-col min-h-0">
                <MobileHeader
                    onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    isMenuOpen={isMobileMenuOpen}
                />
                <main className="flex-1 overflow-y-auto p-4 md:p-8 overscroll-contain">
                    <div className="mx-auto max-w-6xl">{children}</div>
                </main>
            </div>
        </div>
    );
}
