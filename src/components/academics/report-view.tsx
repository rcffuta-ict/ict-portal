"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Award, BarChart3, ClipboardCheck, Download, Loader2, Search, TrendingUp, Users } from "lucide-react";
import { StatsSkeleton, StatsStrip, type StatItem } from "@/components/dashboard/roster/stats-strip";
import { SkeletonCard, SkeletonRegion } from "@/components/ui/skeleton";
import { PaginatedGrid } from "@/components/dashboard/roster/paginated-grid";
import { MAX_GRADE, formatGrade } from "@/lib/academics";
import { byLevel } from "@/lib/levels";
import { downloadCsv, fileSlug } from "@/lib/csv";
import type { BreakdownRow, OutstandingRow, ResultRow, SemesterReport } from "@/lib/academics-report";

/**
 * A semester report, drawn with plain CSS bars: no chart library to download, and it
 * reads the same on a small phone. Used by the Academics module (the whole fellowship)
 * and by Workforce → Academics (one unit).
 */

function pct(part: number, whole: number): number {
    return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export function reportStats(report: SemesterReport): StatItem[] {
    const first = report.distribution.find((d) => d.id === "first")?.count ?? 0;
    return [
        { label: "Owe results", value: report.eligible, icon: Users, tone: "text-slate-700 bg-slate-100" },
        {
            label: "Submitted",
            value: `${report.submitted} (${pct(report.submitted, report.eligible)}%)`,
            icon: ClipboardCheck,
            tone: "text-sky-700 bg-sky-50",
        },
        { label: "Mean CGPA", value: formatGrade(report.meanCgpa), icon: TrendingUp, tone: "text-indigo-700 bg-indigo-50" },
        { label: "First class", value: first, icon: Award, tone: "text-emerald-700 bg-emerald-50" },
        { label: "At risk", value: report.atRisk, icon: AlertTriangle, tone: "text-red-700 bg-red-50" },
    ];
}

/**
 * While a report loads: a visible "Loading…" line (a grey outline alone reads as an
 * empty page on a slow phone), then placeholders the size of what's coming, so nothing
 * jumps when it arrives.
 */
export function ReportSkeleton({ label = "Loading academics…" }: { label?: string }) {
    return (
        <div className="space-y-4">
            <p className="flex items-center justify-center gap-2 py-2 text-sm text-slate-500" role="status">
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                {label}
            </p>
            <StatsSkeleton />
            <SkeletonRegion label="academic report">
                <div className="grid gap-4 lg:grid-cols-2">
                    <SkeletonCard className="h-64" />
                    <SkeletonCard className="h-64" />
                </div>
            </SkeletonRegion>
        </div>
    );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof BarChart3; children: React.ReactNode }) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h4 className="mb-4 flex items-center gap-2 font-bold text-slate-700">
                <Icon className="h-4 w-4" aria-hidden="true" /> {title}
            </h4>
            {children}
        </section>
    );
}

/** A labelled horizontal bar. `fraction` is 0..1. */
function Bar({ label, value, fraction, barClass = "bg-rcf-navy" }: { label: string; value: string; fraction: number; barClass?: string }) {
    return (
        <li className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 truncate font-semibold text-slate-700">{label}</span>
                <span className="shrink-0 font-mono text-slate-500">{value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                <div className={`h-full rounded-full ${barClass}`} style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }} />
            </div>
        </li>
    );
}

const BREAKDOWNS = [
    { id: "byLevel", label: "Level" },
    { id: "byDepartment", label: "Department" },
    { id: "byFaculty", label: "School" },
    { id: "byGender", label: "Gender" },
] as const;

export function ReportSummary({ report }: { report: SemesterReport }) {
    const [by, setBy] = useState<(typeof BREAKDOWNS)[number]["id"]>("byLevel");
    const rows: BreakdownRow[] = report[by];

    if (report.submitted === 0) {
        return (
            <div className="space-y-4">
                <StatsStrip items={reportStats(report)} />
                <p className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-10 text-center text-sm text-slate-500">
                    No results for {report.label} yet.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <StatsStrip items={reportStats(report)} />

            <div className="grid gap-4 lg:grid-cols-2">
                <Section title="Class of degree (by CGPA)" icon={Award}>
                    <ul className="space-y-3">
                        {report.distribution.map((d) => (
                            <Bar
                                key={d.id}
                                label={d.label}
                                value={`${d.count} · ${pct(d.count, report.submitted)}%`}
                                fraction={report.submitted ? d.count / report.submitted : 0}
                                barClass={d.tone.split(" ")[0]}
                            />
                        ))}
                    </ul>
                </Section>

                <Section title="Mean CGPA by" icon={BarChart3}>
                    <div role="group" aria-label="Group by" className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1">
                        {BREAKDOWNS.map((b) => (
                            <button
                                key={b.id}
                                type="button"
                                aria-pressed={by === b.id}
                                onClick={() => setBy(b.id)}
                                className={`h-9 shrink-0 rounded-lg px-3 text-xs font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy ${
                                    by === b.id ? "bg-rcf-navy text-white" : "border border-slate-200 text-slate-600 hover:text-rcf-navy"
                                }`}
                            >
                                {b.label}
                            </button>
                        ))}
                    </div>
                    <ul className="max-h-80 space-y-3 overflow-y-auto pr-1">
                        {rows.map((r) => (
                            <Bar
                                key={r.key}
                                label={`${r.label} (${r.count})`}
                                value={formatGrade(r.meanCgpa)}
                                fraction={(r.meanCgpa ?? 0) / MAX_GRADE}
                            />
                        ))}
                    </ul>
                </Section>
            </div>

            {report.trend.length > 1 && (
                <Section title="Mean CGPA over time" icon={TrendingUp}>
                    <ul className="space-y-3">
                        {report.trend.map((t) => (
                            <Bar
                                key={t.key}
                                label={`${t.label} (${t.count})`}
                                value={formatGrade(t.meanCgpa)}
                                fraction={(t.meanCgpa ?? 0) / MAX_GRADE}
                                barClass={t.key === `${report.session}#${report.semester}` ? "bg-rcf-gold" : "bg-rcf-navy/70"}
                            />
                        ))}
                    </ul>
                </Section>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Individuals: who submitted (with grades), who hasn't
// ---------------------------------------------------------------------------

type ListId = "results" | "atRisk" | "outstanding";

/**
 * The names behind the numbers. Only rendered when the server sent them, which it does
 * only for viewers allowed to see individual results.
 */
export function ReportPeople({
    report,
    filePrefix,
    showUnit = true,
}: {
    report: SemesterReport;
    /** For the CSV file name, e.g. "choir-unit" or "fellowship". */
    filePrefix: string;
    showUnit?: boolean;
}) {
    const [list, setList] = useState<ListId>("results");
    const [q, setQ] = useState("");
    const [level, setLevel] = useState("all");
    const [unit, setUnit] = useState("all");

    const results = useMemo(() => report.results ?? [], [report.results]);
    const outstanding = useMemo(() => report.outstanding ?? [], [report.outstanding]);
    const source: (ResultRow | OutstandingRow)[] =
        list === "outstanding" ? outstanding : list === "atRisk" ? results.filter((r) => r.risk) : results;

    const levels = useMemo(
        () => [...new Set([...results, ...outstanding].map((r) => r.level).filter(Boolean) as string[])].sort(byLevel),
        [results, outstanding],
    );
    const units = useMemo(
        () => [...new Set([...results, ...outstanding].map((r) => r.unit).filter(Boolean) as string[])].sort(),
        [results, outstanding],
    );

    const needle = q.trim().toLowerCase();
    const filtered = source.filter(
        (r) =>
            (level === "all" || r.level === level) &&
            (unit === "all" || (unit === "none" ? !r.unit : r.unit === unit)) &&
            (!needle || r.name.toLowerCase().includes(needle) || (r.department ?? "").toLowerCase().includes(needle)),
    );

    const exportCsv = () => {
        const base = `${fileSlug(filePrefix)}-${fileSlug(report.label)}-${list === "outstanding" ? "not-submitted" : list === "atRisk" ? "at-risk" : "results"}.csv`;
        if (list === "outstanding") {
            downloadCsv(
                base,
                ["Name", "Email", "Phone", "Level", "Department", "Unit"],
                (filtered as OutstandingRow[]).map((r) => [r.name, r.email, r.phone, r.level, r.department, r.unit]),
            );
        } else {
            downloadCsv(
                base,
                ["Name", "Email", "Phone", "Level", "Department", "Unit", "Semester", "GPA", "CGPA", "Class", "Flag"],
                (filtered as ResultRow[]).map((r) => [
                    r.name, r.email, r.phone, r.level, r.department, r.unit,
                    report.label, r.gpa.toFixed(2), r.cgpa.toFixed(2), r.classLabel, r.risk ?? "",
                ]),
            );
        }
    };

    const tabs: { id: ListId; label: string; count: number }[] = [
        { id: "results", label: "Submitted", count: results.length },
        { id: "atRisk", label: "At risk", count: results.filter((r) => r.risk).length },
        { id: "outstanding", label: "Not submitted", count: outstanding.length },
    ];

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div role="group" aria-label="Which members" className="-mx-1 flex gap-1 overflow-x-auto px-1">
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            aria-pressed={list === t.id}
                            onClick={() => setList(t.id)}
                            className={`h-9 shrink-0 rounded-lg px-3 text-xs font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy ${
                                list === t.id ? "bg-rcf-navy text-white" : "border border-slate-200 text-slate-600 hover:text-rcf-navy"
                            }`}
                        >
                            {t.label} <span className="opacity-70">{t.count}</span>
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={exportCsv}
                    disabled={filtered.length === 0}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:border-rcf-navy/40 hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:opacity-40"
                >
                    <Download className="h-4 w-4" aria-hidden="true" /> Export {filtered.length}
                </button>
            </div>

            <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input
                        type="search"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search name or department"
                        aria-label="Search members"
                        className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rcf-navy focus:outline-none"
                    />
                </div>
                <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    aria-label="Filter by level"
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-rcf-navy focus:outline-none sm:w-40"
                >
                    <option value="all">All levels</option>
                    {levels.map((l) => (
                        <option key={l} value={l}>{l}</option>
                    ))}
                </select>
                {showUnit && units.length > 0 && (
                    <select
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        aria-label="Filter by unit"
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-rcf-navy focus:outline-none sm:w-48"
                    >
                        <option value="all">All units</option>
                        <option value="none">In no unit</option>
                        {units.map((u) => (
                            <option key={u} value={u}>{u}</option>
                        ))}
                    </select>
                )}
            </div>

            <PaginatedGrid
                items={filtered}
                label={tabs.find((t) => t.id === list)!.label}
                resetKey={`${list}|${q}|${level}|${unit}`}
                getKey={(r) => r.profileId}
                empty={
                    <p className="rounded-xl border-2 border-dashed border-slate-100 py-10 text-center text-sm text-slate-400">
                        {list === "outstanding" ? "Everyone who owes results has sent them." : "Nobody here."}
                    </p>
                }
                renderItem={(r) => <PersonCard row={r} showUnit={showUnit} />}
            />
        </section>
    );
}

function PersonCard({ row, showUnit }: { row: ResultRow | OutstandingRow; showUnit: boolean }) {
    const graded = "cgpa" in row;
    return (
        <div className="flex h-full items-start justify-between gap-3 rounded-xl border border-slate-200 p-3">
            <div className="min-w-0 space-y-0.5">
                <p className="truncate text-sm font-bold text-slate-800">{row.name}</p>
                <p className="truncate text-xs text-slate-500">
                    {[row.level, row.department, showUnit ? row.unit : null].filter(Boolean).join(" · ") || "—"}
                </p>
                {graded && row.risk && (
                    <p className="flex items-center gap-1 text-[11px] font-semibold text-red-600">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" /> {row.risk}
                    </p>
                )}
                {!graded && (row.phone || row.email) && (
                    <p className="truncate text-xs text-slate-400">{row.phone || row.email}</p>
                )}
            </div>
            {graded && (
                <div className="shrink-0 text-right">
                    <p className="font-mono text-base font-bold text-rcf-navy">{row.cgpa.toFixed(2)}</p>
                    <p className="text-[10px] font-semibold uppercase text-slate-400">CGPA · GPA {row.gpa.toFixed(2)}</p>
                    <p className="text-[10px] text-slate-500">{row.classLabel}</p>
                </div>
            )}
        </div>
    );
}
