"use client";

import {
    MessageSquare,
    Calendar,
    Home,
    Settings,
    Shield,
    LogIn,
} from "lucide-react";
import Link from "next/link";
import type { AuthUser } from "./LoAppClient";

import { LoAppInfoButton } from "./LoAppInfoModal";

type ViewTab = "feed" | "admin";
type FeedTab = "questions" | "events";

interface LoAppSidebarProps {
    isAdmin: boolean;
    authenticatedUser: AuthUser | null;
    activeTab: ViewTab;
    setActiveTab: (tab: ViewTab) => void;
    feedTab: FeedTab;
    setFeedTab: (tab: FeedTab) => void;
    pendingCount: number;
    activeEventsCount: number;
    onOpenInfo: () => void;
}

export function LoAppSidebar({
    isAdmin,
    authenticatedUser,
    activeTab,
    setActiveTab,
    feedTab,
    setFeedTab,
    pendingCount,
    activeEventsCount,
    onOpenInfo,
}: LoAppSidebarProps) {
    return (
        <aside className="hidden lg:flex flex-col w-64 shrink-0 px-3 pt-4 sticky top-14 h-[calc(100vh-56px)] justify-between">
            <div>
                {/* Primary Nav */}
                <nav className="space-y-0.5 mb-5">
                    <button
                        onClick={() => {
                            setActiveTab("feed");
                            setFeedTab("questions");
                        }}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl w-full text-left transition-all group ${
                            feedTab === "questions" && activeTab === "feed"
                                ? "bg-rcf-navy text-white shadow-md"
                                : "text-slate-700 hover:bg-slate-100"
                        }`}
                    >
                        <MessageSquare
                            className={`w-5 h-5 ${
                                feedTab === "questions" && activeTab === "feed"
                                    ? "text-rcf-gold"
                                    : "text-slate-400 group-hover:text-rcf-navy"
                            }`}
                        />
                        <span className="text-sm font-semibold">Questions</span>
                        {pendingCount > 0 && (
                            <span
                                className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                    feedTab === "questions" && activeTab === "feed"
                                        ? "bg-rcf-gold/20 text-rcf-gold"
                                        : "bg-rcf-navy/10 text-rcf-navy"
                                }`}
                            >
                                {pendingCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab("feed");
                            setFeedTab("events");
                        }}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl w-full text-left transition-all group ${
                            feedTab === "events" && activeTab === "feed"
                                ? "bg-rcf-navy text-white shadow-md"
                                : "text-slate-700 hover:bg-slate-100"
                        }`}
                    >
                        <Calendar
                            className={`w-5 h-5 ${
                                feedTab === "events" && activeTab === "feed"
                                    ? "text-rcf-gold"
                                    : "text-slate-400 group-hover:text-rcf-navy"
                            }`}
                        />
                        <span className="text-sm font-semibold">Events</span>
                        {activeEventsCount > 0 && (
                            <span
                                className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                    feedTab === "events" && activeTab === "feed"
                                        ? "bg-green-400/20 text-green-300"
                                        : "bg-green-100 text-green-700"
                                }`}
                            >
                                {activeEventsCount} live
                            </span>
                        )}
                    </button>
                </nav>

                <div className="h-px bg-slate-200 mx-3 mb-4" />

                {/* Secondary Nav */}
                <nav className="space-y-0.5">
                    <Link
                        href="/"
                        className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors group"
                    >
                        <Home className="w-5 h-5 text-slate-400 group-hover:text-rcf-navy" />
                        <span className="text-sm font-medium">Portal Home</span>
                    </Link>
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors group"
                    >
                        <Settings className="w-5 h-5 text-slate-400 group-hover:text-rcf-navy" />
                        <span className="text-sm font-medium">Dashboard</span>
                    </Link>
                    <LoAppInfoButton onClick={onOpenInfo} />
                </nav>
            </div>

            {/* User Card */}
            <div className="mb-4">
                {authenticatedUser ? (
                    <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-rcf-navy text-rcf-gold flex items-center justify-center text-xs font-bold">
                                {authenticatedUser.firstName[0]}
                                {authenticatedUser.lastName[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-900 truncate">
                                    {authenticatedUser.firstName}{" "}
                                    {authenticatedUser.lastName}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate">
                                    {authenticatedUser.email}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center  text-[10px] font-bold text-rcf-navy uppercase tracking-wider mt-2 ml-2">
                            {authenticatedUser.level}
                        {isAdmin && (
                            <>
                            <span className="mx-1">•</span>
                                <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-rcf-navy/5 rounded-lg">
                                    <Shield className="w-3 h-3 text-rcf-navy" />
                                    <span className="text-[10px] font-bold text-rcf-navy uppercase tracking-wider">
                                        Admin
                                    </span>
                                </div>
                            </>
                        )}
                        </div>
                    </div>
                ) : (
                    <Link
                        href="/login?returnUrl=/lo-app"
                        className="block p-4 rounded-2xl bg-rcf-navy text-center hover:bg-rcf-navy-light transition-colors"
                    >
                        <LogIn className="w-5 h-5 text-rcf-gold mx-auto mb-2" />
                        <p className="text-sm font-semibold text-white">
                            Sign in
                        </p>
                        <p className="text-[11px] text-white/50 mt-0.5">
                            Star questions &amp; save your name
                        </p>
                    </Link>
                )}
            </div>
        </aside>
    );
}
