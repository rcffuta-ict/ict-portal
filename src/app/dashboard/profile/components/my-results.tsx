"use client";

import { useCallback, useEffect, useState } from "react";
import { GraduationCap, Loader2, RefreshCw } from "lucide-react";
import { getMyResultsAction } from "@/app/dashboard/profile/actions";

type Result = Awaited<ReturnType<typeof getMyResultsAction>>;

/**
 * "My results": the member's own semester history. Renders nothing at all unless the
 * Academic Unit has switched it on, which the server decides.
 */
export function MyResults() {
    const [res, setRes] = useState<Result | null>(null);
    const [failed, setFailed] = useState(false);

    const load = useCallback(async () => {
        setFailed(false);
        try {
            setRes(await getMyResultsAction());
        } catch {
            setFailed(true);
        }
    }, []);

    useEffect(() => {
        const t = setTimeout(load, 0);
        return () => clearTimeout(t);
    }, [load]);

    if (res?.success && !res.enabled) return null;

    return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                <div className="rounded-lg border border-slate-100 bg-white p-2 text-slate-500 shadow-sm">
                    <GraduationCap className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="font-bold text-slate-800">My results</h3>
            </div>
            <div className="p-6">
                {failed || (res && !res.success) ? (
                    <div role="alert" className="text-sm text-red-700">
                        <p>{res && !res.success ? res.error : "Couldn't reach the server."}</p>
                        <button type="button" onClick={load} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold underline-offset-2 hover:underline">
                            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
                        </button>
                    </div>
                ) : !res ? (
                    <p className="flex items-center gap-2 text-sm text-slate-500" role="status">
                        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Loading…
                    </p>
                ) : res.records.length === 0 ? (
                    <p className="text-sm text-slate-500">
                        No results on record yet. The Academic Unit shares a link each semester.
                    </p>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {res.records.map((r) => (
                            <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold text-slate-800">{r.label}</span>
                                    <span className="block text-xs text-slate-500">GPA {r.gpa.toFixed(2)}</span>
                                </span>
                                <span className="shrink-0 text-right">
                                    <span className="block font-mono text-base font-bold text-rcf-navy">{r.cgpa.toFixed(2)}</span>
                                    <span className="block text-[10px] text-slate-500">{r.classLabel}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}
