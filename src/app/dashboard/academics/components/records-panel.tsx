"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { MemberAvatar } from "@/components/dashboard/roster/member-avatar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Download, Loader2, Pencil, Plus, RefreshCw, Search, Trash2, User } from "lucide-react";
import { PaginatedGrid } from "@/components/dashboard/roster/paginated-grid";
import { useAlertModal, AlertModal } from "@/components/ui/alert-modal";
import FormInput from "@/components/ui/FormInput";
import FormSelect from "@/components/ui/FormSelect";
import { DEGREE_CLASSES, SEMESTER_NAMES, isValidSession, parseGrade, sessionFor } from "@/lib/academics";
import { byLevel, sessionStartYear } from "@/lib/levels";
import { downloadCsv, csvFilename } from "@/lib/csv";
import {
    deleteMemberRecordAction,
    exportAllRecordsAction,
    getMemberHistoryAction,
    getRecordsIndexAction,
    saveMemberRecordAction,
} from "../actions";

type Row = Awaited<ReturnType<typeof getRecordsIndexAction>>["data"][number];

/**
 * Every member who owes results this session or has any on record, with their latest
 * CGPA. Open one to see their history; writers can add or correct a semester.
 */
export function RecordsPanel({ canWrite, activeSession }: { canWrite: boolean; activeSession: string | null }) {
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [q, setQ] = useState("");
    const [level, setLevel] = useState("all");
    const [klass, setKlass] = useState("all");
    const [openId, setOpenId] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getRecordsIndexAction();
            if (res.success) setRows(res.data);
            else setError(res.error);
        } catch {
            setError("Couldn't reach the server. Check your connection and try again.");
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        const t = setTimeout(load, 0);
        return () => clearTimeout(t);
    }, [load]);

    const levels = useMemo(() => [...new Set(rows.map((r) => r.level).filter(Boolean) as string[])].sort(byLevel), [rows]);
    const needle = q.trim().toLowerCase();
    const filtered = rows.filter(
        (r) =>
            (level === "all" || r.level === level) &&
            (klass === "all" || (klass === "none" ? !r.classLabel : r.classLabel === klass)) &&
            (!needle ||
                r.name.toLowerCase().includes(needle) ||
                (r.matric ?? "").toLowerCase().includes(needle) ||
                (r.department ?? "").toLowerCase().includes(needle)),
    );

    const exportLatest = () =>
        downloadCsv(
            csvFilename("academic-records-latest"),
            ["Name", "Email", "Phone", "Matric", "Level", "Department", "Unit", "Latest semester", "GPA", "CGPA", "Class", "Semesters on record"],
            filtered.map((r) => [
                r.name, r.email, r.phone, r.matric, r.level, r.department, r.unit, r.latestLabel,
                r.latestGpa?.toFixed(2) ?? "", r.latestCgpa?.toFixed(2) ?? "", r.classLabel ?? "", r.semesters,
            ]),
        );

    const exportAll = async () => {
        setExporting(true);
        setExportError(null);
        try {
            const res = await exportAllRecordsAction(filtered.map((r) => r.id));
            if (!res.success) {
                setExportError(res.error);
            } else {
                const byId = new Map(filtered.map((r) => [r.id, r]));
                downloadCsv(
                    csvFilename("academic-records-all-semesters"),
                    ["Name", "Email", "Matric", "Level", "Department", "Unit", "Semester", "GPA", "CGPA", "Class", "Entered by"],
                    res.data.map((x) => {
                        const m = byId.get(x.profileId);
                        return [
                            m?.name, m?.email, m?.matric, m?.level, m?.department, m?.unit, x.label,
                            x.gpa.toFixed(2), x.cgpa.toFixed(2), x.classLabel, x.source === "coordinator" ? "Academic Unit" : "Member",
                        ];
                    }),
                );
            }
        } catch {
            setExportError("Couldn't reach the server. Try again.");
        }
        setExporting(false);
    };

    if (openId) {
        return (
            <MemberHistory
                profileId={openId}
                canWrite={canWrite}
                activeSession={activeSession}
                onBack={() => setOpenId(null)}
                onChanged={load}
            />
        );
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-bold text-slate-700">
                    Members{" "}
                    {!loading && !error && (
                        <span className="text-xs font-medium text-slate-400">
                            {filtered.length === rows.length ? rows.length : `${filtered.length} of ${rows.length}`}
                        </span>
                    )}
                </h4>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={exportLatest}
                        disabled={loading || filtered.length === 0}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:opacity-40"
                    >
                        <Download className="h-4 w-4" aria-hidden="true" /> Latest
                    </button>
                    <button
                        type="button"
                        onClick={exportAll}
                        disabled={loading || exporting || filtered.length === 0}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:opacity-40"
                    >
                        {exporting ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
                        All semesters
                    </button>
                </div>
            </div>
            {exportError && <p role="alert" className="mb-3 text-xs text-red-600">{exportError}</p>}

            <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input
                        type="search"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Name, matric or department"
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
                    {levels.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <select
                    value={klass}
                    onChange={(e) => setKlass(e.target.value)}
                    aria-label="Filter by class of degree"
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-rcf-navy focus:outline-none sm:w-48"
                >
                    <option value="all">Any class</option>
                    {DEGREE_CLASSES.map((c) => <option key={c.id} value={c.label}>{c.label}</option>)}
                    <option value="none">No results yet</option>
                </select>
            </div>

            {loading ? (
                <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500" role="status">
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Loading records…
                </p>
            ) : error ? (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <p>{error}</p>
                    <button type="button" onClick={load} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600">
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
                    </button>
                </div>
            ) : (
                <PaginatedGrid
                    items={filtered}
                    label="Members' academic records"
                    resetKey={`${q}|${level}|${klass}`}
                    getKey={(r) => r.id}
                    empty={
                        <p className="rounded-xl border-2 border-dashed border-slate-100 py-10 text-center text-sm text-slate-400">
                            <User className="mx-auto mb-2 h-8 w-8 opacity-20" aria-hidden="true" />
                            Nobody matches that.
                        </p>
                    }
                    renderItem={(r) => (
                        <button
                            type="button"
                            onClick={() => setOpenId(r.id)}
                            className="flex h-full w-full items-start justify-between gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-rcf-navy/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                        >
                            <MemberAvatar url={r.avatarUrl} first={r.name.split(" ")[0]} last={r.name.split(" ").slice(-1)[0]} gender={r.gender} size={36} />
                            <span className="min-w-0 flex-1 space-y-0.5">
                                <span className="block truncate text-sm font-bold text-slate-800">{r.name}</span>
                                <span className="block truncate text-xs text-slate-500">
                                    {[r.level, r.department].filter(Boolean).join(" · ") || "—"}
                                </span>
                                <span className="block truncate text-[11px] text-slate-400">
                                    {r.latestLabel ? `Latest: ${r.latestLabel}` : "No results yet"}
                                </span>
                            </span>
                            {r.latestCgpa != null && (
                                <span className="shrink-0 text-right">
                                    <span className="block font-mono text-base font-bold text-rcf-navy">{r.latestCgpa.toFixed(2)}</span>
                                    <span className="block text-[10px] text-slate-500">{r.classLabel}</span>
                                </span>
                            )}
                        </button>
                    )}
                />
            )}
        </section>
    );
}

// ---------------------------------------------------------------------------
// One member's history
// ---------------------------------------------------------------------------

type History = Extract<Awaited<ReturnType<typeof getMemberHistoryAction>>, { success: true }>;

const entrySchema = z.object({
    session: z.string().refine(isValidSession, "Pick a session."),
    semester: z.enum(["1", "2"]),
    gpa: z.string().trim().refine((v) => parseGrade(v) != null, "0 to 5, up to two decimals"),
    cgpa: z.string().trim().refine((v) => parseGrade(v) != null, "0 to 5, up to two decimals"),
});
type EntryValues = z.infer<typeof entrySchema>;

function MemberHistory({
    profileId,
    canWrite,
    activeSession,
    onBack,
    onChanged,
}: {
    profileId: string;
    canWrite: boolean;
    activeSession: string | null;
    onBack: () => void;
    onChanged: () => void;
}) {
    const [data, setData] = useState<History | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState<{ session: string; semester: number; gpa: string; cgpa: string } | "new" | null>(null);
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();

    const load = useCallback(async () => {
        setError(null);
        try {
            const res = await getMemberHistoryAction(profileId);
            if (res.success) setData(res);
            else setError(res.error);
        } catch {
            setError("Couldn't reach the server. Check your connection and try again.");
        }
    }, [profileId]);

    useEffect(() => {
        const t = setTimeout(load, 0);
        return () => clearTimeout(t);
    }, [load]);

    const remove = (rec: History["records"][number]) =>
        showAlert({
            type: "warning",
            title: "Delete this semester?",
            message: `Remove ${rec.label} (GPA ${rec.gpa.toFixed(2)}, CGPA ${rec.cgpa.toFixed(2)}) from ${data?.member.name}'s record?`,
            confirmText: "Delete",
            onConfirm: async () => {
                try {
                    const res = await deleteMemberRecordAction(rec.id);
                    if (!res.success) {
                        showAlert({ type: "error", message: res.error });
                        return;
                    }
                    await load();
                    onChanged();
                } catch {
                    showAlert({ type: "error", message: "Couldn't reach the server. Try again." });
                }
            },
        });

    return (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />
            <button
                type="button"
                onClick={onBack}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-slate-600 hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
            >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All members
            </button>

            {error ? (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <p>{error}</p>
                    <button type="button" onClick={load} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold underline-offset-2 hover:underline">
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
                    </button>
                </div>
            ) : !data ? (
                <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500" role="status">
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Loading…
                </p>
            ) : (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-lg font-bold text-slate-800">{data.member.name}</h4>
                        {canWrite && editing === null && (
                            <button
                                type="button"
                                onClick={() => setEditing("new")}
                                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                            >
                                <Plus className="h-4 w-4" aria-hidden="true" /> Add semester
                            </button>
                        )}
                    </div>

                    {editing !== null && (
                        <EntryForm
                            profileId={profileId}
                            activeSession={activeSession}
                            initial={editing === "new" ? null : editing}
                            onCancel={() => setEditing(null)}
                            onSaved={async () => {
                                setEditing(null);
                                await load();
                                onChanged();
                            }}
                        />
                    )}

                    {data.records.length === 0 ? (
                        <p className="rounded-xl border-2 border-dashed border-slate-100 py-8 text-center text-sm text-slate-400">
                            No results on record.
                        </p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {[...data.records].reverse().map((r) => (
                                <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-800">{r.label}</p>
                                        <p className="text-xs text-slate-500">
                                            GPA <span className="font-mono">{r.gpa.toFixed(2)}</span> · CGPA{" "}
                                            <span className="font-mono font-bold text-rcf-navy">{r.cgpa.toFixed(2)}</span>
                                            {r.source === "coordinator" && " · entered by the Academic Unit"}
                                        </p>
                                    </div>
                                    {canWrite && (
                                        <div className="flex shrink-0 gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setEditing({ session: r.session, semester: r.semester, gpa: r.gpa.toFixed(2), cgpa: r.cgpa.toFixed(2) })}
                                                aria-label={`Correct ${r.label}`}
                                                className="rounded-full p-2.5 text-slate-400 hover:bg-slate-100 hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                                            >
                                                <Pencil className="h-4 w-4" aria-hidden="true" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => remove(r)}
                                                aria-label={`Delete ${r.label}`}
                                                className="rounded-full p-2.5 text-slate-400 hover:bg-red-50 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                            >
                                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                            </button>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </section>
    );
}

function EntryForm({
    profileId,
    activeSession,
    initial,
    onCancel,
    onSaved,
}: {
    profileId: string;
    activeSession: string | null;
    initial: { session: string; semester: number; gpa: string; cgpa: string } | null;
    onCancel: () => void;
    onSaved: () => void;
}) {
    const id = useId();
    const [serverError, setServerError] = useState<string | null>(null);
    const start = sessionStartYear(activeSession) ?? new Date().getFullYear();
    const sessions = Array.from({ length: 7 }, (_, i) => sessionFor(start + 1 - i));
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<EntryValues>({
        resolver: zodResolver(entrySchema),
        defaultValues: initial
            ? { session: initial.session, semester: String(initial.semester) as "1" | "2", gpa: initial.gpa, cgpa: initial.cgpa }
            : { session: sessionFor(start), semester: "1", gpa: "", cgpa: "" },
    });

    const onSubmit = async (v: EntryValues) => {
        setServerError(null);
        try {
            const res = await saveMemberRecordAction({ profileId, session: v.session, semester: Number(v.semester), gpa: v.gpa, cgpa: v.cgpa });
            if (!res.success) {
                setServerError(res.error);
                return;
            }
            onSaved();
        } catch {
            setServerError("Couldn't reach the server. Nothing was saved; try again.");
        }
    };

    const err = (k: keyof EntryValues) =>
        errors[k] ? <p role="alert" className="text-xs text-red-600">{errors[k]?.message}</p> : null;

    return (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {initial ? (
                    // Correcting a semester: which semester it is stays fixed. (Values
                    // come from defaultValues; a disabled field would submit nothing.)
                    <p className="col-span-2 self-end pb-3 text-sm font-bold text-slate-700">
                        {initial.session} · {SEMESTER_NAMES[initial.semester as 1 | 2]}
                    </p>
                ) : (
                    <>
                        <div className="space-y-1">
                            <label htmlFor={`${id}-s`} className="text-xs font-medium text-gray-700">Session</label>
                            <FormSelect id={`${id}-s`} {...register("session")}>
                                {sessions.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </FormSelect>
                            {err("session")}
                        </div>
                        <div className="space-y-1">
                            <label htmlFor={`${id}-sem`} className="text-xs font-medium text-gray-700">Semester</label>
                            <FormSelect id={`${id}-sem`} {...register("semester")}>
                                <option value="1">{SEMESTER_NAMES[1]}</option>
                                <option value="2">{SEMESTER_NAMES[2]}</option>
                            </FormSelect>
                        </div>
                    </>
                )}
                <div className="space-y-1">
                    <label htmlFor={`${id}-g`} className="text-xs font-medium text-gray-700">GPA</label>
                    <FormInput id={`${id}-g`} inputMode="decimal" className="font-mono" {...register("gpa")} />
                    {err("gpa")}
                </div>
                <div className="space-y-1">
                    <label htmlFor={`${id}-c`} className="text-xs font-medium text-gray-700">CGPA</label>
                    <FormInput id={`${id}-c`} inputMode="decimal" className="font-mono" {...register("cgpa")} />
                    {err("cgpa")}
                </div>
            </div>
            {serverError && <p role="alert" className="text-sm text-red-700">{serverError}</p>}
            <div className="flex gap-2">
                <button type="submit" disabled={isSubmitting} className="btn-primary flex h-10 items-center gap-2 px-4 text-sm disabled:opacity-60">
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                    {isSubmitting ? "Saving…" : initial ? "Save correction" : "Add"}
                </button>
                <button type="button" onClick={onCancel} className="h-10 rounded-xl px-4 text-sm font-bold text-slate-600 hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy">
                    Cancel
                </button>
            </div>
        </form>
    );
}
