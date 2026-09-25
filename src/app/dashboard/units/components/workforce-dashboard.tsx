"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, SquaresUnite, RefreshCw } from "lucide-react";
import { getUnitModuleData } from "../actions";
import { AdminUnitView } from "./admin-view";
import { LeaderUnitView } from "./leader-view";
import { CompactPreloader } from "@/components/ui/preloader";

type ModuleData = Awaited<ReturnType<typeof getUnitModuleData>>;

/**
 * Workforce — who is in which unit and team this session.
 *
 * Three views from one loader: the admin read tier sees every unit; an Executive (lead
 * or assistant) sees the units their office's EXCO tags cover; anyone else who reaches
 * the page is told plainly that they lead nothing, rather than shown an empty grid.
 */
export function WorkforceDashboard() {
    const [data, setData] = useState<ModuleData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            setError(null);
            setData(await getUnitModuleData());
        } catch (e) {
            // requireModuleRead throws when the session has no Workforce access.
            setError(e instanceof Error ? e.message : "Couldn't load Workforce.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const t = setTimeout(load, 0);
        return () => clearTimeout(t);
    }, [load]);

    if (loading) {
        return (
            <div className="flex min-h-96 items-center justify-center">
                <CompactPreloader title="Loading Workforce" subtitle="Fetching your units…" showUserIcon={false} />
            </div>
        );
    }

    if (error || !data) {
        const denied = !!error && /access/i.test(error);
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
                <ShieldAlert className="mb-4 h-14 w-14 text-red-500" aria-hidden="true" />
                <h1 className="text-2xl font-bold text-slate-900">
                    {denied ? "Access denied" : "Couldn't load Workforce"}
                </h1>
                <p className="mt-2 max-w-md text-slate-500">
                    {denied
                        ? "Workforce is for Executives and the central leadership."
                        : error || "Something went wrong."}
                </p>
                {!denied && (
                    <button
                        type="button"
                        onClick={() => {
                            setLoading(true);
                            load();
                        }}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                    >
                        <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20">
            <header className="border-b border-slate-200 pb-5">
                <h1 className="flex items-center gap-2.5 text-2xl font-bold text-rcf-navy sm:text-3xl">
                    <SquaresUnite className="h-7 w-7 shrink-0" aria-hidden="true" />
                    Workforce
                </h1>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                    A member is a <strong>worker</strong> once they belong to a unit — one
                    unit per member per session. Teams are open: anyone can be on any
                    number, and being on a team doesn&rsquo;t make someone a worker.
                </p>
            </header>

            {!data.tenureId && (
                <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    There is no active session, so there are no rosters to manage yet.
                </p>
            )}

            {data.role === "ADMIN" ? (
                <AdminUnitView data={data} />
            ) : data.role === "LEADER" ? (
                <LeaderUnitView units={data.managedUnits} />
            ) : (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
                    <p className="font-bold text-slate-700">You don&rsquo;t lead a unit or team this session.</p>
                    <p className="mt-1 text-sm text-slate-500">
                        Rosters are managed by each unit&rsquo;s Executive and their assistants.
                    </p>
                </div>
            )}
        </div>
    );
}
