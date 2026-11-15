"use client";

import { MessageSquare, Calendar, HandHeart, Shield } from "lucide-react";

type ViewTab = "feed" | "admin";
type FeedTab = "questions" | "testimonies" | "events";

interface LoAppMobileNavProps {
    isAdmin: boolean;
    /** Testimonies awaiting review — a dot of urgency on the Admin tab. */
    reviewCount?: number;
    activeTab: ViewTab;
    setActiveTab: (tab: ViewTab) => void;
    feedTab: FeedTab;
    setFeedTab: (tab: FeedTab) => void;
}

export function LoAppMobileNav({
    isAdmin,
    reviewCount = 0,
    activeTab,
    setActiveTab,
    feedTab,
    setFeedTab,
}: LoAppMobileNavProps) {
    return (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-rcf-navy z-40 safe-area-pb border-t border-white/10">
            <div className="flex">
                <button
                    onClick={() => {
                        setActiveTab("feed");
                        setFeedTab("testimonies");
                    }}
                    className={`flex-1 flex flex-col items-center py-2.5 transition-colors ${
                        feedTab === "testimonies" && activeTab === "feed"
                            ? "text-rcf-gold"
                            : "text-white/40"
                    }`}
                >
                    <HandHeart className="w-5 h-5" />
                    <span className="text-[10px] font-medium mt-0.5">
                        Testimonies
                    </span>
                </button>
                <button
                    onClick={() => {
                        setActiveTab("feed");
                        setFeedTab("questions");
                    }}
                    className={`flex-1 flex flex-col items-center py-2.5 transition-colors ${
                        feedTab === "questions" && activeTab === "feed"
                            ? "text-rcf-gold"
                            : "text-white/40"
                    }`}
                >
                    <MessageSquare className="w-5 h-5" />
                    <span className="text-[10px] font-medium mt-0.5">
                        Questions
                    </span>
                </button>
                <button
                    onClick={() => {
                        setActiveTab("feed");
                        setFeedTab("events");
                    }}
                    className={`flex-1 flex flex-col items-center py-2.5 transition-colors ${
                        feedTab === "events" && activeTab === "feed"
                            ? "text-rcf-gold"
                            : "text-white/40"
                    }`}
                >
                    <Calendar className="w-5 h-5" />
                    <span className="text-[10px] font-medium mt-0.5">
                        Events
                    </span>
                </button>
                {isAdmin && (
                    <button
                        onClick={() => setActiveTab("admin")}
                        className={`flex-1 flex flex-col items-center py-2.5 transition-colors ${
                            activeTab === "admin"
                                ? "text-rcf-gold"
                                : "text-white/40"
                        }`}
                    >
                        <span className="relative">
                            <Shield className="w-5 h-5" />
                            {reviewCount > 0 && (
                                <span className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[9px] font-bold leading-4 text-white">
                                    {reviewCount > 99 ? "99+" : reviewCount}
                                </span>
                            )}
                        </span>
                        <span className="text-[10px] font-medium mt-0.5">
                            Admin
                            {reviewCount > 0 && <span className="sr-only">, {reviewCount} testimonies awaiting review</span>}
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
}
