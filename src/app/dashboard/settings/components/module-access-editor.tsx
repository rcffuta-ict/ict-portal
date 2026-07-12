"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import {
    X,
    Plus,
    Check,
    Loader2,
    AlertCircle,
    ShieldCheck,
    PencilLine,
    Search,
    ChevronLeft,
    ChevronRight,
    Info,
    Eye,
    Crown,
    MapPin,
    Users,
    GraduationCap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
    MODULES,
    MODULE_META,
    CONFIGURABLE_PRIVILEGE_TOKENS,
    LEVEL_SCOPE_TOKENS,
    type ModuleId,
    type ModuleAccessConfig,
    type WriteScope,
} from "@/lib/modules";
import {
    classifyAccessToken,
    normalizeAccessToken,
    PRIVILEGE_META,
    LEVEL_SCOPE_LABELS,
    type AccessTokenKind,
    type ClassifiedToken,
} from "@/lib/privileges";
import { updateModuleAccessAction, type PositionOption, type UnitOption } from "../actions";

interface Props {
    config: ModuleAccessConfig;
    positions: PositionOption[];
    units: UnitOption[];
    /** System Admin can edit; the President can view only. */
    canWrite: boolean;
}

interface RowState {
    readTokens: string[];
    writeTokens: string[];
    writeScope: WriteScope;
    saving: boolean;
    error: string | null;
    saved: boolean;
    baseRead: string[];
    baseWrite: string[];
    baseScope: WriteScope;
}

/** A suggestion for the token datalist. */
interface Suggestion {
    value: string;
    label: string;
}

const MODULE_ICON: Record<ModuleId, LucideIcon> = {
    tenure: Crown,
    zones: MapPin,
    workforce: Users,
    level: GraduationCap,
};

const KIND_PILL: Record<AccessTokenKind, string> = {
    tag: "border-purple-200 bg-purple-50 text-purple-700",
    "scoped-tag": "border-blue-200 bg-blue-50 text-blue-700",
    slug: "border-slate-200 bg-slate-100 text-slate-700",
    invalid: "border-amber-200 bg-amber-50 text-amber-700",
};

export function ModuleAccessEditor({ config, positions, units, canWrite }: Props) {
    // Known slugs (validation) + suggestion lists (input helpers).
    const positionSlugs = useMemo(() => new Set(positions.map((p) => p.slug)), [positions]);
    const unitSlugs = useMemo(() => new Set(units.map((u) => u.slug)), [units]);
    const titleBySlug = useMemo(() => {
        const m = new Map<string, string>();
        for (const p of positions) m.set(p.slug, p.alias || p.title);
        return m;
    }, [positions]);

    const suggestions = useMemo<Suggestion[]>(() => {
        const out: Suggestion[] = [];
        for (const tag of CONFIGURABLE_PRIVILEGE_TOKENS) {
            out.push({ value: tag, label: `${PRIVILEGE_META[tag].label} — all holders of this tag` });
        }
        for (const u of units) {
            out.push({ value: `EXCO:${u.slug}`, label: `Exco · ${u.name}` });
        }
        for (const t of LEVEL_SCOPE_TOKENS) {
            out.push({ value: `LEVEL:${t}`, label: `Level · ${LEVEL_SCOPE_LABELS[t] ?? t}` });
        }
        for (const p of positions) {
            if (p.isActive) out.push({ value: p.slug, label: `${p.title} (position)` });
        }
        return out;
    }, [positions, units]);

    const classifyOpts = useMemo(() => ({ positionSlugs, unitSlugs }), [positionSlugs, unitSlugs]);

    const [rows, setRows] = useState<Record<ModuleId, RowState>>(() => {
        const initial = {} as Record<ModuleId, RowState>;
        for (const m of MODULES) {
            initial[m] = {
                readTokens: [...config[m].readSlugs],
                writeTokens: [...config[m].writeSlugs],
                writeScope: config[m].writeScope,
                saving: false,
                error: null,
                saved: false,
                baseRead: [...config[m].readSlugs],
                baseWrite: [...config[m].writeSlugs],
                baseScope: config[m].writeScope,
            };
        }
        return initial;
    });

    const [selected, setSelected] = useState<ModuleId>(MODULES[0]);
    const [search, setSearch] = useState("");
    const [mobileDetail, setMobileDetail] = useState(false);

    function patch(module: ModuleId, next: Partial<RowState>) {
        setRows((prev) => ({
            ...prev,
            [module]: { ...prev[module], saved: false, error: null, ...next },
        }));
    }

    function isDirty(module: ModuleId): boolean {
        const r = rows[module];
        return (
            r.writeScope !== r.baseScope ||
            r.readTokens.join("|") !== r.baseRead.join("|") ||
            r.writeTokens.join("|") !== r.baseWrite.join("|")
        );
    }

    async function save(module: ModuleId) {
        const r = rows[module];
        patch(module, { saving: true });
        const res = await updateModuleAccessAction({
            module,
            readTokens: r.readTokens,
            writeTokens: r.writeTokens,
            writeScope: r.writeScope,
        });
        if (res.success) {
            setRows((prev) => ({
                ...prev,
                [module]: {
                    ...prev[module],
                    saving: false,
                    saved: true,
                    error: null,
                    baseRead: [...r.readTokens],
                    baseWrite: [...r.writeTokens],
                    baseScope: r.writeScope,
                },
            }));
        } else {
            setRows((prev) => ({
                ...prev,
                [module]: { ...prev[module], saving: false, error: res.error ?? "Update failed" },
            }));
        }
    }

    const filteredModules = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return MODULES;
        return MODULES.filter(
            (m) =>
                m.includes(q) ||
                MODULE_META[m].label.toLowerCase().includes(q) ||
                MODULE_META[m].description.toLowerCase().includes(q),
        );
    }, [search]);

    function openModule(m: ModuleId) {
        setSelected(m);
        setMobileDetail(true);
    }

    return (
        <div className="space-y-4">
            {!canWrite && (
                <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                    <Eye className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                        <b>View only.</b> As President you can see every setting, but changes are
                        reserved for the System Admin.
                    </span>
                </div>
            )}

            <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-6 lg:items-start">
                {/* Master list */}
                <aside className={clsx("lg:block", mobileDetail ? "hidden" : "block")}>
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search modules…"
                            className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:border-rcf-navy focus:ring-1 focus:ring-rcf-navy"
                        />
                    </div>
                    <nav className="space-y-1.5">
                        {filteredModules.map((m) => {
                            const Icon = MODULE_ICON[m];
                            const r = rows[m];
                            const active = m === selected;
                            const dirty = isDirty(m);
                            return (
                                <button
                                    key={m}
                                    onClick={() => openModule(m)}
                                    className={clsx(
                                        "group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                                        active
                                            ? "border-rcf-navy bg-rcf-navy text-white shadow-sm"
                                            : "border-gray-200 bg-white hover:border-rcf-navy/30 hover:bg-slate-50",
                                    )}
                                >
                                    <span
                                        className={clsx(
                                            "inline-flex rounded-lg p-2",
                                            active ? "bg-white/15 text-white" : "bg-slate-100 text-rcf-navy",
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-1.5 font-semibold text-sm">
                                            {MODULE_META[m].label}
                                            {dirty && (
                                                <span
                                                    className={clsx(
                                                        "h-1.5 w-1.5 rounded-full",
                                                        active ? "bg-yellow-300" : "bg-amber-500",
                                                    )}
                                                    title="Unsaved changes"
                                                />
                                            )}
                                        </span>
                                        <span className={clsx("block text-[11px] truncate", active ? "text-blue-100" : "text-gray-500")}>
                                            {r.readTokens.length} read · {r.writeTokens.length} write · {r.writeScope}
                                        </span>
                                    </span>
                                    <ChevronRight className={clsx("h-4 w-4 shrink-0", active ? "text-white/70" : "text-gray-300 group-hover:text-gray-400")} />
                                </button>
                            );
                        })}
                        {filteredModules.length === 0 && (
                            <p className="px-2 py-6 text-center text-sm text-gray-400">No modules match.</p>
                        )}
                    </nav>

                    <div className="mt-4 hidden lg:flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-100 p-3 text-[11px] text-gray-500">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                            Grant by a <b>tag</b> (all holders), a <b>scoped tag</b> (
                            <span className="font-mono">Exco:bible-study</span>), or a{" "}
                            <b>position slug</b>. Admins always have full access.
                        </span>
                    </div>
                </aside>

                {/* Detail editor */}
                <section className={clsx("lg:block", mobileDetail ? "block" : "hidden")}>
                    <ModuleDetail
                        key={selected}
                        module={selected}
                        icon={MODULE_ICON[selected]}
                        row={rows[selected]}
                        dirty={isDirty(selected)}
                        canWrite={canWrite}
                        suggestions={suggestions}
                        classifyOpts={classifyOpts}
                        titleBySlug={titleBySlug}
                        onPatch={(next) => patch(selected, next)}
                        onSave={() => save(selected)}
                        onBack={() => setMobileDetail(false)}
                    />
                </section>
            </div>
        </div>
    );
}

interface DetailProps {
    module: ModuleId;
    icon: LucideIcon;
    row: RowState;
    dirty: boolean;
    canWrite: boolean;
    suggestions: Suggestion[];
    classifyOpts: { positionSlugs: Set<string>; unitSlugs: Set<string> };
    titleBySlug: Map<string, string>;
    onPatch: (next: Partial<RowState>) => void;
    onSave: () => void;
    onBack: () => void;
}

function ModuleDetail({
    module,
    icon: Icon,
    row,
    dirty,
    canWrite,
    suggestions,
    classifyOpts,
    titleBySlug,
    onPatch,
    onSave,
    onBack,
}: DetailProps) {
    const meta = MODULE_META[module];
    return (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-gray-100 p-5">
                <button onClick={onBack} className="lg:hidden -ml-1 mr-1 text-gray-500" aria-label="Back to modules">
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="inline-flex rounded-xl bg-rcf-navy p-3 text-white">
                    <Icon className="h-5 w-5" />
                </span>
                <div className="flex-1">
                    <h2 className="text-lg font-bold text-rcf-navy">{meta.label}</h2>
                    <p className="text-sm text-gray-500">{meta.description}</p>
                </div>
                {row.saved && !dirty && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-green-600">
                        <Check className="h-4 w-4" /> Saved
                    </span>
                )}
            </div>

            <div className="p-5 space-y-6">
                <TokenField
                    label="Read access"
                    hint="Who can open and view this module"
                    icon={<ShieldCheck className="h-4 w-4 text-blue-500" />}
                    tokens={row.readTokens}
                    onChange={(readTokens) => onPatch({ readTokens })}
                    canWrite={canWrite}
                    suggestions={suggestions}
                    classifyOpts={classifyOpts}
                    titleBySlug={titleBySlug}
                    inputId={`${module}-read`}
                />
                <TokenField
                    label="Write access"
                    hint="Who can make changes in this module"
                    icon={<PencilLine className="h-4 w-4 text-amber-500" />}
                    tokens={row.writeTokens}
                    onChange={(writeTokens) => onPatch({ writeTokens })}
                    canWrite={canWrite}
                    suggestions={suggestions}
                    classifyOpts={classifyOpts}
                    titleBySlug={titleBySlug}
                    inputId={`${module}-write`}
                />

                <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Write scope</label>
                    <div className="grid grid-cols-2 gap-2">
                        {(["ALL", "OWN"] as WriteScope[]).map((scope) => (
                            <button
                                key={scope}
                                type="button"
                                disabled={!canWrite}
                                onClick={() => onPatch({ writeScope: scope })}
                                className={clsx(
                                    "rounded-lg border p-3 text-left text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
                                    row.writeScope === scope
                                        ? "border-rcf-navy bg-rcf-navy/5 ring-1 ring-rcf-navy"
                                        : "border-gray-200 hover:border-gray-300",
                                )}
                            >
                                <span className="block font-semibold text-gray-800">
                                    {scope === "ALL" ? "All" : "Own"}
                                </span>
                                <span className="block text-[11px] text-gray-500">
                                    {scope === "ALL" ? "Everything in the module" : "Only the portion they oversee"}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer */}
            {canWrite && (
                <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-slate-50 p-4 rounded-b-2xl">
                    <span className="text-xs text-gray-500">
                        {dirty ? "Unsaved changes" : row.saved ? "All changes saved" : "No changes"}
                    </span>
                    <div className="flex items-center gap-3">
                        {row.error && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                                <AlertCircle className="h-4 w-4" /> {row.error}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={onSave}
                            disabled={row.saving || !dirty}
                            className="inline-flex items-center gap-2 rounded-lg bg-rcf-navy px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-rcf-navy-light disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {row.saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            {row.saving ? "Saving…" : "Save changes"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

interface TokenFieldProps {
    label: string;
    hint: string;
    icon: React.ReactNode;
    tokens: string[];
    onChange: (tokens: string[]) => void;
    canWrite: boolean;
    suggestions: Suggestion[];
    classifyOpts: { positionSlugs: Set<string>; unitSlugs: Set<string> };
    titleBySlug: Map<string, string>;
    inputId: string;
}

function TokenField({
    label,
    hint,
    icon,
    tokens,
    onChange,
    canWrite,
    suggestions,
    classifyOpts,
    titleBySlug,
    inputId,
}: TokenFieldProps) {
    const [draft, setDraft] = useState("");
    const [error, setError] = useState<string | null>(null);

    function add(raw: string) {
        const value = raw.trim();
        if (!value) return;
        const c = classifyAccessToken(value, classifyOpts);
        if (c.kind === "invalid") {
            setError(c.error ?? "That token isn't valid.");
            return;
        }
        if (tokens.includes(c.token)) {
            setDraft("");
            setError(null);
            return;
        }
        onChange([...tokens, c.token]);
        setDraft("");
        setError(null);
    }

    function remove(token: string) {
        onChange(tokens.filter((t) => t !== token));
    }

    return (
        <div className="space-y-2">
            <div>
                <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                    {icon}
                    {label}
                </span>
                <span className="text-[11px] text-gray-400">{hint}</span>
            </div>

            <div className="flex flex-wrap gap-1.5 rounded-lg border border-gray-200 bg-gray-50 p-2 min-h-11">
                {tokens.length === 0 && (
                    <span className="px-1 text-xs text-gray-400">No one yet — admins still have access.</span>
                )}
                {tokens.map((token) => (
                    <TokenPill
                        key={token}
                        token={token}
                        classifyOpts={classifyOpts}
                        titleBySlug={titleBySlug}
                        onRemove={canWrite ? () => remove(token) : undefined}
                    />
                ))}
            </div>

            {canWrite && (
                <>
                    <div className="flex gap-2">
                        <input
                            id={inputId}
                            list={`${inputId}-options`}
                            value={draft}
                            onChange={(e) => {
                                setDraft(e.target.value);
                                if (error) setError(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    add(draft);
                                }
                            }}
                            placeholder="Tag, Exco:slug, or a position slug…"
                            className={clsx(
                                "flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-1",
                                error
                                    ? "border-red-300 focus:border-red-400 focus:ring-red-400"
                                    : "border-gray-300 focus:border-rcf-navy focus:ring-rcf-navy",
                            )}
                        />
                        <datalist id={`${inputId}-options`}>
                            {suggestions.map((s) => (
                                <option key={s.value} value={s.value}>
                                    {s.label}
                                </option>
                            ))}
                        </datalist>
                        <button
                            type="button"
                            onClick={() => add(draft)}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            <Plus className="h-4 w-4" /> Add
                        </button>
                    </div>
                    {error && (
                        <p className="flex items-center gap-1 text-[11px] font-medium text-red-600">
                            <AlertCircle className="h-3.5 w-3.5" /> {error}
                        </p>
                    )}
                </>
            )}
        </div>
    );
}

function TokenPill({
    token,
    classifyOpts,
    titleBySlug,
    onRemove,
}: {
    token: string;
    classifyOpts: { positionSlugs: Set<string>; unitSlugs: Set<string> };
    titleBySlug: Map<string, string>;
    onRemove?: () => void;
}) {
    const c: ClassifiedToken = classifyAccessToken(token, classifyOpts);
    const suspect = c.kind === "invalid" || !!c.warning;
    const className = suspect ? KIND_PILL.invalid : KIND_PILL[c.kind];
    const display =
        c.kind === "slug" ? titleBySlug.get(token) ?? token : c.label || normalizeAccessToken(token);
    const title = c.error ?? c.warning ?? (c.kind === "slug" ? `Position slug: ${token}` : c.label);

    return (
        <span
            className={clsx(
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold",
                className,
            )}
            title={title}
        >
            {suspect && <AlertCircle className="h-3 w-3" />}
            <span>{display}</span>
            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    aria-label={`Remove ${display}`}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-black/10"
                >
                    <X className="h-3 w-3" />
                </button>
            )}
        </span>
    );
}
