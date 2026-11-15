"use client";

import { useState } from "react";
import { BookOpen, Check, Copy, X } from "lucide-react";
import { TESTIMONY_CATEGORIES, type Testimony } from "@/lib/testimonies";
import type { TestimonyCycles, TestimonyCycleId, CycleRange } from "@/lib/testimony-cycle";

interface PulpitViewProps {
    items: Testimony[];
    cycle: TestimonyCycleId;
    cycles: TestimonyCycles;
    cycleCounts?: Record<TestimonyCycleId, number>;
    onCycleChange?: (cycle: TestimonyCycleId) => void;
    onClose: () => void;
    onNotify?: (type: "success" | "error", message: string) => void;
}

function categoryLabel(cat: string) {
    return TESTIMONY_CATEGORIES.find((c) => c.id === cat)?.label ?? cat;
}

export function PulpitView({
    items,
    cycle,
    cycles,
    cycleCounts,
    onCycleChange,
    onClose,
    onNotify,
}: PulpitViewProps) {
    const [readIds, setReadIds] = useState<Record<string, boolean>>({});

    const approvedItems = items.filter((t) => t.status === "approved");

    const handleCopyAll = () => {
        if (approvedItems.length === 0) {
            onNotify?.("error", "No published testimonies to copy");
            return;
        }
        const activeCycleInfo = cycles.allCycles.find((c: CycleRange) => c.id === cycle);
        const header = `*RCF FUTA TESTIMONIES — ${activeCycleInfo?.label ?? "Sunday Service"}*\n\n`;
        const text =
            header +
            approvedItems
                .map((t, idx) => {
                    const author = t.isAnonymous ? "Anonymous" : t.authorName;
                    const scripture = t.scriptureReference ? ` (${t.scriptureReference})` : "";
                    return `*${idx + 1}. ${t.title}*${scripture}\n_By: ${author}_\n\n${t.body}\n`;
                })
                .join("\n--------------------\n\n");
        navigator.clipboard.writeText(text);
        onNotify?.("success", "Copied testimonies to clipboard!");
    };

    return (
        <div className="space-y-4">
            {/* Pulpit Top Banner */}
            <div className="rounded-2xl bg-rcf-navy p-4 text-white shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rcf-gold text-rcf-navy shadow-sm">
                            <BookOpen className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white">Pulpit Reading View</h3>
                            <p className="text-xs text-white/70">
                                High-contrast cards for Sunday service altar readings
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleCopyAll}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-rcf-gold px-3.5 text-xs font-bold text-rcf-navy shadow-sm transition-transform active:scale-95 hover:bg-yellow-400"
                        >
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy for WhatsApp / Bulletin</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white transition-colors hover:bg-white/20"
                            aria-label="Exit pulpit mode"
                        >
                            <X className="h-4 w-4" />
                            <span>Exit</span>
                        </button>
                    </div>
                </div>

                {/* Cycle Switcher inside Pulpit View */}
                {onCycleChange && (
                    <div className="mt-4 pt-3 border-t border-white/10">
                        <div className="no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto px-1">
                            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-white/60 mr-1">
                                Sunday:
                            </span>
                            {cycles.allCycles.map((c: CycleRange) => {
                                const count = cycleCounts?.[c.id];
                                const isCurrent = cycle === c.id;
                                return (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => onCycleChange(c.id)}
                                        className={`min-h-7 shrink-0 rounded-full border px-2.5 text-[11px] font-semibold whitespace-nowrap transition-colors inline-flex items-center gap-1.5 ${
                                            isCurrent
                                                ? "border-rcf-gold bg-rcf-gold text-rcf-navy shadow-xs font-bold"
                                                : "border-white/20 bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
                                        }`}
                                    >
                                        <span>{c.label}</span>
                                        {c.id !== "all" && c.id !== "older" && (
                                            <span className={`text-[9px] ${isCurrent ? "text-rcf-navy/80" : "text-white/60"}`}>
                                                ({c.sundayLabel})
                                            </span>
                                        )}
                                        {count !== undefined && (
                                            <span
                                                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                                                    isCurrent
                                                        ? "bg-rcf-navy text-rcf-gold"
                                                        : "bg-white/20 text-white"
                                                }`}
                                            >
                                                {count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Testimonies Reading Cards */}
            {approvedItems.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
                    <BookOpen className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
                    <p className="mt-3 text-sm font-medium text-slate-500">
                        No published testimonies in this cycle to read.
                    </p>
                </div>
            ) : (
                <ul className="space-y-4">
                    {approvedItems.map((item, idx) => {
                        const isRead = !!readIds[item.id];
                        return (
                            <li
                                key={item.id}
                                className={`rounded-2xl border p-5 transition-all duration-200 ${
                                    isRead
                                        ? "border-emerald-300 bg-emerald-50/90 ring-2 ring-emerald-400/40 shadow-xs"
                                        : "border-slate-200/90 bg-white shadow-sm hover:border-slate-300"
                                }`}
                            >
                                <div className="mb-2 flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2.5">
                                        <span
                                            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                                                isRead
                                                    ? "bg-emerald-600 text-white"
                                                    : "bg-rcf-navy/10 text-rcf-navy"
                                            }`}
                                        >
                                            {idx + 1}
                                        </span>
                                        <div>
                                            <h4
                                                className={`text-base font-bold sm:text-lg leading-snug ${
                                                    isRead ? "text-emerald-950" : "text-slate-900"
                                                }`}
                                            >
                                                {item.title}
                                            </h4>
                                            {isRead && (
                                                <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-800">
                                                    <Check className="h-3 w-3 text-emerald-700" />
                                                    Read Aloud
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setReadIds((prev) => ({
                                                ...prev,
                                                [item.id]: !prev[item.id],
                                            }))
                                        }
                                        className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-colors ${
                                            isRead
                                                ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
                                                : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                                        }`}
                                    >
                                        <Check className="h-3.5 w-3.5" />
                                        <span>{isRead ? "Marked Read" : "Mark as Read"}</span>
                                    </button>
                                </div>

                                {item.scriptureReference && (
                                    <p
                                        className={`mb-3 text-xs font-semibold italic ${
                                            isRead ? "text-emerald-800" : "text-rcf-gold"
                                        }`}
                                    >
                                        📖 {item.scriptureReference}
                                    </p>
                                )}

                                <p
                                    className={`text-sm sm:text-base font-medium leading-relaxed whitespace-pre-wrap ${
                                        isRead ? "text-emerald-900/90" : "text-slate-800"
                                    }`}
                                >
                                    {item.body}
                                </p>

                                <div
                                    className={`mt-4 flex items-center justify-between border-t pt-3 text-xs ${
                                        isRead
                                            ? "border-emerald-200 text-emerald-800"
                                            : "border-slate-100 text-slate-500"
                                    }`}
                                >
                                    <span>
                                        Shared by:{" "}
                                        <strong className={isRead ? "text-emerald-950 font-bold" : "text-slate-900"}>
                                            {item.isAnonymous ? "Anonymous Member" : item.authorName}
                                        </strong>
                                    </span>
                                    <span
                                        className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                                            isRead
                                                ? "bg-emerald-100 text-emerald-800"
                                                : "bg-slate-100 text-slate-600"
                                        }`}
                                    >
                                        {categoryLabel(item.category)}
                                    </span>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
