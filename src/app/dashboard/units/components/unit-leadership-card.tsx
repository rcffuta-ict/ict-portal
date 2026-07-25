"use client";

import { useState, useEffect, useCallback } from "react";
import { getUnitLeadershipAction, getUnitPositionsAction } from "../actions";
import {
    Crown,
    Users,
    Loader2,
    Mail,
    Phone,
    User,
    ChevronDown,
    ChevronUp,
} from "lucide-react";

interface LeadershipEntry {
    unitPositionId: string;
    leadershipId: string;
    roleType: "leader" | "assistant";
    positionId: string;
    positionTitle: string;
    profile: {
        id: string;
        first_name: string;
        last_name: string;
        email: string;
        phone_number?: string;
        avatar_url?: string;
    };
}

interface UnitPosition {
    id: string;
    role_type: "leader" | "assistant";
    position: {
        id: string;
        title: string;
        category: string;
    };
}

interface Props {
    unitId: string;
    unitName: string;
    unitType: string;
    tenureId: string;
    compact?: boolean; // For showing in cards vs detailed view
}

export function UnitLeadershipCard({
    unitId,
    unitName,
    unitType,
    tenureId,
    compact = false,
}: Props) {
    const [leadership, setLeadership] = useState<LeadershipEntry[]>([]);
    const [positions, setPositions] = useState<UnitPosition[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(!compact);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [leadershipRes, positionsRes] = await Promise.all([
                getUnitLeadershipAction(unitId, tenureId),
                getUnitPositionsAction(unitId),
            ]);

            if (leadershipRes.success) {
                setLeadership(leadershipRes.data);
            }
            if (positionsRes.success) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setPositions(positionsRes.data as any);
            }
        } catch (error) {
            console.error("Error loading leadership data:", error);
        } finally {
            setLoading(false);
        }
    }, [unitId, tenureId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Get the leader position and entry
    const leaderPosition = positions.find((p) => p.role_type === "leader");
    const leaderEntry = leaderPosition
        ? leadership.find((l) => l.positionId === leaderPosition.position.id)
        : null;

    // Get assistant positions and entries
    const assistantPositions = positions.filter((p) => p.role_type === "assistant");
    const assistantEntries = assistantPositions
        .map((ap) => {
            const entry = leadership.find((l) => l.positionId === ap.position.id);
            return entry ? { ...entry, positionTitle: ap.position.title } : null;
        })
        .filter(Boolean) as LeadershipEntry[];

    // For compact view, just show summary
    if (compact) {
        if (loading) {
            return (
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading...
                </div>
            );
        }

        const hasLeader = !!leaderEntry;
        const assistantCount = assistantEntries.length;

        return (
            <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                {hasLeader ? (
                    <div className="flex items-center gap-1.5 bg-green-50 text-green-700 px-2 py-1 rounded text-xs">
                        <Crown className="h-3 w-3" />
                        <span className="font-medium">
                            {leaderEntry.profile.first_name} {leaderEntry.profile.last_name[0]}.
                        </span>
                    </div>
                ) : leaderPosition ? (
                    <div className="flex items-center gap-1.5 bg-amber-50 text-amber-600 px-2 py-1 rounded text-xs">
                        <Crown className="h-3 w-3" />
                        <span className="font-medium">No leader</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 bg-slate-50 text-slate-400 px-2 py-1 rounded text-xs">
                        <Crown className="h-3 w-3" />
                        <span className="font-medium">No position</span>
                    </div>
                )}

                {assistantCount > 0 && (
                    <div className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs">
                        <Users className="h-3 w-3" />
                        <span className="font-medium">{assistantCount}</span>
                    </div>
                )}

                {expanded ? (
                    <ChevronUp className="h-3 w-3 text-slate-400" />
                ) : (
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                )}
            </div>
        );
    }

    // Full view
    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-rcf-navy" />
            </div>
        );
    }

    if (positions.length === 0) {
        return (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
                <User className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500 text-sm font-medium">No leadership positions</p>
                <p className="text-slate-400 text-xs mt-1">
                    Add leadership positions in the admin section.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-rcf-navy" />
                <h3 className="font-bold text-slate-900">Leadership</h3>
                <span className="text-xs text-slate-500 ml-auto">
                    {unitName} {unitType}
                </span>
            </div>

            {/* Leader Section */}
            {leaderPosition && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2 bg-amber-100 border-b border-amber-200 flex items-center gap-2">
                        <Crown className="h-4 w-4 text-amber-600" />
                        <span className="font-bold text-amber-800 text-sm">Leader</span>
                        <span className="text-xs text-amber-600 ml-auto">
                            {leaderPosition.position.title}
                        </span>
                    </div>
                    <div className="p-4">
                        {leaderEntry ? (
                            <LeadershipEntryRow entry={leaderEntry} variant="leader" />
                        ) : (
                            <EmptySlot />
                        )}
                    </div>
                </div>
            )}

            {/* Assistants Section */}
            {assistantPositions.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2 bg-blue-100 border-b border-blue-200 flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-600" />
                        <span className="font-bold text-blue-800 text-sm">Assistants</span>
                        <span className="text-xs text-blue-600 ml-auto">
                            {assistantEntries.length} / {assistantPositions.length} assigned
                        </span>
                    </div>
                    <div className="p-4 space-y-3">
                        {assistantPositions.map((ap) => {
                            const entry = leadership.find(
                                (l) => l.positionId === ap.position.id
                            );
                            return (
                                <div key={ap.id}>
                                    <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">
                                        {ap.position.title}
                                    </p>
                                    {entry ? (
                                        <LeadershipEntryRow entry={entry} variant="assistant" />
                                    ) : (
                                        <EmptySlot />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper component for displaying a leadership entry
function LeadershipEntryRow({
    entry,
    variant,
}: {
    entry: LeadershipEntry;
    variant: "leader" | "assistant";
}) {
    const bgClass = variant === "leader" ? "bg-white" : "bg-white";
    const textClass = variant === "leader" ? "text-amber-800" : "text-blue-800";
    const subTextClass = variant === "leader" ? "text-amber-600" : "text-blue-600";

    return (
        <div className={`flex items-center gap-3 ${bgClass} rounded-lg p-3 border border-slate-100`}>
            <div
                className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-xs overflow-hidden ${
                    variant === "leader"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-100 text-blue-700"
                }`}
            >
                {entry.profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={entry.profile.avatar_url}
                        className="h-full w-full object-cover"
                        alt=""
                    />
                ) : (
                    `${entry.profile.first_name[0]}${entry.profile.last_name[0]}`
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm ${textClass}`}>
                    {entry.profile.first_name} {entry.profile.last_name}
                </p>
                <div className={`flex items-center gap-3 text-[10px] ${subTextClass}`}>
                    <span className="flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3 shrink-0" />
                        {entry.profile.email}
                    </span>
                    {entry.profile.phone_number && (
                        <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3 shrink-0" />
                            {entry.profile.phone_number}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

// Empty slot placeholder
function EmptySlot() {
    return (
        <div className="flex items-center gap-2 bg-white/50 rounded-lg p-3 border border-dashed border-slate-200 text-slate-400 text-sm">
            <User className="h-4 w-4" />
            <span>No one assigned</span>
        </div>
    );
}
