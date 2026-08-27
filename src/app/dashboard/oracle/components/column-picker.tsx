"use client";

import { useState } from "react";
import { Columns3, Check } from "lucide-react";
import { ORACLE_FIELDS, FIELD_GROUPS, DEFAULT_COLUMNS } from "../fields";

/**
 * Which columns the results table shows.
 *
 * Collapsed by default: on a phone this is a long list, and the admin only opens it
 * when they actually want to change something.
 */
export function ColumnPicker({
    columns,
    onChange,
    disabled,
}: {
    columns: string[];
    onChange: (next: string[]) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const selected = new Set(columns);

    const toggle = (key: string) => {
        const next = new Set(selected);
        if (next.has(key)) {
            // Always leave something to render — an empty table tells you nothing.
            if (next.size === 1) return;
            next.delete(key);
        } else {
            next.add(key);
        }
        onChange(ORACLE_FIELDS.filter((f) => next.has(f.key)).map((f) => f.key));
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-bold text-rcf-navy"
            >
                <span className="flex items-center gap-2">
                    <Columns3 className="h-4 w-4" aria-hidden="true" />
                    Columns
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        {columns.length}
                    </span>
                </span>
                <span className="text-xs font-medium text-slate-400">
                    {open ? "Hide" : "Choose"}
                </span>
            </button>

            {open && (
                <div className="space-y-4 border-t border-slate-100 p-4">
                    {FIELD_GROUPS.map((group) => {
                        const inGroup = ORACLE_FIELDS.filter((f) => f.group === group);
                        if (!inGroup.length) return null;
                        return (
                            <fieldset key={group}>
                                <legend className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                                    {group}
                                </legend>
                                <div className="flex flex-wrap gap-2">
                                    {inGroup.map((f) => {
                                        const on = selected.has(f.key);
                                        return (
                                            <button
                                                key={f.key}
                                                type="button"
                                                disabled={disabled}
                                                onClick={() => toggle(f.key)}
                                                aria-pressed={on}
                                                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy ${
                                                    on
                                                        ? "border-rcf-navy bg-rcf-navy text-white"
                                                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                                }`}
                                            >
                                                {on && <Check className="h-3 w-3" aria-hidden="true" />}
                                                {f.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </fieldset>
                        );
                    })}

                    <button
                        type="button"
                        onClick={() => onChange(DEFAULT_COLUMNS)}
                        className="text-xs font-semibold text-rcf-navy underline underline-offset-2"
                    >
                        Reset to default columns
                    </button>
                </div>
            )}
        </div>
    );
}
