"use client";

import { Shield, Search, LogIn } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import Link from "next/link";
import { LoLogo } from "./LoLogo";
import { LoAppInfoButton } from "./LoAppInfoModal";
import type { AuthUser } from "./LoAppClient";

type ViewTab = "feed" | "admin";
type FeedTab = "questions" | "events";

interface LoAppHeaderProps {
    isAdmin: boolean;
    authenticatedUser: AuthUser | null;
    activeTab: ViewTab;
    setActiveTab: (tab: ViewTab) => void;
    feedTab: FeedTab;
    searchTerm: string;
    setSearchTerm: (v: string) => void;
    searchFocused: boolean;
    setSearchFocused: (v: boolean) => void;
    onOpenInfo: () => void;
}

export function LoAppHeader({
    isAdmin,
    authenticatedUser,
    activeTab,
    setActiveTab,
    feedTab,
    searchTerm,
    setSearchTerm,
    searchFocused,
    setSearchFocused,
    onOpenInfo,
}: LoAppHeaderProps) {
    return (
        <header className="bg-rcf-navy sticky top-0 z-40 shadow-lg">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex items-center justify-between h-14">
                    {/* Left: ICT Logo | Lo! */}
                    <div className="flex items-center gap-3">
                        <Link
                            href="/"
                            className="flex items-center hover:opacity-90 transition-opacity"
                        >
                            <Logo variant="white" width={36} height={36} />
                        </Link>
                        <div className="h-6 w-px bg-white/20" />
                        <Link
                            href="/lo-app"
                            className="flex items-center hover:opacity-90 transition-opacity"
                        >
                            <LoLogo size="md" variant="dark" mode="short" />
                        </Link>
                    </div>

                    {/* Center: Search */}
                    <div
                        className={`relative transition-all duration-200 ${
                            searchFocused ? "w-96" : "w-72"
                        } hidden md:block`}
                    >
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input
                            type="text"
                            placeholder={
                                feedTab === "questions"
                                    ? "Search questions..."
                                    : "Search events..."
                            }
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onFocus={() => setSearchFocused(true)}
                            onBlur={() => setSearchFocused(false)}
                            className="w-full pl-10 pr-4 py-2 rounded-full bg-white/10 border border-white/10 focus:bg-white/15 focus:border-rcf-gold/50 focus:ring-1 focus:ring-rcf-gold/20 outline-none text-sm text-white placeholder:text-white/40 transition-all"
                        />
                    </div>

                    {/* Right: Info + Admin Toggle + User */}
                    <div className="flex items-center gap-2">
                        <LoAppInfoButton onClick={onOpenInfo} variant="compact" />
                        {isAdmin && (
                            <div className="hidden md:flex bg-white/10 p-0.5 rounded-full border border-white/10">
                                <button
                                    onClick={() => setActiveTab("feed")}
                                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                        activeTab === "feed"
                                            ? "bg-rcf-gold text-rcf-navy shadow-sm"
                                            : "text-white/70 hover:text-white"
                                    }`}
                                >
                                    Feed
                                </button>
                                <button
                                    onClick={() => setActiveTab("admin")}
                                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1 ${
                                        activeTab === "admin"
                                            ? "bg-rcf-gold text-rcf-navy shadow-sm"
                                            : "text-white/70 hover:text-white"
                                    }`}
                                >
                                    <Shield className="w-3 h-3" />
                                    Admin
                                </button>
                            </div>
                        )}
                        {authenticatedUser ? (
                            <Link
                                href="/dashboard"
                                className="flex items-center gap-2 group"
                            >
                                <div className="w-8 h-8 rounded-full bg-rcf-gold text-rcf-navy flex items-center justify-center text-[11px] font-extrabold ring-2 ring-rcf-gold/30 group-hover:ring-rcf-gold/60 transition-all">
                                    {authenticatedUser.firstName[0]}
                                    {authenticatedUser.lastName[0]}
                                </div>
                            </Link>
                        ) : (
                            <Link
                                href="/login?returnUrl=/lo-app"
                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rcf-gold text-rcf-navy rounded-full text-xs font-bold hover:bg-rcf-gold/90 transition-colors shadow-sm"
                            >
                                <LogIn className="w-3 h-3" />
                                Sign in
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
