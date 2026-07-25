"use client";

import { useState } from "react";
import { Download, Loader2, Check, X, AlertCircle } from "lucide-react";
import {
    EXPORT_FIELDS,
    EXPORT_FIELD_GROUPS,
    DEFAULT_EXPORT_FIELDS,
    MIN_EXPORT_FIELDS,
} from "../export-fields";
import { exportLevelMembersAction } from "../actions";

/**
 * CSV export with a field picker. The selection is a plain list of whitelisted keys —
 * the server re-validates them and re-checks read access, so this panel is UI only.
 * Export is blocked below MIN_EXPORT_FIELDS on both sides.
 */
export function ExportPanel({
    classSetId,
    memberCount,
}: {
    classSetId: string;
    memberCount: number;
}) {
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<string[]>(DEFAULT_EXPORT_FIELDS);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggle = (key: string) =>
        setSelected((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
        );

    const toggleGroup = (group: string) => {
        const keys = EXPORT_FIELDS.filter((f) => f.group === group).map((f) => f.key);
        const allOn = keys.every((k) => selected.includes(k));
        setSelected((prev) =>
            allOn
                ? prev.filter((k) => !keys.includes(k))
                : Array.from(new Set([...prev, ...keys])),
        );
    };

    const enough = selected.length >= MIN_EXPORT_FIELDS;

    const download = async () => {
        setBusy(true);
        setError(null);
        const res = await exportLevelMembersAction(classSetId, selected);
        setBusy(false);
        if (!res.success || !res.csv) {
            setError(res.error || "Could not build the export.");
            return;
        }
        // Blob + object URL keeps the file entirely client-side (no extra round-trip).
        const blob = new Blob(["﻿", res.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename || "members.csv";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setOpen(false);
    };

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:border-rcf-navy/40 hover:text-rcf-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rcf-navy"
            >
                <Download className="h-4 w-4" /> Export CSV
            </button>

            {open && (
                <div className="absolute right-0 z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                    <div className="mb-3 flex items-start justify-between gap-2">
                        <div>
                            <h5 className="text-sm font-bold text-slate-800">Choose fields</h5>
                            <p className="text-[11px] text-slate-500">
                                {memberCount} member{memberCount === 1 ? "" : "s"} · at least{" "}
                                {MIN_EXPORT_FIELDS} fields
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            aria-label="Close"
                            className="p-1 text-slate-400 hover:text-slate-700"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                        {EXPORT_FIELD_GROUPS.map((group) => {
                            const fields = EXPORT_FIELDS.filter((f) => f.group === group);
                            const allOn = fields.every((f) => selected.includes(f.key));
                            return (
                                <fieldset key={group}>
                                    <div className="mb-1 flex items-center justify-between">
                                        <legend className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                            {group}
                                        </legend>
                                        <button
                                            type="button"
                                            onClick={() => toggleGroup(group)}
                                            className="text-[10px] font-bold text-rcf-navy hover:underline"
                                        >
                                            {allOn ? "Clear" : "All"}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1">
                                        {fields.map((f) => {
                                            const on = selected.includes(f.key);
                                            return (
                                                <label
                                                    key={f.key}
                                                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                                                        on
                                                            ? "border-rcf-navy/30 bg-rcf-navy/5 text-rcf-navy font-medium"
                                                            : "border-slate-100 text-slate-600 hover:bg-slate-50"
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={on}
                                                        onChange={() => toggle(f.key)}
                                                        className="sr-only"
                                                    />
                                                    <span
                                                        aria-hidden
                                                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                                                            on
                                                                ? "border-rcf-navy bg-rcf-navy text-white"
                                                                : "border-slate-300"
                                                        }`}
                                                    >
                                                        {on && <Check className="h-2.5 w-2.5" />}
                                                    </span>
                                                    <span className="truncate">{f.label}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </fieldset>
                            );
                        })}
                    </div>

                    {error && (
                        <p className="mt-3 flex items-start gap-1.5 text-xs text-red-600">
                            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
                        </p>
                    )}

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                        <span
                            className={`text-[11px] font-medium ${
                                enough ? "text-slate-500" : "text-amber-600"
                            }`}
                        >
                            {selected.length} selected
                            {!enough && ` · need ${MIN_EXPORT_FIELDS}`}
                        </span>
                        <button
                            type="button"
                            onClick={download}
                            disabled={!enough || busy}
                            className="inline-flex h-9 items-center gap-2 rounded-lg bg-rcf-navy px-4 text-xs font-bold text-white hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Download className="h-4 w-4" />
                            )}
                            Download
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
