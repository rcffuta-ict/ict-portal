/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { Users, KeyRound, History, Lock } from "lucide-react";
import { MembersGrid } from "./members-grid";
import { TokenManager } from "./token-manager";
import { TokenActivity } from "./token-activity";

type TabId = "members" | "tokens" | "activity";

/**
 * A generation's workspace. Members are visible to anyone who can READ the level;
 * Tokens and Activity are coordinator-only, because a token IS a credential — showing it
 * to a read-only viewer would hand them write access to the generation.
 *
 * Tabs (rather than one long page) keep the phone layout to a single scroll per concern;
 * the tab strip scrolls horizontally instead of wrapping on narrow screens.
 */
export function GenerationDetail({ generation }: { generation: any }) {
    const canWrite = !!generation.canWrite;
    const [tab, setTab] = useState<TabId>("members");

    const tabs: { id: TabId; label: string; icon: any }[] = [
        { id: "members", label: "Members", icon: Users },
        ...(canWrite
            ? ([
                { id: "tokens", label: "Tokens", icon: KeyRound },
                { id: "activity", label: "Activity", icon: History },
            ] as { id: TabId; label: string; icon: any }[])
            : []),
    ];

    return (
        <div className="space-y-5">
            {tabs.length > 1 && (
                <div
                    role="tablist"
                    aria-label="Generation sections"
                    className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
                >
                    {tabs.map((t) => {
                        const on = tab === t.id;
                        return (
                            <button
                                key={t.id}
                                role="tab"
                                aria-selected={on}
                                onClick={() => setTab(t.id)}
                                className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rcf-navy ${
                                    on
                                        ? "bg-rcf-navy text-white shadow-sm"
                                        : "border border-slate-200 bg-white text-slate-600 hover:text-rcf-navy"
                                }`}
                            >
                                <t.icon className="h-4 w-4" />
                                {t.label}
                            </button>
                        );
                    })}
                </div>
            )}

            {!canWrite && (
                <p className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                    <Lock className="h-3.5 w-3.5 shrink-0" /> View-only access — only this level&apos;s
                    coordinator can issue tokens or add members.
                </p>
            )}

            {tab === "members" && <MembersGrid classSetId={generation.classSetId} />}
            {tab === "tokens" && canWrite && <TokenManager classSetId={generation.classSetId} />}
            {tab === "activity" && canWrite && <TokenActivity classSetId={generation.classSetId} />}
        </div>
    );
}
