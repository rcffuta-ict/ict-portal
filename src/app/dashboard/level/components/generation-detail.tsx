/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { Users, KeyRound, History, Lock } from "lucide-react";
import { MembersGrid } from "./members-grid";
import { TokenManager } from "./token-manager";
import { TokenActivity } from "./token-activity";
import { WorkspaceTabs, type WorkspaceTab } from "@/components/dashboard/roster/workspace-tabs";

type TabId = "members" | "tokens" | "activity";

/**
 * A generation's workspace. Members are visible to anyone who can READ the level;
 * Tokens and Activity are coordinator-only, because a token IS a credential — showing it
 * to a read-only viewer would hand them write access to the generation.
 *
 * Tabs (rather than one long page) keep the phone layout to a single scroll per concern;
 * the tab strip scrolls horizontally instead of wrapping on narrow screens.
 */
export function GenerationDetail({
    generation,
    initialMembers,
    initialTotal,
    initialStats,
    initialTokens,
}: {
    generation: any;
    /** Everything the first paint needs, fetched on the server (see the page). */
    initialMembers?: any[];
    initialTotal?: number;
    initialStats?: any;
    initialTokens?: any[];
}) {
    const canWrite = !!generation.canWrite;
    const [tab, setTab] = useState<TabId>("members");

    const tabs: WorkspaceTab<TabId>[] = [
        { id: "members", label: "Members", icon: Users },
        ...(canWrite
            ? ([
                { id: "tokens", label: "Tokens", icon: KeyRound },
                { id: "activity", label: "Activity", icon: History },
            ] as WorkspaceTab<TabId>[])
            : []),
    ];

    return (
        <div className="space-y-5">
            <WorkspaceTabs tabs={tabs} active={tab} onChange={setTab} label="Generation sections" />

            {!canWrite && (
                <p className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                    <Lock className="h-3.5 w-3.5 shrink-0" /> View-only access — only this level&apos;s
                    coordinator can issue tokens or add members.
                </p>
            )}

            {tab === "members" && (
                <MembersGrid
                    classSetId={generation.classSetId}
                    initialMembers={initialMembers}
                    initialTotal={initialTotal}
                    initialStats={initialStats}
                />
            )}
            {tab === "tokens" && canWrite && (
                <TokenManager classSetId={generation.classSetId} initialTokens={initialTokens} />
            )}
            {tab === "activity" && canWrite && <TokenActivity classSetId={generation.classSetId} />}
        </div>
    );
}
