/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { Users, KeyRound, Lock, BookOpen, Cake } from "lucide-react";
import { MembersGrid } from "./members-grid";
import { TokenManager } from "./token-manager";
import { WorkspaceTabs, type WorkspaceTab } from "@/components/dashboard/roster/workspace-tabs";
import { GroupAcademics } from "@/components/academics/group-academics";
import { BirthdaysPanel } from "@/components/dashboard/birthdays-panel";
import { exportLevelAcademicRecordsAction, getLevelAcademicsAction, getLevelBirthdaysAction } from "../actions";

type TabId = "members" | "birthdays" | "academics" | "tokens";

/**
 * A generation's workspace. Members, Birthdays and Academics are visible to anyone who
 * can READ the level; Tokens is coordinator-only, because a token IS a credential —
 * showing it to a read-only viewer would hand them write access to the generation.
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
        { id: "birthdays", label: "Birthdays", icon: Cake },
        // Totals for anyone who can read the level; names only as academic_settings
        // allows (decided by getLevelAcademicsAction).
        { id: "academics", label: "Academics", icon: BookOpen },
        ...(canWrite
            ? ([{ id: "tokens", label: "Tokens", icon: KeyRound }] as WorkspaceTab<TabId>[])
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
            {tab === "birthdays" && (
                <BirthdaysPanel
                    groupId={generation.classSetId}
                    groupName={generation.familyName || generation.level || "generation"}
                    load={(month, year) => getLevelBirthdaysAction(generation.classSetId, month, year)}
                    memberHref={(profileId) => `/dashboard/level/${generation.classSetId}/member/${profileId}`}
                />
            )}
            {tab === "academics" && (
                <GroupAcademics
                    groupName={generation.familyName || generation.level || "generation"}
                    load={(session, semester) => getLevelAcademicsAction(generation.classSetId, session, semester)}
                    exportRecords={() => exportLevelAcademicRecordsAction(generation.classSetId)}
                />
            )}
            {tab === "tokens" && canWrite && (
                <TokenManager classSetId={generation.classSetId} initialTokens={initialTokens} />
            )}
        </div>
    );
}
