/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { GraduationCap, Loader2, Search, Check } from "lucide-react";
import { getGenerationRosterAction } from "../actions";
import { MemberAvatar } from "@/components/dashboard/roster/member-avatar";

/** What the wizard keeps for each finalist (also saved in the intent, to resume). */
export interface Finalist {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    avatar_url?: string | null;
}

/**
 * The 400 Level members who finish THIS session (four-year courses).
 *
 * Everyone in 400 Level would otherwise move up to 500 Level at the handover. The ones
 * ticked here join the outgoing 500 Level generation instead, and become alumni with
 * it. The whole generation is loaded once and filtered in the browser: a level is a few
 * dozen members, so search is instant even on a slow connection.
 */
export function HandoverFinalists({
    classSetId,
    fourHundredName,
    alumniName,
    selected,
    onChange,
}: {
    /** The current 400 Level generation. */
    classSetId: string;
    fourHundredName: string;
    /** The 500 Level generation becoming alumni, which the finalists join. */
    alumniName: string;
    selected: Finalist[];
    onChange: (next: Finalist[]) => void;
}) {
    const [roster, setRoster] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");

    useEffect(() => {
        let cancelled = false;
        getGenerationRosterAction(classSetId)
            .then((res) => {
                if (cancelled) return;
                if (res.success) setRoster(res.data);
                else setError(res.error || "Could not load 400 Level.");
            })
            .catch(() => {
                if (!cancelled) setError("Could not load 400 Level. Check your connection.");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [classSetId]);

    const chosen = useMemo(() => new Set(selected.map((f) => f.id)), [selected]);
    const shown = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return roster.filter((m) =>
            !needle
            || `${m.first_name} ${m.middle_name ?? ""} ${m.last_name} ${m.matric_number ?? ""} ${m.department ?? ""}`
                .toLowerCase()
                .includes(needle),
        );
    }, [roster, query]);

    const toggle = (m: any) => {
        onChange(
            chosen.has(m.id)
                ? selected.filter((f) => f.id !== m.id)
                : [...selected, { id: m.id, first_name: m.first_name, last_name: m.last_name, avatar_url: m.avatar_url }],
        );
    };

    return (
        <section className="mt-5 rounded-2xl border border-slate-200 p-4">
            <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <GraduationCap className="h-4 w-4 text-amber-600" aria-hidden="true" />
                400 Level finalists
                {selected.length > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                        {selected.length}
                    </span>
                )}
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Anyone in {fourHundredName} who finishes this session (a four-year course). Ticked
                members join <strong>{alumniName}</strong> and become alumni with it, instead of
                moving up to 500 Level. Leave it empty if there are none.
            </p>

            {loading ? (
                <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    Loading {fourHundredName}…
                </p>
            ) : error ? (
                <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
            ) : (
                <>
                    <div className="relative mt-3">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={`Search ${roster.length} members`}
                            aria-label="Search 400 Level members"
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rcf-navy focus:outline-none"
                        />
                    </div>
                    <ul className="mt-2 max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-100">
                        {shown.length === 0 && (
                            <li className="px-3 py-4 text-center text-xs text-slate-400">Nobody matches that.</li>
                        )}
                        {shown.map((m) => {
                            const on = chosen.has(m.id);
                            return (
                                <li key={m.id}>
                                    <button
                                        type="button"
                                        onClick={() => toggle(m)}
                                        aria-pressed={on}
                                        className={`flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left transition-colors focus:outline-none focus-visible:bg-slate-50 ${
                                            on ? "bg-amber-50" : "hover:bg-slate-50"
                                        }`}
                                    >
                                        <MemberAvatar url={m.avatar_url} first={m.first_name} last={m.last_name} gender={m.gender} size={32} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium text-slate-800">
                                                {m.first_name} {m.last_name}
                                            </span>
                                            <span className="block truncate text-[11px] text-slate-400">
                                                {[m.matric_number, m.department].filter(Boolean).join(" · ") || "—"}
                                            </span>
                                        </span>
                                        <span
                                            aria-hidden="true"
                                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                                                on ? "border-amber-600 bg-amber-600 text-white" : "border-slate-300 bg-white"
                                            }`}
                                        >
                                            {on && <Check className="h-3.5 w-3.5" />}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </section>
    );
}
