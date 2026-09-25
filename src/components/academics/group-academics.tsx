"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EyeOff, FileDown, GraduationCap, Loader2, RefreshCw } from "lucide-react";
import { ReportPeople, ReportSkeleton, ReportSummary } from "@/components/academics/report-view";
import { semesterKey } from "@/lib/academics";
import type { RecordExportRow, SemesterReport } from "@/lib/academics-report";
import { csvFilename, downloadCsv, fileSlug } from "@/lib/csv";

export type GroupAcademicsResult =
    | {
          success: true;
          semesters: { session: string; semester: number; label: string }[];
          individuals: boolean;
          report: SemesterReport | null;
      }
    | { success: false; error: string };

/**
 * One group's academics (a unit's, or a generation's): semester picker, totals and,
 * when the server sent them, the names. `load` is the group's own server action, which
 * decides what this viewer may see.
 */
export function GroupAcademics({
    groupName,
    load: fetchReport,
    exportRecords,
}: {
    groupName: string;
    load: (session?: string, semester?: number) => Promise<GroupAcademicsResult>;
    /** Every semester of every member, for the full-record export. */
    exportRecords?: () => Promise<{ success: boolean; error?: string; data: RecordExportRow[] }>;
}) {
    const [data, setData] = useState<Extract<GroupAcademicsResult, { success: true }> | null>(null);
    const [picked, setPicked] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Held in a ref: the parent passes a fresh closure each render, and it mustn't
    // trigger a refetch.
    const fetchRef = useRef(fetchReport);
    useEffect(() => {
        fetchRef.current = fetchReport;
    }, [fetchReport]);

    const load = useCallback(
        async (key: string | null) => {
            setLoading(true);
            setError(null);
            try {
                const [session, sem] = key ? key.split("#") : [];
                const res = await fetchRef.current(session, sem ? Number(sem) : undefined);
                if (res.success) {
                    setData(res);
                    if (res.report) setPicked(semesterKey(res.report.session, res.report.semester));
                } else setError(res.error);
            } catch {
                setError("Couldn't reach the server. Check your connection and try again.");
            }
            setLoading(false);
        },
        [],
    );

    useEffect(() => {
        // Deferred a tick so the fetch's setState calls happen outside the effect body.
        const t = setTimeout(() => load(null), 0);
        return () => clearTimeout(t);
    }, [load]);

    if (error) {
        return (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <p>{error}</p>
                <button
                    type="button"
                    onClick={() => load(picked)}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
                </button>
            </div>
        );
    }
    if (!data) return <ReportSkeleton label={`Loading ${groupName}'s academics…`} />;

    if (!data.report) {
        return (
            <p className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
                <GraduationCap className="mx-auto mb-2 h-8 w-8 opacity-30" aria-hidden="true" />
                No results have been collected yet. The Academic Unit opens a round each semester.
            </p>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="group-academics-semester" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Semester
                </label>
                <select
                    id="group-academics-semester"
                    value={picked ?? ""}
                    onChange={(e) => {
                        setPicked(e.target.value);
                        load(e.target.value);
                    }}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-rcf-navy focus:outline-none sm:max-w-xs"
                >
                    {data.semesters.map((o) => (
                        <option key={semesterKey(o.session, o.semester)} value={semesterKey(o.session, o.semester)}>
                            {o.label}
                        </option>
                    ))}
                </select>
                {loading && (
                    <span className="flex items-center gap-1.5 text-xs text-slate-500" role="status">
                        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Loading…
                    </span>
                )}
            </div>

            <div
                aria-busy={loading}
                className={loading ? "pointer-events-none space-y-4 opacity-50 transition-opacity motion-reduce:transition-none" : "space-y-4"}
            >
                <ReportSummary report={data.report} />
                {data.individuals ? (
                    <>
                        {exportRecords && <FullRecordExport groupName={groupName} exportRecords={exportRecords} />}
                        <ReportPeople report={data.report} filePrefix={groupName} showUnit={false} />
                    </>
                ) : (
                    <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
                        <EyeOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        The Academic Unit shows totals only here, not each member&apos;s results.
                    </p>
                )}
            </div>
        </div>
    );
}

/**
 * The whole group's academic record in one file: every member, every semester, with
 * matric number, department and level. What a unit head or coordinator sends when the
 * authorities ask for their members' academics.
 */
function FullRecordExport({
    groupName,
    exportRecords,
}: {
    groupName: string;
    exportRecords: NonNullable<Parameters<typeof GroupAcademics>[0]["exportRecords"]>;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const run = async () => {
        setBusy(true);
        setError(null);
        try {
            const res = await exportRecords();
            if (!res.success) setError(res.error ?? "Couldn't prepare the file.");
            else
                downloadCsv(
                    csvFilename(`${fileSlug(groupName)}-academic-record`),
                    ["Name", "Matric number", "Email", "Phone", "Gender", "Level", "Department", "School", "Semester", "GPA", "CGPA", "Class"],
                    res.data.map((r) => [
                        r.name, r.matric, r.email, r.phone, r.gender, r.level, r.department, r.faculty,
                        r.semester, r.gpa, r.cgpa, r.classLabel,
                    ]),
                );
        } catch {
            setError("Couldn't reach the server. Check your connection and try again.");
        }
        setBusy(false);
    };

    return (
        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0">
                <h4 className="font-bold text-slate-700">Full academic record</h4>
                <p className="text-xs text-slate-500">
                    Every member of {groupName}, every semester on record, with matric number and department. For reports to the authorities.
                </p>
                {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
            </div>
            <button
                type="button"
                onClick={run}
                disabled={busy}
                className="btn-primary flex h-11 shrink-0 items-center justify-center gap-2 px-4 text-sm disabled:opacity-60"
            >
                {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <FileDown className="h-4 w-4" aria-hidden="true" />}
                {busy ? "Preparing…" : "Download CSV"}
            </button>
        </section>
    );
}
