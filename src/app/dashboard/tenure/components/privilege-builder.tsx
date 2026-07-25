"use client";

import { Check, Info } from "lucide-react";
import {
    ASSIGNABLE_TAGS,
    PRIVILEGE_META,
    LEVEL_SCOPE_LABELS,
    scopeLabel,
    validatePrivilegeSet,
} from "@/lib/privileges";
import { LEVEL_SCOPE_TOKENS, type Privilege, type PrivilegeTag } from "@/lib/modules";

interface UnitOption {
    id: string;
    name: string;
    type: string;
    slug: string;
}

/**
 * The privilege + scope builder — a controlled tag picker with inline scope selectors and
 * live rule enforcement (Exco⊕Level mutually exclusive; President supreme & exclusive;
 * un-scoped Exco/Level = church-wide). Reused by the create-role card and the edit modal.
 */
export function PrivilegeBuilder({
    value,
    onChange,
    units,
}: {
    value: Privilege[];
    onChange: (next: Privilege[]) => void;
    units: UnitOption[];
}) {
    const byTag = new Map(value.map((p) => [p.tag, p.scope] as const));
    const has = (t: PrivilegeTag) => byTag.has(t);
    const presidentOn = has("PRESIDENT");

    function isDisabled(tag: PrivilegeTag): boolean {
        if (presidentOn && tag !== "PRESIDENT") return true;
        if (tag === "LEVEL" && has("EXCO")) return true;
        if (tag === "EXCO" && has("LEVEL")) return true;
        return false;
    }

    function toggle(tag: PrivilegeTag) {
        if (has(tag)) {
            onChange(value.filter((p) => p.tag !== tag));
            return;
        }
        if (tag === "PRESIDENT") {
            onChange([{ tag: "PRESIDENT", scope: null }]); // exclusive
            return;
        }
        // Adding a normal tag clears President; Exco/Level evict each other.
        let next = value.filter((p) => p.tag !== "PRESIDENT");
        if (tag === "EXCO") next = next.filter((p) => p.tag !== "LEVEL");
        if (tag === "LEVEL") next = next.filter((p) => p.tag !== "EXCO");
        onChange([...next, { tag, scope: null }]);
    }

    function setScope(tag: PrivilegeTag, scope: string | null) {
        onChange(value.map((p) => (p.tag === tag ? { ...p, scope } : p)));
    }

    const error = validatePrivilegeSet(value);

    return (
        <div className="space-y-4">
            {/* Tag chips */}
            <div className="grid gap-2 sm:grid-cols-2">
                {ASSIGNABLE_TAGS.map((tag) => {
                    const meta = PRIVILEGE_META[tag];
                    const on = has(tag);
                    const disabled = isDisabled(tag);
                    return (
                        <button
                            key={tag}
                            type="button"
                            onClick={() => toggle(tag)}
                            disabled={disabled}
                            aria-pressed={on}
                            className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
                                on
                                    ? `${meta.colorClasses} ring-2 ring-offset-1 ring-current`
                                    : disabled
                                        ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                        >
                            <span
                                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                    on ? "border-current bg-current/10" : "border-slate-300"
                                }`}
                            >
                                {on && <Check className="h-3 w-3" />}
                            </span>
                            <span className="min-w-0">
                                <span className="block text-sm font-bold">{meta.label}</span>
                                <span className={`block text-[11px] leading-snug ${on ? "opacity-80" : "text-slate-400"}`}>
                                    {meta.description}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Scope pickers for the scoped tags that are on */}
            {has("EXCO") && (
                <ScopeSelect
                    label="Exco scope"
                    hint="Which unit/team this role runs. Leave as “All units” for church-wide (central)."
                    value={byTag.get("EXCO") ?? ""}
                    onChange={(v) => setScope("EXCO", v || null)}
                    options={[
                        { value: "", label: "All units (church-wide / central)" },
                        ...units.map((u) => ({ value: u.slug, label: `${u.name} (${u.type})` })),
                    ]}
                />
            )}
            {has("LEVEL") && (
                <ScopeSelect
                    label="Level scope"
                    hint="Which level this role works. “All levels” = every generation."
                    value={byTag.get("LEVEL") ?? ""}
                    onChange={(v) => setScope("LEVEL", v || null)}
                    options={[
                        { value: "", label: "All levels" },
                        ...LEVEL_SCOPE_TOKENS.map((t) => ({ value: t, label: LEVEL_SCOPE_LABELS[t] })),
                    ]}
                />
            )}

            {/* Live preview */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Access preview
                </p>
                {value.length === 0 ? (
                    <p className="text-xs text-slate-400">
                        No privileges yet — this role will have no module access.
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-1.5">
                        {value.map((p, i) => (
                            <span
                                key={`${p.tag}-${i}`}
                                className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${PRIVILEGE_META[p.tag].colorClasses}`}
                            >
                                {scopeLabel(p)}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {error && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                    <Info className="h-3.5 w-3.5" /> {error}
                </p>
            )}
        </div>
    );
}

function ScopeSelect({
    label,
    hint,
    value,
    onChange,
    options,
}: {
    label: string;
    hint: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
}) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5 animate-in fade-in">
            <label className="block text-xs font-bold text-slate-700">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-rcf-navy focus:ring-1 focus:ring-rcf-navy"
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
            <p className="text-[11px] text-slate-400">{hint}</p>
        </div>
    );
}
