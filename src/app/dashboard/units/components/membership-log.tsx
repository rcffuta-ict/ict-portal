"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Loader2, RefreshCw } from "lucide-react";
import { getMembershipLogAction } from "../actions";

type LogRow = {
    id: string;
    action: string;
    actorName: string | null;
    createdAt: string;
    memberName: string;
};

const VERB: Record<string, string> = {
    added: "was added",
    removed: "was removed",
    transferred_in: "transferred in",
    transferred_out: "transferred out",
    carried_over: "was carried over from last session",
};

/**
 * "Ada Obi was added by John Musa · 3 Sep 2026, 14:05" — who changed this roster, and
 * when. Newest first, 20 at a time; "Show more" appends rather than paging away, so
 * the reader keeps their place.
 */
export function MembershipLog({ unitId }: { unitId: string }) {
    const [rows, setRows] = useState<LogRow[]>([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(
        async (nextPage: number) => {
            setLoading(true);
            setError(null);
            const res = await getMembershipLogAction(unitId, nextPage);
            if (res.success) {
                setRows((prev) => (nextPage === 0 ? res.data : [...prev, ...res.data]));
                setHasMore(res.hasMore);
                setPage(nextPage);
            } else {
                setError(res.error || "Couldn't load the log.");
            }
            setLoading(false);
        },
        [unitId],
    );

    useEffect(() => {
        const t = setTimeout(() => load(0), 0);
        return () => clearTimeout(t);
    }, [load]);

    return (
        <section aria-labelledby={`log-${unitId}`} className="space-y-3">
            <h3 id={`log-${unitId}`} className="flex items-center gap-2 font-bold text-slate-700">
                <History className="h-4 w-4" aria-hidden="true" /> Membership log
            </h3>

            {error && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <p>{error}</p>
                    <button
                        type="button"
                        onClick={() => load(page)}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                    >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
                    </button>
                </div>
            )}

            {!error && !loading && rows.length === 0 && (
                <p className="rounded-xl border-2 border-dashed border-slate-100 py-10 text-center text-sm text-slate-400">
                    No changes recorded this session yet.
                </p>
            )}

            {rows.length > 0 && (
                <ol className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                    {rows.map((r) => (
                        <li key={r.id} className="px-3 py-2.5 text-sm">
                            <p className="text-slate-800">
                                <span className="font-semibold">{r.memberName}</span>{" "}
                                {VERB[r.action] ?? r.action}
                                {r.actorName ? (
                                    <>
                                        {" "}by <span className="font-semibold">{r.actorName}</span>
                                    </>
                                ) : null}
                            </p>
                            <p className="text-[11px] text-slate-500">
                                <time dateTime={r.createdAt}>{formatWat(r.createdAt)}</time>
                            </p>
                        </li>
                    ))}
                </ol>
            )}

            {loading && (
                <p role="status" className="flex items-center justify-center gap-2 py-4 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    Loading…
                </p>
            )}

            {!loading && hasMore && (
                <button
                    type="button"
                    onClick={() => load(page + 1)}
                    className="h-10 w-full rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                >
                    Show more
                </button>
            )}
        </section>
    );
}

function formatWat(iso: string): string {
    return new Intl.DateTimeFormat("en-NG", {
        timeZone: "Africa/Lagos",
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(iso));
}
