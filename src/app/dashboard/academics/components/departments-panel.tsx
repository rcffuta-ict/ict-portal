"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    Archive,
    ArchiveRestore,
    Building2,
    ChevronDown,
    ChevronsDownUp,
    ChevronsUpDown,
    Landmark,
    Link2,
    Loader2,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    Sparkles,
    Unlink,
    Users,
    X,
} from "lucide-react";
import { useAlertModal, AlertModal } from "@/components/ui/alert-modal";
import FormInput from "@/components/ui/FormInput";
import FormSelect from "@/components/ui/FormSelect";
import { StatsSkeleton, StatsStrip } from "@/components/dashboard/roster/stats-strip";
import { PaginatedGrid } from "@/components/dashboard/roster/paginated-grid";
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

type Status = "active" | "retired" | "all";
type MemberFilter = "any" | "with" | "none";
type Sort = "name" | "code" | "most" | "fewest";

const SORTS: Record<Sort, { label: string; compare: (a: Dept, b: Dept) => number }> = {
    name: { label: "Name (A–Z)", compare: (a, b) => a.name.localeCompare(b.name) },
    code: { label: "Code (A–Z)", compare: (a, b) => a.alias.localeCompare(b.alias) },
    most: { label: "Most members", compare: (a, b) => b.members - a.members || a.name.localeCompare(b.name) },
    fewest: { label: "Fewest members", compare: (a, b) => a.members - b.members || a.name.localeCompare(b.name) },
};

const selectClass =
    "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-rcf-navy focus:outline-none";

/**
 * FUTA's schools and departments, as every form offers them.
 *
 * Nearly sixty departments is too many to scan, so the tab opens on the SCHOOLS,
 * collapsed, each with its count; search, a school, a status or a member filter turns
 * it into one flat, sorted list of just the matches. A department is retired, never
 * deleted: members' records point at it. Typed-in departments that match nothing are
 * listed at the end, each with a suggested match.
 */
export function DepartmentsPanel({ canWrite }: { canWrite: boolean }) {
    const [data, setData] = useState<Data | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [q, setQ] = useState("");
    const [faculty, setFaculty] = useState("all");
    const [status, setStatus] = useState<Status>("active");
    const [memberFilter, setMemberFilter] = useState<MemberFilter>("any");
    const [sort, setSort] = useState<Sort>("name");
    const [open, setOpen] = useState<Set<string>>(new Set());
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

    const departments = useMemo(() => (data?.success ? data.departments : []), [data]);
    const faculties = useMemo(() => (data?.success ? data.faculties : []), [data]);
    const facultyName = useMemo(() => new Map(faculties.map((f) => [f.code, f.name])), [faculties]);

    // Status is applied first, so the school counts in the picker match what you'd see.
    const byStatus = departments.filter((d) => status === "all" || (status === "active" ? d.isActive : !d.isActive));
    const needle = q.trim().toLowerCase();
    const matches = byStatus
        .filter(
            (d) =>
                (faculty === "all" || d.facultyCode === faculty) &&
                (memberFilter === "any" || (memberFilter === "with" ? d.members > 0 : d.members === 0)) &&
                (!needle ||
                    d.name.toLowerCase().includes(needle) ||
                    d.alias.toLowerCase().includes(needle) ||
                    (facultyName.get(d.facultyCode) ?? "").toLowerCase().includes(needle)),
        )
        .sort(SORTS[sort].compare);

    // Narrowed down → one flat list of matches. Otherwise → schools to open.
    const narrowed = !!needle || faculty !== "all" || memberFilter !== "any";
    const filtersOn = narrowed || status !== "active" || sort !== "name";
    const clearFilters = () => {
        setQ("");
        setFaculty("all");
        setStatus("active");
        setMemberFilter("any");
        setSort("name");
    };

    const groups = faculties
        .map((f) => ({ faculty: f, departments: matches.filter((d) => d.facultyCode === f.code) }))
        .filter((g) => g.departments.length > 0 || (canWrite && status !== "retired"));
    const allOpen = groups.length > 0 && groups.every((g) => open.has(g.faculty.code));
    const toggleGroup = (code: string) =>
        setOpen((prev) => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code);
            else next.add(code);
            return next;
        });

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
            <div className="space-y-4">
                <p className="flex items-center justify-center gap-2 py-2 text-sm text-slate-500" role="status">
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Loading departments…
                </p>
                <StatsSkeleton />
            </div>
        );
    }

    const active = departments.filter((d) => d.isActive);
    const linked = departments.reduce((n, d) => n + d.members, 0);
    const unlinked = data.unmatched.reduce((n, u) => n + u.members, 0);
    const statusCount = (s: Status) =>
        departments.filter((d) => s === "all" || (s === "active" ? d.isActive : !d.isActive)).length;

    const row = (d: Dept, showSchool: boolean) => (
        <DepartmentRow
            key={d.id}
            dept={d}
            school={showSchool ? (facultyName.get(d.facultyCode) ?? d.facultyCode) : null}
            canWrite={canWrite}
            onEdit={() => setEditing(d)}
            onToggle={() => toggleActive(d)}
        />
    );

    return (
        <div className="space-y-5">
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />

            <StatsStrip
                items={[
                    { label: "Schools", value: faculties.length, icon: Landmark, tone: "text-slate-700 bg-slate-100" },
                    { label: "Departments", value: active.length, icon: Building2, tone: "text-sky-700 bg-sky-50" },
                    { label: "Members linked", value: linked, icon: Users, tone: "text-emerald-700 bg-emerald-50" },
                    { label: "Not linked", value: unlinked, icon: Unlink, tone: "text-amber-700 bg-amber-50" },
                    { label: "Retired", value: departments.length - active.length, icon: Archive, tone: "text-slate-600 bg-slate-100" },
                ]}
            />

            {data.unmatched.length > 0 && (
                <a
                    href="#unmatched-departments"
                    className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
                >
                    <Link2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {unlinked} member{unlinked === 1 ? "'s" : "s'"} department didn&apos;t match the list. Review below.
                </a>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-bold text-slate-700">Departments</h4>
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
                        faculties={faculties}
                        initial={editing === "new" ? null : editing}
                        onCancel={() => setEditing(null)}
                        onSaved={async () => {
                            setEditing(null);
                            await load();
                        }}
                    />
                )}

                {/* Filters. Stacked on a phone, one row from `lg`. */}
                <div className="space-y-2">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                        <input
                            type="search"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search a department, code or school"
                            aria-label="Search departments"
                            className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rcf-navy focus:outline-none"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                        <select value={faculty} onChange={(e) => setFaculty(e.target.value)} aria-label="School" className={`col-span-2 lg:col-span-1 ${selectClass}`}>
                            <option value="all">All schools</option>
                            {faculties.map((f) => (
                                <option key={f.code} value={f.code}>
                                    {f.name} ({byStatus.filter((d) => d.facultyCode === f.code).length})
                                </option>
                            ))}
                        </select>
                        <select value={memberFilter} onChange={(e) => setMemberFilter(e.target.value as MemberFilter)} aria-label="Members" className={selectClass}>
                            <option value="any">Any members</option>
                            <option value="with">Has members</option>
                            <option value="none">No members yet</option>
                        </select>
                        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort by" className={selectClass}>
                            {(Object.keys(SORTS) as Sort[]).map((s) => (
                                <option key={s} value={s}>{SORTS[s].label}</option>
                            ))}
                        </select>
                        <div role="group" aria-label="Status" className="col-span-2 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 lg:col-span-1">
                            {(["active", "retired", "all"] as Status[]).map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    aria-pressed={status === s}
                                    onClick={() => setStatus(s)}
                                    className={`h-9 rounded-lg text-xs font-bold capitalize focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy ${
                                        status === s ? "bg-white text-rcf-navy shadow-sm" : "text-slate-500 hover:text-rcf-navy"
                                    }`}
                                >
                                    {s} <span className="font-medium opacity-60">{statusCount(s)}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="my-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500" aria-live="polite">
                    <span>
                        {narrowed
                            ? `${matches.length} of ${byStatus.length} ${status === "all" ? "" : `${status} `}departments`
                            : `${matches.length} ${status === "all" ? "" : `${status} `}departments in ${groups.filter((g) => g.departments.length).length} schools`}
                    </span>
                    <span className="flex items-center gap-3">
                        {filtersOn && (
                            <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 font-bold text-rcf-navy hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy">
                                <X className="h-3.5 w-3.5" aria-hidden="true" /> Clear filters
                            </button>
                        )}
                        {!narrowed && groups.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setOpen(allOpen ? new Set() : new Set(groups.map((g) => g.faculty.code)))}
                                className="inline-flex items-center gap-1 font-bold text-slate-600 hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                            >
                                {allOpen ? <ChevronsDownUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronsUpDown className="h-3.5 w-3.5" aria-hidden="true" />}
                                {allOpen ? "Collapse all" : "Expand all"}
                            </button>
                        )}
                    </span>
                </div>

                {narrowed ? (
                    <PaginatedGrid
                        items={matches}
                        label="Matching departments"
                        resetKey={`${q}|${faculty}|${status}|${memberFilter}|${sort}`}
                        getKey={(d) => d.id}
                        empty={
                            <p className="rounded-xl border-2 border-dashed border-slate-100 py-10 text-center text-sm text-slate-400">
                                No department matches that.{" "}
                                <button type="button" onClick={clearFilters} className="font-bold text-rcf-navy hover:underline">
                                    Clear filters
                                </button>
                            </p>
                        }
                        renderItem={(d) => row(d, faculty === "all")}
                    />
                ) : groups.length === 0 ? (
                    <p className="rounded-xl border-2 border-dashed border-slate-100 py-10 text-center text-sm text-slate-400">
                        {status === "retired" ? "No retired departments." : "No departments yet."}
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {groups.map((g) => (
                            <SchoolGroup
                                key={g.faculty.code}
                                faculty={g.faculty}
                                departments={g.departments}
                                expanded={open.has(g.faculty.code)}
                                onToggle={() => toggleGroup(g.faculty.code)}
                                canWrite={canWrite}
                                onRenamed={load}
                                renderRow={(d) => row(d, false)}
                            />
                        ))}
                    </ul>
                )}

                {canWrite && <NewFacultyForm onSaved={load} />}
            </section>

            {data.unmatched.length > 0 && (
                <UnmatchedList
                    unmatched={data.unmatched}
                    departments={active}
                    faculties={faculties}
                    canWrite={canWrite}
                    onLinked={load}
                />
            )}
        </div>
    );
}

/** One department, as a card (flat list) or inside its school. */
function DepartmentRow({
    dept: d,
    school,
    canWrite,
    onEdit,
    onToggle,
}: {
    dept: Dept;
    /** Shown in the flat list, where the school isn't the heading. */
    school: string | null;
    canWrite: boolean;
    onEdit: () => void;
    onToggle: () => void;
}) {
    return (
        <div className={`flex h-full items-center justify-between gap-3 rounded-xl border p-3 ${d.isActive ? "border-slate-200" : "border-dashed border-slate-200 bg-slate-50"}`}>
            <div className="min-w-0">
                <p className={`truncate text-sm font-semibold ${d.isActive ? "text-slate-800" : "text-slate-400 line-through"}`}>{d.name}</p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                    <span className="rounded bg-slate-100 px-1.5 font-mono font-bold text-slate-600">{d.alias}</span>
                    <span className={d.members === 0 ? "text-slate-400" : undefined}>
                        {d.members} member{d.members === 1 ? "" : "s"}
                    </span>
                    {!d.isActive && <span className="font-bold uppercase text-slate-400">retired</span>}
                    {school && <span className="truncate text-slate-400">{school}</span>}
                </p>
            </div>
            {canWrite && (
                <div className="flex shrink-0 gap-1">
                    <button
                        type="button"
                        onClick={onEdit}
                        aria-label={`Edit ${d.name}`}
                        className="rounded-full p-2.5 text-slate-400 hover:bg-slate-100 hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                    >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={onToggle}
                        aria-label={d.isActive ? `Retire ${d.name}` : `Restore ${d.name}`}
                        className="rounded-full p-2.5 text-slate-400 hover:bg-slate-100 hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                    >
                        {d.isActive ? <Archive className="h-4 w-4" aria-hidden="true" /> : <ArchiveRestore className="h-4 w-4" aria-hidden="true" />}
                    </button>
                </div>
            )}
        </div>
    );
}

/** A school: a header that opens to its departments. Writers can rename it inside. */
function SchoolGroup({
    faculty,
    departments,
    expanded,
    onToggle,
    canWrite,
    onRenamed,
    renderRow,
}: {
    faculty: Faculty;
    departments: Dept[];
    expanded: boolean;
    onToggle: () => void;
    canWrite: boolean;
    onRenamed: () => void;
    renderRow: (d: Dept) => React.ReactNode;
}) {
    const id = useId();
    const members = departments.reduce((n, d) => n + d.members, 0);
    return (
        <li className="overflow-hidden rounded-xl border border-slate-200">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={expanded}
                aria-controls={`${id}-body`}
                className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rcf-navy"
            >
                <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-800">{faculty.name}</span>
                    <span className="block text-xs text-slate-500">
                        <span className="font-mono">{faculty.code}</span> · {departments.length} department{departments.length === 1 ? "" : "s"} · {members} member{members === 1 ? "" : "s"}
                    </span>
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            {expanded && (
                <div id={`${id}-body`} className="space-y-2 border-t border-slate-100 bg-slate-50/40 p-3">
                    {canWrite && <FacultyRename faculty={faculty} onSaved={onRenamed} />}
                    {departments.length === 0 ? (
                        <p className="py-2 text-xs text-slate-400">No departments here yet.</p>
                    ) : (
                        <ul className="grid gap-2 sm:grid-cols-2">
                            {departments.map((d) => (
                                <li key={d.id} className="min-w-0">{renderRow(d)}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </li>
    );
}

/** Rename a school in place. */
function FacultyRename({ faculty, onSaved }: { faculty: Faculty; onSaved: () => void }) {
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
            <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
            >
                <Pencil className="h-3 w-3" aria-hidden="true" /> Rename school
            </button>
        );
    }
    return (
        <div className="space-y-1">
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

// ---------------------------------------------------------------------------
// Typed-in departments that match nothing
// ---------------------------------------------------------------------------

const FILLER = new Set(["and", "of", "the", "in", "science", "sciences", "technology", "dept", "department"]);

function words(text: string): Set<string> {
    return new Set(
        text
            .toLowerCase()
            .replace(/&/g, " and ")
            .split(/[^a-z0-9]+/)
            .filter((w) => w.length > 1 && !FILLER.has(w)),
    );
}

/**
 * The department a typed-in value most likely means, or null. A code at the start
 * ("CSC 300L") wins outright; otherwise the most shared words ("Civil Engineering" →
 * Civil and Environmental Engineering). Only a suggestion: nothing is linked until a
 * person confirms it.
 */
function suggest(text: string, departments: Dept[]): Dept | null {
    const lead = text.trim().toUpperCase().match(/^[A-Z]{2,10}\b/)?.[0];
    const byCode = lead ? departments.find((d) => d.alias === lead) : undefined;
    if (byCode) return byCode;
    const mine = words(text);
    if (mine.size === 0) return null;
    let best: Dept | null = null;
    let bestScore = 0;
    for (const d of departments) {
        const theirs = words(d.name);
        const shared = [...mine].filter((w) => theirs.has(w)).length;
        const score = shared / new Set([...mine, ...theirs]).size;
        if (score > bestScore) {
            best = d;
            bestScore = score;
        }
    }
    return bestScore >= 0.34 ? best : null;
}

function UnmatchedList({
    unmatched,
    departments,
    faculties,
    canWrite,
    onLinked,
}: {
    unmatched: { text: string; members: number }[];
    departments: Dept[];
    faculties: Faculty[];
    canWrite: boolean;
    onLinked: () => void;
}) {
    const [q, setQ] = useState("");
    const needle = q.trim().toLowerCase();
    const shown = unmatched.filter((u) => !needle || u.text.toLowerCase().includes(needle));
    const members = unmatched.reduce((n, u) => n + u.members, 0);

    return (
        <section id="unmatched-departments" className="scroll-mt-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm sm:p-5">
            <h4 className="flex items-center gap-2 font-bold text-slate-700">
                <Link2 className="h-4 w-4" aria-hidden="true" /> Not matched to a department
                <span className="text-xs font-medium text-slate-500">
                    {unmatched.length} spelling{unmatched.length === 1 ? "" : "s"} · {members} member{members === 1 ? "" : "s"}
                </span>
            </h4>
            <p className="mb-3 mt-1 text-xs text-slate-600">
                Typed in by hand and matching no department, so these members are left out of the department figures.
                {canWrite && " A likely match is picked where there is one. Check it, then link."}
            </p>
            {unmatched.length > 6 && (
                <div className="relative mb-2">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input
                        type="search"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search these"
                        aria-label="Search unmatched departments"
                        className="h-11 w-full rounded-xl border border-amber-200 bg-white pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rcf-navy focus:outline-none"
                    />
                </div>
            )}
            <ul className="divide-y divide-amber-100">
                {shown.map((u) => (
                    <UnmatchedRow
                        key={u.text}
                        item={u}
                        departments={departments}
                        faculties={faculties}
                        canWrite={canWrite}
                        onLinked={onLinked}
                    />
                ))}
            </ul>
        </section>
    );
}

function UnmatchedRow({
    item,
    departments,
    faculties,
    canWrite,
    onLinked,
}: {
    item: { text: string; members: number };
    departments: Dept[];
    faculties: Faculty[];
    canWrite: boolean;
    onLinked: () => void;
}) {
    const suggestion = useMemo(() => suggest(item.text, departments), [item.text, departments]);
    const [pick, setPick] = useState(suggestion?.id ?? "");
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
                <>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <FormSelect value={pick} onChange={(e) => setPick(e.target.value)} aria-label={`Department for ${item.text}`}>
                            <option value="">Link to…</option>
                            {faculties.map((f) => {
                                const list = departments.filter((d) => d.facultyCode === f.code);
                                return list.length ? (
                                    <optgroup key={f.code} label={f.name}>
                                        {list.map((d) => (
                                            <option key={d.id} value={d.id}>{d.name} ({d.alias})</option>
                                        ))}
                                    </optgroup>
                                ) : null;
                            })}
                        </FormSelect>
                        <button
                            type="button"
                            onClick={link}
                            disabled={!pick || saving}
                            className="btn-primary flex h-12 shrink-0 items-center justify-center gap-2 px-4 text-sm disabled:opacity-60"
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                            Link {item.members}
                        </button>
                    </div>
                    {suggestion && pick === suggestion.id && (
                        <p className="flex items-center gap-1 text-[11px] text-amber-800">
                            <Sparkles className="h-3 w-3" aria-hidden="true" /> Suggested: {suggestion.name}. Check before linking.
                        </p>
                    )}
                </>
            )}
            {err && <p role="alert" className="text-xs text-red-600">{err}</p>}
        </li>
    );
}
