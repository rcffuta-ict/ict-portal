"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Archive, ArchiveRestore, Link2, Loader2, Pencil, Plus, RefreshCw, Search } from "lucide-react";
import { useAlertModal, AlertModal } from "@/components/ui/alert-modal";
import FormInput from "@/components/ui/FormInput";
import FormSelect from "@/components/ui/FormSelect";
import type { Faculty } from "@/lib/departments";
import {
    createDepartmentAction,
    getDepartmentsAdminAction,
    linkDepartmentTextAction,
    saveFacultyAction,
    setDepartmentActiveAction,
    updateDepartmentAction,
} from "../actions";

type Data = Awaited<ReturnType<typeof getDepartmentsAdminAction>>;
type Dept = Data["departments"][number];

const deptSchema = z.object({
    alias: z.string().trim().regex(/^[A-Za-z]{2,10}$/, "2 to 10 letters, e.g. CSC"),
    name: z.string().trim().min(3, "Enter the full name."),
    facultyCode: z.string().min(1, "Pick a school."),
});
type DeptValues = z.infer<typeof deptSchema>;

/**
 * FUTA's schools and departments, as the forms offer them. A department is retired,
 * never deleted: members' records point at it. Profiles whose typed-in department
 * never matched one are listed at the end, to be linked by hand.
 */
export function DepartmentsPanel({ canWrite }: { canWrite: boolean }) {
    const [data, setData] = useState<Data | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [q, setQ] = useState("");
    const [showRetired, setShowRetired] = useState(false);
    const [editing, setEditing] = useState<Dept | "new" | null>(null);
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();

    const load = useCallback(async () => {
        setError(null);
        try {
            const res = await getDepartmentsAdminAction();
            if (res.success) setData(res);
            else setError(res.error);
        } catch {
            setError("Couldn't reach the server. Check your connection and try again.");
        }
    }, []);

    useEffect(() => {
        const t = setTimeout(load, 0);
        return () => clearTimeout(t);
    }, [load]);

    const groups = useMemo(() => {
        if (!data?.success) return [];
        const needle = q.trim().toLowerCase();
        const byFaculty = new Map<string, Dept[]>();
        for (const d of data.departments) {
            if (!showRetired && !d.isActive) continue;
            if (needle && !d.name.toLowerCase().includes(needle) && !d.alias.toLowerCase().includes(needle)) continue;
            byFaculty.set(d.facultyCode, [...(byFaculty.get(d.facultyCode) ?? []), d]);
        }
        return data.faculties
            .map((f) => ({ faculty: f, departments: byFaculty.get(f.code) ?? [] }))
            .filter((g) => g.departments.length > 0 || (!needle && canWrite));
    }, [data, q, showRetired, canWrite]);

    const toggleActive = (d: Dept) =>
        showAlert({
            type: "warning",
            title: d.isActive ? `Retire ${d.alias}?` : `Restore ${d.alias}?`,
            message: d.isActive
                ? `${d.name} will no longer be offered on forms. The ${d.members} member(s) recorded in it keep it.`
                : `${d.name} will be offered on forms again.`,
            confirmText: d.isActive ? "Retire" : "Restore",
            onConfirm: async () => {
                try {
                    const res = await setDepartmentActiveAction(d.id, !d.isActive);
                    if (!res.success) return showAlert({ type: "error", message: res.error });
                    await load();
                } catch {
                    showAlert({ type: "error", message: "Couldn't reach the server. Try again." });
                }
            },
        });

    if (error) {
        return (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <p>{error}</p>
                <button type="button" onClick={load} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold underline-offset-2 hover:underline">
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
                </button>
            </div>
        );
    }
    if (!data?.success) {
        return (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500" role="status">
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Loading departments…
            </p>
        );
    }

    return (
        <div className="space-y-5">
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-bold text-slate-700">
                        Departments <span className="text-xs font-medium text-slate-400">{data.departments.filter((d) => d.isActive).length} active</span>
                    </h4>
                    {canWrite && editing === null && (
                        <button
                            type="button"
                            onClick={() => setEditing("new")}
                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                        >
                            <Plus className="h-4 w-4" aria-hidden="true" /> Add department
                        </button>
                    )}
                </div>

                {editing !== null && (
                    <DepartmentForm
                        faculties={data.faculties}
                        initial={editing === "new" ? null : editing}
                        onCancel={() => setEditing(null)}
                        onSaved={async () => {
                            setEditing(null);
                            await load();
                        }}
                    />
                )}

                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                        <input
                            type="search"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search name or code"
                            aria-label="Search departments"
                            className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rcf-navy focus:outline-none"
                        />
                    </div>
                    <label className="flex h-11 items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} className="h-4 w-4" />
                        Show retired
                    </label>
                </div>

                <div className="space-y-5">
                    {groups.map(({ faculty, departments }) => (
                        <div key={faculty.code}>
                            <FacultyHeading faculty={faculty} canWrite={canWrite} onSaved={load} />
                            {departments.length === 0 ? (
                                <p className="py-2 text-xs text-slate-400">No departments.</p>
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {departments.map((d) => (
                                        <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                                            <div className="min-w-0">
                                                <p className={`truncate text-sm font-semibold ${d.isActive ? "text-slate-800" : "text-slate-400 line-through"}`}>
                                                    {d.name}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    <span className="font-mono">{d.alias}</span> · {d.members} member{d.members === 1 ? "" : "s"}
                                                    {!d.isActive && " · retired"}
                                                </p>
                                            </div>
                                            {canWrite && (
                                                <div className="flex shrink-0 gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditing(d)}
                                                        aria-label={`Edit ${d.name}`}
                                                        className="rounded-full p-2.5 text-slate-400 hover:bg-slate-100 hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                                                    >
                                                        <Pencil className="h-4 w-4" aria-hidden="true" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleActive(d)}
                                                        aria-label={d.isActive ? `Retire ${d.name}` : `Restore ${d.name}`}
                                                        className="rounded-full p-2.5 text-slate-400 hover:bg-slate-100 hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                                                    >
                                                        {d.isActive ? <Archive className="h-4 w-4" aria-hidden="true" /> : <ArchiveRestore className="h-4 w-4" aria-hidden="true" />}
                                                    </button>
                                                </div>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>

                {canWrite && <NewFacultyForm onSaved={load} />}
            </section>

            {data.unmatched.length > 0 && (
                <UnmatchedList
                    unmatched={data.unmatched}
                    departments={data.departments.filter((d) => d.isActive)}
                    canWrite={canWrite}
                    onLinked={load}
                />
            )}
        </div>
    );
}

function DepartmentForm({
    faculties,
    initial,
    onCancel,
    onSaved,
}: {
    faculties: Faculty[];
    initial: Dept | null;
    onCancel: () => void;
    onSaved: () => void;
}) {
    const id = useId();
    const [serverError, setServerError] = useState<string | null>(null);
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<DeptValues>({
        resolver: zodResolver(deptSchema),
        defaultValues: initial
            ? { alias: initial.alias, name: initial.name, facultyCode: initial.facultyCode }
            : { alias: "", name: "", facultyCode: "" },
    });

    const onSubmit = async (v: DeptValues) => {
        setServerError(null);
        try {
            const res = initial ? await updateDepartmentAction(initial.id, v) : await createDepartmentAction(v);
            if (!res.success) return setServerError(res.error);
            onSaved();
        } catch {
            setServerError("Couldn't reach the server. Nothing was saved; try again.");
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-bold text-slate-700">{initial ? `Edit ${initial.alias}` : "New department"}</p>
            <div className="grid gap-3 sm:grid-cols-[8rem_1fr_1fr]">
                <div className="space-y-1">
                    <label htmlFor={`${id}-a`} className="text-xs font-medium text-gray-700">Code</label>
                    <FormInput id={`${id}-a`} autoCapitalize="characters" className="font-mono uppercase" placeholder="CSC" {...register("alias")} />
                    {errors.alias && <p role="alert" className="text-xs text-red-600">{errors.alias.message}</p>}
                </div>
                <div className="space-y-1">
                    <label htmlFor={`${id}-n`} className="text-xs font-medium text-gray-700">Full name</label>
                    <FormInput id={`${id}-n`} placeholder="Computer Science" {...register("name")} />
                    {errors.name && <p role="alert" className="text-xs text-red-600">{errors.name.message}</p>}
                </div>
                <div className="space-y-1">
                    <label htmlFor={`${id}-f`} className="text-xs font-medium text-gray-700">School</label>
                    <FormSelect id={`${id}-f`} {...register("facultyCode")}>
                        <option value="">Select school</option>
                        {faculties.map((f) => (
                            <option key={f.code} value={f.code}>{f.name}</option>
                        ))}
                    </FormSelect>
                    {errors.facultyCode && <p role="alert" className="text-xs text-red-600">{errors.facultyCode.message}</p>}
                </div>
            </div>
            {initial && (
                <p className="text-xs text-slate-500">
                    Changing the code or school updates the {initial.members} member record(s) in this department too.
                </p>
            )}
            {serverError && <p role="alert" className="text-sm text-red-700">{serverError}</p>}
            <div className="flex gap-2">
                <button type="submit" disabled={isSubmitting} className="btn-primary flex h-10 items-center gap-2 px-4 text-sm disabled:opacity-60">
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                    {isSubmitting ? "Saving…" : "Save"}
                </button>
                <button type="button" onClick={onCancel} className="h-10 rounded-xl px-4 text-sm font-bold text-slate-600 hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy">
                    Cancel
                </button>
            </div>
        </form>
    );
}

/** A school's name as a heading; writers can rename it in place. */
function FacultyHeading({ faculty, canWrite, onSaved }: { faculty: Faculty; canWrite: boolean; onSaved: () => void }) {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(faculty.name);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const save = async () => {
        setSaving(true);
        setErr(null);
        try {
            const res = await saveFacultyAction({ code: faculty.code, name, isNew: false });
            if (!res.success) setErr(res.error);
            else {
                setEditing(false);
                onSaved();
            }
        } catch {
            setErr("Couldn't reach the server. Try again.");
        }
        setSaving(false);
    };

    if (!editing) {
        return (
            <h5 className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                {faculty.name} <span className="font-mono text-slate-400">{faculty.code}</span>
                {canWrite && (
                    <button
                        type="button"
                        onClick={() => setEditing(true)}
                        aria-label={`Rename ${faculty.name}`}
                        className="rounded-full p-1.5 text-slate-400 hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                    >
                        <Pencil className="h-3 w-3" aria-hidden="true" />
                    </button>
                )}
            </h5>
        );
    }
    return (
        <div className="mb-2 space-y-1">
            <div className="flex gap-2">
                <FormInput value={name} onChange={(e) => setName(e.target.value)} aria-label={`New name for ${faculty.code}`} />
                <button type="button" onClick={save} disabled={saving} className="btn-primary h-12 shrink-0 px-4 text-sm disabled:opacity-60">
                    {saving ? "Saving…" : "Save"}
                </button>
                <button type="button" onClick={() => setEditing(false)} className="h-12 shrink-0 px-2 text-sm font-bold text-slate-600">
                    Cancel
                </button>
            </div>
            {err && <p role="alert" className="text-xs text-red-600">{err}</p>}
        </div>
    );
}

function NewFacultyForm({ onSaved }: { onSaved: () => void }) {
    const [open, setOpen] = useState(false);
    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const save = async () => {
        setSaving(true);
        setErr(null);
        try {
            const res = await saveFacultyAction({ code, name, isNew: true });
            if (!res.success) setErr(res.error);
            else {
                setOpen(false);
                setCode("");
                setName("");
                onSaved();
            }
        } catch {
            setErr("Couldn't reach the server. Try again.");
        }
        setSaving(false);
    };

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl px-2 text-xs font-bold text-slate-500 hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
            >
                <Plus className="h-4 w-4" aria-hidden="true" /> Add a school
            </button>
        );
    }
    return (
        <div className="mt-5 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-bold text-slate-700">New school</p>
            <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
                <FormInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="SOC" aria-label="School code" className="font-mono uppercase" />
                <FormInput value={name} onChange={(e) => setName(e.target.value)} placeholder="School of Computing" aria-label="School name" />
            </div>
            {err && <p role="alert" className="text-xs text-red-600">{err}</p>}
            <div className="flex gap-2">
                <button type="button" onClick={save} disabled={saving} className="btn-primary h-10 px-4 text-sm disabled:opacity-60">
                    {saving ? "Saving…" : "Add school"}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="h-10 px-3 text-sm font-bold text-slate-600">
                    Cancel
                </button>
            </div>
        </div>
    );
}

/** Typed-in departments that match nothing on the list, to be linked by hand. */
function UnmatchedList({
    unmatched,
    departments,
    canWrite,
    onLinked,
}: {
    unmatched: { text: string; members: number }[];
    departments: Dept[];
    canWrite: boolean;
    onLinked: () => void;
}) {
    return (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm sm:p-5">
            <h4 className="flex items-center gap-2 font-bold text-slate-700">
                <Link2 className="h-4 w-4" aria-hidden="true" /> Not matched to a department
            </h4>
            <p className="mb-3 mt-1 text-xs text-slate-600">
                These were typed in by hand and don&apos;t match any department, so they&apos;re left out of the
                department figures.{canWrite && " Link each to the right one."}
            </p>
            <ul className="divide-y divide-amber-100">
                {unmatched.map((u) => (
                    <UnmatchedRow key={u.text} item={u} departments={departments} canWrite={canWrite} onLinked={onLinked} />
                ))}
            </ul>
        </section>
    );
}

function UnmatchedRow({
    item,
    departments,
    canWrite,
    onLinked,
}: {
    item: { text: string; members: number };
    departments: Dept[];
    canWrite: boolean;
    onLinked: () => void;
}) {
    const [pick, setPick] = useState("");
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const link = async () => {
        setSaving(true);
        setErr(null);
        try {
            const res = await linkDepartmentTextAction(item.text, pick);
            if (!res.success) setErr(res.error);
            else onLinked();
        } catch {
            setErr("Couldn't reach the server. Try again.");
        }
        setSaving(false);
    };

    return (
        <li className="space-y-2 py-3">
            <p className="text-sm">
                <span className="font-semibold text-slate-800">&ldquo;{item.text}&rdquo;</span>{" "}
                <span className="text-xs text-slate-500">· {item.members} member{item.members === 1 ? "" : "s"}</span>
            </p>
            {canWrite && (
                <div className="flex flex-col gap-2 sm:flex-row">
                    <FormSelect value={pick} onChange={(e) => setPick(e.target.value)} aria-label={`Department for ${item.text}`}>
                        <option value="">Link to…</option>
                        {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name} ({d.alias})</option>
                        ))}
                    </FormSelect>
                    <button
                        type="button"
                        onClick={link}
                        disabled={!pick || saving}
                        className="btn-primary flex h-12 shrink-0 items-center justify-center gap-2 px-4 text-sm disabled:opacity-60"
                    >
                        {saving && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                        Link
                    </button>
                </div>
            )}
            {err && <p role="alert" className="text-xs text-red-600">{err}</p>}
        </li>
    );
}
