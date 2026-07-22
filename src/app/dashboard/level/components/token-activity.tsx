/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import {
    KeyRound,
    Ban,
    UserPlus,
    PencilLine,
    Loader2,
    AlertCircle,
    History,
} from "lucide-react";
import { getLevelTokenActivityAction } from "../actions";

/**
 * What has actually been DONE with this generation's tokens — generated, revoked, and
 * every registration/update that came through one, with the person who did it.
 * Read from the append-only `invite_events` log, so revoked tokens still show history.
 */
const ACTION_META: Record<string, { label: string; icon: any; tone: string }> = {
    generated: { label: "Token generated", icon: KeyRound, tone: "bg-slate-100 text-slate-600" },
    revoked: { label: "Token revoked", icon: Ban, tone: "bg-red-50 text-red-500" },
    register: { label: "Registered", icon: UserPlus, tone: "bg-emerald-50 text-emerald-600" },
    update: { label: "Updated details", icon: PencilLine, tone: "bg-sky-50 text-sky-600" },
};

export function TokenActivity({ classSetId }: { classSetId: string }) {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        (async () => {
            const res = await getLevelTokenActivityAction(classSetId);
            if (!active) return;
            if (!res.success) setError(res.error || "Could not load activity.");
            setEvents(res.data || []);
            setLoading(false);
        })();
        return () => {
            active = false;
        };
    }, [classSetId]);

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-rcf-navy" />
            </div>
        );
    }

    if (error) {
        return (
            <p className="flex items-start gap-1.5 text-sm text-red-600">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </p>
        );
    }

    if (events.length === 0) {
        return (
            <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 py-14 text-center">
                <History className="mb-3 h-9 w-9 text-slate-300" />
                <h4 className="font-bold text-slate-700">Nothing yet</h4>
                <p className="mt-1 max-w-xs text-sm text-slate-400">
                    Every token you generate, revoke or that someone uses will show up here.
                </p>
            </div>
        );
    }

    return (
        <ol className="space-y-2">
            {events.map((e) => {
                const meta = ACTION_META[e.action] ?? ACTION_META.generated;
                const Icon = meta.icon;
                return (
                    <li
                        key={e.id}
                        className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3"
                    >
                        <span className={`shrink-0 rounded-lg p-2 ${meta.tone}`}>
                            <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-800">{meta.label}</p>
                            <p className="truncate text-xs text-slate-500">
                                {e.actorName || "Someone"}
                                {e.actorEmail ? ` · ${e.actorEmail}` : ""}
                            </p>
                            <p className="mt-0.5 truncate text-[10px] text-slate-400">
                                {e.label || "Level token"} ·{" "}
                                <span className="font-mono">{(e.token || "").slice(0, 8)}…</span>
                            </p>
                        </div>
                        <time
                            dateTime={e.createdAt}
                            className="shrink-0 text-[10px] text-slate-400"
                            title={new Date(e.createdAt).toLocaleString()}
                        >
                            {new Date(e.createdAt).toLocaleDateString(undefined, {
                                day: "numeric",
                                month: "short",
                            })}
                        </time>
                    </li>
                );
            })}
        </ol>
    );
}
