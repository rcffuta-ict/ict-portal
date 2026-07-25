"use client";

import {
    MessageSquare,
    Calendar,
    CheckCircle2,
    Clock,
    Eye,
    Hash,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import Link from "next/link";
import type { LoEvent } from "./LoAppClient";

type ViewTab = "feed" | "admin";
type FeedTab = "questions" | "events";

interface LoAppRightSidebarProps {
    events: LoEvent[];
    totalQuestions: number;
    answeredCount: number;
    pendingCount: number;
    setFeedTab: (tab: FeedTab) => void;
    setActiveTab: (tab: ViewTab) => void;
}

export function LoAppRightSidebar({
    events,
    totalQuestions,
    answeredCount,
    pendingCount,
    setFeedTab,
    setActiveTab,
}: LoAppRightSidebarProps) {
    const activeEvents = events.filter((e) => e.is_active);

    return (
        <aside className="hidden xl:block w-[300px] shrink-0 px-5 pt-4 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto">
            {/* Stats Card */}
            <div className="bg-rcf-navy rounded-2xl p-4 mb-4 text-white">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-rcf-gold" />
                    Overview
                </h3>
                <div className="space-y-3">
                    <StatRow
                        icon={<MessageSquare className="w-3.5 h-3.5 text-rcf-gold" />}
                        iconBg="bg-white/10"
                        label="Questions"
                        value={totalQuestions}
                    />
                    <StatRow
                        icon={<CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
                        iconBg="bg-green-500/20"
                        label="Answered"
                        value={answeredCount}
                        valueColor="text-green-400"
                    />
                    <StatRow
                        icon={<Clock className="w-3.5 h-3.5 text-rcf-gold" />}
                        iconBg="bg-rcf-gold/20"
                        label="Pending"
                        value={pendingCount}
                        valueColor="text-rcf-gold"
                    />
                    <StatRow
                        icon={<Calendar className="w-3.5 h-3.5 text-blue-400" />}
                        iconBg="bg-blue-500/20"
                        label="Events"
                        value={events.length}
                        valueColor="text-blue-400"
                    />
                </div>
            </div>

            {/* Active Events */}
            {activeEvents.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
                    <h3 className="text-sm font-bold text-slate-900 mb-3">
                        Active Events
                    </h3>
                    <div className="space-y-2.5">
                        {activeEvents.slice(0, 5).map((event) => (
                            <button
                                key={event.id}
                                onClick={() => {
                                    setFeedTab("events");
                                    setActiveTab("feed");
                                }}
                                className="flex items-center gap-2 group cursor-pointer w-full text-left"
                            >
                                <Hash className="w-3.5 h-3.5 text-rcf-gold shrink-0" />
                                <span className="text-sm text-slate-600 group-hover:text-rcf-navy truncate transition-colors font-medium">
                                    {event.title}
                                </span>
                                <span className="ml-auto w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shrink-0" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="pb-6">
                <div className="flex items-center gap-2 mb-3">
                    <Logo width={24} />
                    <span className="text-xs font-bold text-slate-700">
                        RCFFUTA ICT Team
                    </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
                    Redeemed Christian Fellowship, FUTA Chapter
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                    <Link
                        href="/"
                        className="hover:text-rcf-navy hover:underline transition-colors"
                    >
                        Home
                    </Link>
                    <Link
                        href="/events"
                        className="hover:text-rcf-navy hover:underline transition-colors"
                    >
                        Events
                    </Link>
                    <Link
                        href="/dashboard"
                        className="hover:text-rcf-navy hover:underline transition-colors"
                    >
                        Dashboard
                    </Link>
                </div>
                <p className="text-[10px] text-slate-300 mt-3">
                    Powered by RCFFUTA ICT Team
                </p>
            </div>
        </aside>
    );
}

// ─── Stat Row ───
function StatRow({
    icon,
    iconBg,
    label,
    value,
    valueColor = "text-white",
}: {
    icon: React.ReactNode;
    iconBg: string;
    label: string;
    value: number;
    valueColor?: string;
}) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div
                    className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center`}
                >
                    {icon}
                </div>
                <span className="text-sm text-white/80">{label}</span>
            </div>
            <span className={`text-sm font-bold ${valueColor}`}>{value}</span>
        </div>
    );
}
