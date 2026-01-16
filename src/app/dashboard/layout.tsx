"use client";

import { useState, useEffect } from "react";
// import { getUserProfile } from "./actions"; // Your Server Action
import { StoreInitializer } from "@/components/dashboard/store-initializer";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
// import { redirect } from "next/navigation";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
