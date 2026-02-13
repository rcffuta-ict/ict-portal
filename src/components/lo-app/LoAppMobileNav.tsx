"use client";

import { MessageSquare, Calendar, Shield } from "lucide-react";

type ViewTab = "feed" | "admin";
type FeedTab = "questions" | "events";

interface LoAppMobileNavProps {
    isAdmin: boolean;
    activeTab: ViewTab;
    setActiveTab: (tab: ViewTab) => void;
    feedTab: FeedTab;
    setFeedTab: (tab: FeedTab) => void;
}

export function LoAppMobileNav({
    isAdmin,
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
                        <Shield className="w-5 h-5" />
                        <span className="text-[10px] font-medium mt-0.5">
                            Admin
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
}
