"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { StatsSkeleton } from "@/components/dashboard/roster/stats-strip";
import { ReportPeople, ReportSummary } from "@/components/academics/report-view";
import { semesterKey } from "@/lib/academics";
import type { AcademicRound } from "@/lib/academics-db";
import type { SemesterReport } from "@/lib/academics-report";
import { getSemesterReportAction, listReportSemestersAction } from "../actions";

type SemesterOption = { session: string; semester: number; label: string };

/**
 * The fellowship's results for one semester. Opens on the open round's semester, or
 * the latest one there is.
 */
export function OverviewPanel({ rounds }: { rounds: AcademicRound[] }) {
    const initial = rounds.find((r) => r.isOpen) ?? rounds[0] ?? null;
    const [options, setOptions] = useState<SemesterOption[]>(
        rounds.map((r) => ({ session: r.session, semester: r.semester, label: r.label })),
    );
    const [picked, setPicked] = useState<string | null>(initial ? semesterKey(initial.session, initial.semester) : null);
    const [report, setReport] = useState<SemesterReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Semesters with records but no round (backfill) join the picker once known.
    useEffect(() => {
        let active = true;
        listReportSemestersAction()
            .then((res) => {
                if (!active || !res.success) return;
                setOptions(res.data);
                setPicked((p) => p ?? (res.data[0] ? semesterKey(res.data[0].session, res.data[0].semester) : null));
                if (res.data.length === 0) setLoading(false);
            })
            .catch(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, []);

    const load = useCallback(async (key: string) => {
        const [session, sem] = key.split("#");
        setLoading(true);
        setError(null);
        try {
            const res = await getSemesterReportAction(session, Number(sem));
            if (res.success) setReport(res.data);
            else setError(res.error);
        } catch {
            setError("Couldn't reach the server. Check your connection and try again.");
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (!picked) return;
        // Deferred a tick so the fetch's setState calls happen outside the effect body.
        const t = setTimeout(() => load(picked), 0);
        return () => clearTimeout(t);
    }, [picked, load]);

    if (!picked && !loading) {
        return (
            <p className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
                No results yet. Open a round in the Rounds tab to start collecting them.
            </p>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="academics-semester" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Semester
                </label>
                <select
                    id="academics-semester"
                    value={picked ?? ""}
                    onChange={(e) => setPicked(e.target.value)}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-rcf-navy focus:outline-none sm:max-w-xs"
                >
                    {options.map((o) => (
                        <option key={semesterKey(o.session, o.semester)} value={semesterKey(o.session, o.semester)}>
                            {o.label}
                        </option>
                    ))}
                </select>
                {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400 motion-reduce:animate-none" aria-label="Loading" />}
            </div>

            {error ? (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <p>{error}</p>
                    <button
                        type="button"
                        onClick={() => picked && load(picked)}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                    >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
                    </button>
                </div>
            ) : !report ? (
                <StatsSkeleton />
            ) : (
                <div className={loading ? "opacity-60 transition-opacity motion-reduce:transition-none" : undefined}>
                    <div className="space-y-4">
                        <ReportSummary report={report} />
                        <ReportPeople report={report} filePrefix="fellowship" />
                    </div>
                </div>
            )}
        </div>
    );
}
