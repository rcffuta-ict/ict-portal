"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    BookOpen,
    Check,
    CheckCircle2,
    ChevronDown,
    Clock,
    Copy,
    EyeOff,
    Loader2,
    PencilLine,
    RefreshCw,
    ShieldAlert,
    ShieldCheck,
    Star,
    X,
} from "lucide-react";
import {
    editTestimonyAction,
    getTestimoniesForReview,
    getTestimonyCycleSettings,
    moderateTestimony,
    setTestimonyFeatured,
    updateWeeklyCutoffAction,
    type ReviewFilter,
} from "@/app/lo-app/testimonies/actions";
import {
    computeTestimonyCycles,
    DEFAULT_CYCLE_SETTINGS,
    type TestimonyCycleId,
    type TestimonyCycleSettings,
} from "@/lib/testimony-cycle";
import {
    TESTIMONY_CATEGORIES,
    categoryLabel,
    testimonyEditSchema,
    type Testimony,
    type TestimonyEdit,
    type TestimonyStatus,
} from "@/lib/testimonies";
import { formatEventDateTime, parseEventDate } from "@/lib/event-utils";

interface TestimonyModerationProps {
    onNotify?: (type: "success" | "error", message: string) => void;
    /** Called after anything that changes the queue, so the shell can re-count the badge. */
    onQueueChanged?: () => void;
}

const FILTERS: { id: ReviewFilter; label: string }[] = [
    { id: "pending", label: "Awaiting review" },
    { id: "approved", label: "Published" },
    { id: "featured", label: "Featured" },
    { id: "rejected", label: "Not published" },
    { id: "hidden", label: "Hidden" },
    { id: "all", label: "All" },
];

type Action = "approve" | "reject" | "hide" | "restore";

/**
 * The review queue. Testimonies are held until a moderator releases them, so this is
 * the only path to a public testimony. Every button's action re-checks Lo! access on
 * the server (src/lib/lo-admin.ts); `canModerate` here only decides whether to offer
 * the buttons — the President can read the queue but not act on it.
 *
 * Filtered and paged on the server: a phone downloads one page of one status, not
 * every testimony ever posted.
 */
export function TestimonyModeration({ onNotify, onQueueChanged }: TestimonyModerationProps) {
    const [items, setItems] = useState<Testimony[]>([]);
    const [filter, setFilter] = useState<ReviewFilter>("pending");
    const [cycle, setCycle] = useState<TestimonyCycleId>("all");
    const [cycleSettings, setCycleSettings] = useState<TestimonyCycleSettings>(DEFAULT_CYCLE_SETTINGS);
    const [showCutoffModal, setShowCutoffModal] = useState(false);
    const [isPulpitMode, setIsPulpitMode] = useState(false);
    const [readIds, setReadIds] = useState<Record<string, boolean>>({});
    const [updatingCutoff, setUpdatingCutoff] = useState(false);
    const [overrideInput, setOverrideInput] = useState("");
    const [defaultInput, setDefaultInput] = useState("");
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [canModerate, setCanModerate] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);

    const cycles = useMemo(() => computeTestimonyCycles(new Date(), cycleSettings), [cycleSettings]);

    const load = useCallback(async (which: ReviewFilter, whichCycle: TestimonyCycleId) => {
        setLoading(true);
        setLoadError(null);
        try {
            const [result, settings] = await Promise.all([
                getTestimoniesForReview({ filter: which, cycle: whichCycle }),
                getTestimonyCycleSettings(),
            ]);
            setCycleSettings(settings);
            if (result.success) {
                setItems(result.data);
                setHasMore(result.hasMore);
                setCanModerate(result.canModerate);
            } else {
                setLoadError(result.error || "Couldn't load the review queue");
            }
        } catch {
            setLoadError("Couldn't load the review queue");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => void load(filter, cycle), 0);
        return () => clearTimeout(timer);
    }, [filter, cycle, load]);

    const loadMore = async () => {
        const last = items[items.length - 1];
        if (!last || loadingMore) return;
        setLoadingMore(true);
        try {
            const result = await getTestimoniesForReview({ filter, before: last.createdAt, cycle });
            if (result.success) {
                setItems((prev) => [...prev, ...result.data.filter((t) => !prev.some((p) => p.id === t.id))]);
                setHasMore(result.hasMore);
            } else {
                onNotify?.("error", result.error || "Couldn't load more");
            }
        } catch {
            onNotify?.("error", "Couldn't load more");
        } finally {
            setLoadingMore(false);
        }
    };

    /** Does this item still belong under the current filter after a change? */
    const fits = (item: Testimony) =>
        filter === "all" || (filter === "featured" ? item.isFeatured : item.status === filter);

    const replace = (id: string, patch: Partial<Testimony>) =>
        setItems((prev) =>
            prev
                .map((item) => (item.id === id ? { ...item, ...patch } : item))
                // Something published from "Awaiting review" leaves that list — the
                // moderator sees the queue shrink, which is the point of a queue.
                .filter((item) => item.id !== id || fits(item)),
        );

    const act = async (item: Testimony, action: Action, note: string) => {
        setBusyId(item.id);
        const result = await moderateTestimony(item.id, action, note);
        if (result.success) {
            const status: TestimonyStatus =
                action === "approve" || action === "restore" ? "approved" : action === "reject" ? "rejected" : "hidden";
            replace(item.id, {
                status,
                reviewNote: note.trim() || null,
                isFeatured: status === "approved" ? item.isFeatured : false,
            });
            onNotify?.(
                "success",
                status === "approved" ? "Testimony published" : status === "rejected" ? "Testimony not published" : "Testimony hidden",
            );
            onQueueChanged?.();
        } else {
            onNotify?.("error", result.error || "That didn't work");
        }
        setBusyId(null);
    };

    const feature = async (item: Testimony) => {
        setBusyId(item.id);
        const next = !item.isFeatured;
        const result = await setTestimonyFeatured(item.id, next);
        if (result.success) {
            // Only one testimony is featured at a time.
            setItems((prev) =>
                prev
                    .map((t) => ({ ...t, isFeatured: t.id === item.id ? next : next ? false : t.isFeatured }))
                    .filter((t) => filter !== "featured" || t.isFeatured),
            );
            onNotify?.("success", next ? "Featured at the top of the feed" : "No longer featured");
        } else {
            onNotify?.("error", result.error || "That didn't work");
        }
        setBusyId(null);
    };

    const handleSaveCutoff = async (overrideTime?: string | null, newDefault?: string) => {
        setUpdatingCutoff(true);
        try {
            const res = await updateWeeklyCutoffAction({
                overrideTimeToday: overrideTime,
                defaultTime: newDefault,
            });
            if (res.success) {
                onNotify?.("success", "Sunday cut-off updated");
                setShowCutoffModal(false);
                void load(filter, cycle);
            } else {
                onNotify?.("error", res.error || "Failed to update cut-off");
            }
        } catch {
            onNotify?.("error", "Failed to update cut-off");
        } finally {
            setUpdatingCutoff(false);
        }
    };

    const handleCopyAll = () => {
        const publishedItems = items.filter((t) => t.status === "approved");
        if (publishedItems.length === 0) {
            onNotify?.("error", "No published testimonies to copy");
            return;
        }
        const text = publishedItems
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
        <div className="p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-rcf-navy" aria-hidden="true" />
                    <h2 className="text-base font-bold text-slate-900">Testimony review</h2>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        void load(filter, cycle);
                        onQueueChanged?.();
                    }}
                    aria-label="Refresh queue"
                    className="rounded-xl p-2.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} />
                </button>
            </div>

            {/* Sunday Reading Cut-off status & Pulpit mode toolbar */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
                <div className="flex items-center gap-2 text-xs text-slate-700">
                    <Clock className="h-4 w-4 shrink-0 text-rcf-navy" aria-hidden="true" />
                    <div>
                        <span className="font-semibold text-slate-900">Sunday Cut-off: </span>
                        <span>
                            {cycles.effectiveCutoff.toLocaleTimeString("en-GB", {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: "Africa/Lagos",
                            })}{" "}
                            WAT
                        </span>
                        {cycleSettings.currentOverrideCutoff ? (
                            <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                Today&apos;s Override
                            </span>
                        ) : (
                            <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                                Default 9:00 AM
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {canModerate && (
                        <button
                            type="button"
                            onClick={() => {
                                setOverrideInput("");
                                setDefaultInput(cycleSettings.cutoffTime);
                                setShowCutoffModal(true);
                            }}
                            className="inline-flex min-h-8 items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                        >
                            <PencilLine className="h-3.5 w-3.5" />
                            <span>Edit cut-off</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setIsPulpitMode(!isPulpitMode)}
                        className={`inline-flex min-h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy ${
                            isPulpitMode
                                ? "bg-rcf-gold font-bold text-rcf-navy shadow-xs"
                                : "bg-rcf-navy text-white hover:bg-rcf-navy-light"
                        }`}
                    >
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>{isPulpitMode ? "Exit pulpit mode" : "Pulpit reading mode"}</span>
                    </button>
                </div>
            </div>

            {!loading && !loadError && !canModerate && (
                <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                    View only — Lo! admins publish and edit testimonies.
                </p>
            )}

            {/* Status tabs */}
            <div className="no-scrollbar -mx-1 mb-2.5 flex gap-2 overflow-x-auto px-1" role="tablist" aria-label="Review filters">
                {FILTERS.map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        role="tab"
                        aria-selected={filter === option.id}
                        onClick={() => setFilter(option.id)}
                        className={`min-h-10 shrink-0 rounded-xl border px-3 text-xs font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy ${
                            filter === option.id
                                ? "border-rcf-navy bg-rcf-navy text-white"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            {/* Cycle tabs */}
            <div className="mb-4">
                <div className="no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto px-1" role="tablist" aria-label="Reading cycle filters">
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                        Cycle:
                    </span>
                    {cycles.allCycles.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            role="tab"
                            aria-selected={cycle === c.id}
                            onClick={() => setCycle(c.id)}
                            className={`min-h-8 shrink-0 rounded-full border px-3 text-xs font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy ${
                                cycle === c.id
                                    ? "border-rcf-navy bg-rcf-navy text-white shadow-xs"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                            }`}
                        >
                            {c.label}
                            {c.id !== "all" && c.id !== "older" && (
                                <span className={`ml-1 text-[10px] ${cycle === c.id ? "text-rcf-gold font-bold" : "text-slate-400"}`}>
                                    ({c.sundayLabel})
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div role="status" className="flex flex-col items-center py-16 text-center">
                    <Loader2 className="mb-3 h-5 w-5 animate-spin text-rcf-navy motion-reduce:animate-none" aria-hidden="true" />
                    <p className="text-sm text-slate-500">Loading queue…</p>
                </div>
            ) : loadError ? (
                <div role="alert" className="flex flex-col items-center rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
                    <p className="text-sm font-medium text-red-700">{loadError}</p>
                    <button
                        type="button"
                        onClick={() => void load(filter, cycle)}
                        className="mt-3 min-h-10 text-xs font-semibold text-red-600 underline hover:text-red-700"
                    >
                        Try again
                    </button>
                </div>
            ) : isPulpitMode ? (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-rcf-navy p-4 text-white shadow-sm">
                        <div>
                            <div className="flex items-center gap-2">
                                <BookOpen className="h-5 w-5 text-rcf-gold" />
                                <h3 className="text-base font-bold text-white">Pulpit Reading View</h3>
                            </div>
                            <p className="mt-1 text-xs text-white/70">
                                Clean, high-contrast reading cards for Sunday service altar readings.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleCopyAll}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-rcf-gold px-3.5 text-xs font-bold text-rcf-navy shadow-sm transition-transform active:scale-95"
                        >
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy for WhatsApp / Bulletin</span>
                        </button>
                    </div>

                    {items.filter((t) => t.status === "approved").length === 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
                            <BookOpen className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
                            <p className="mt-3 text-sm font-medium text-slate-500">
                                No published testimonies in this cycle to read.
                            </p>
                        </div>
                    ) : (
                        <ul className="space-y-4">
                            {items
                                .filter((t) => t.status === "approved")
                                .map((item, idx) => {
                                    const isRead = !!readIds[item.id];
                                    return (
                                        <li
                                            key={item.id}
                                            className={`rounded-2xl border p-5 transition-all ${
                                                isRead
                                                    ? "border-slate-200 bg-slate-50 opacity-60"
                                                    : "border-slate-200/90 bg-white shadow-sm"
                                            }`}
                                        >
                                            <div className="mb-2 flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rcf-navy/10 text-xs font-extrabold text-rcf-navy">
                                                        {idx + 1}
                                                    </span>
                                                    <h4 className="text-base font-bold text-slate-900 sm:text-lg">
                                                        {item.title}
                                                    </h4>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setReadIds((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                                                    className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-colors ${
                                                        isRead
                                                            ? "border-green-300 bg-green-50 text-green-700"
                                                            : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                                                    }`}
                                                >
                                                    <Check className="h-3.5 w-3.5" />
                                                    <span>{isRead ? "Marked Read" : "Mark as Read"}</span>
                                                </button>
                                            </div>

                                            {item.scriptureReference && (
                                                <p className="mb-3 text-xs font-semibold italic text-rcf-gold">
                                                    📖 {item.scriptureReference}
                                                </p>
                                            )}

                                            <p className="text-sm font-medium leading-relaxed text-slate-800 whitespace-pre-wrap">
                                                {item.body}
                                            </p>

                                            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                                                <span>
                                                    Shared by:{" "}
                                                    <strong className="text-slate-900">
                                                        {item.isAnonymous ? "Anonymous Member" : item.authorName}
                                                    </strong>
                                                </span>
                                                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                                    {categoryLabel(item.category)}
                                                </span>
                                            </div>
                                        </li>
                                    );
                                })}
                        </ul>
                    )}
                </div>
            ) : items.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
                    <p className="mt-3 text-sm font-medium text-slate-500">
                        {filter === "pending" ? "Nothing waiting for review." : "Nothing here."}
                    </p>
                </div>
            ) : (
                <>
                    <ul className="space-y-3">
                        {items.map((item) => (
                            <li key={item.id}>
                                {editingId === item.id ? (
                                    <EditForm
                                        item={item}
                                        onCancel={() => setEditingId(null)}
                                        onSaved={(edit) => {
                                            replace(item.id, {
                                                title: edit.title,
                                                body: edit.body,
                                                category: edit.category,
                                                scriptureReference: edit.scriptureReference || null,
                                                editedAt: new Date().toISOString(),
                                            });
                                            setEditingId(null);
                                            onNotify?.("success", "Changes saved");
                                        }}
                                        onError={(message) => onNotify?.("error", message)}
                                    />
                                ) : (
                                    <ReviewCard
                                        item={item}
                                        busy={busyId === item.id}
                                        canModerate={canModerate}
                                        onAct={(action, note) => act(item, action, note)}
                                        onFeature={() => feature(item)}
                                        onEdit={() => setEditingId(item.id)}
                                    />
                                )}
                            </li>
                        ))}
                    </ul>

                    {hasMore && (
                        <div className="mt-4 flex justify-center">
                            <button
                                type="button"
                                onClick={loadMore}
                                disabled={loadingMore}
                                className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 hover:border-rcf-navy/40 hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:opacity-60"
                            >
                                {loadingMore && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                                {loadingMore ? "Loading…" : "Load more"}
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Cut-off Configuration Modal */}
            {showCutoffModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Edit Sunday Cut-off"
                >
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-rcf-navy" />
                                <h3 className="text-base font-bold text-slate-900">Sunday Reading Cut-off</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCutoffModal(false)}
                                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-4 text-xs text-slate-600">
                            <div>
                                <label htmlFor="override-time" className="mb-1 block font-bold text-slate-700">
                                    Today&apos;s Cut-off Override (WAT)
                                </label>
                                <p className="mb-2 text-[11px] text-slate-500">
                                    Temporarily adjust the cut-off for today&apos;s Sunday service (e.g. if testimonies are delayed to 10:30 AM).
                                </p>
                                <div className="flex items-center gap-2">
                                    <input
                                        id="override-time"
                                        type="time"
                                        value={overrideInput}
                                        onChange={(e) => setOverrideInput(e.target.value)}
                                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-rcf-navy focus:outline-none focus:ring-2 focus:ring-rcf-navy/20"
                                    />
                                    <button
                                        type="button"
                                        disabled={!overrideInput || updatingCutoff}
                                        onClick={() => handleSaveCutoff(overrideInput, undefined)}
                                        className="rounded-xl bg-rcf-navy px-4 py-2 font-semibold text-white hover:bg-rcf-navy-light disabled:opacity-50"
                                    >
                                        Apply Today
                                    </button>
                                    {cycleSettings.currentOverrideCutoff && (
                                        <button
                                            type="button"
                                            disabled={updatingCutoff}
                                            onClick={() => handleSaveCutoff(null, undefined)}
                                            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 font-semibold text-red-700 hover:bg-red-100"
                                        >
                                            Reset
                                        </button>
                                    )}
                                </div>
                            </div>

                            <hr className="border-slate-100" />

                            <div>
                                <label htmlFor="default-time" className="mb-1 block font-bold text-slate-700">
                                    Default Weekly Cut-off (WAT)
                                </label>
                                <p className="mb-2 text-[11px] text-slate-500">
                                    Standard recurring Sunday service cut-off (default is 09:00 AM).
                                </p>
                                <div className="flex items-center gap-2">
                                    <input
                                        id="default-time"
                                        type="time"
                                        value={defaultInput}
                                        onChange={(e) => setDefaultInput(e.target.value)}
                                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-rcf-navy focus:outline-none focus:ring-2 focus:ring-rcf-navy/20"
                                    />
                                    <button
                                        type="button"
                                        disabled={!defaultInput || updatingCutoff}
                                        onClick={() => handleSaveCutoff(undefined, defaultInput)}
                                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        Update Default
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowCutoffModal(false)}
                                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ReviewCard({
    item,
    busy,
    canModerate,
    onAct,
    onFeature,
    onEdit,
}: {
    item: Testimony;
    busy: boolean;
    canModerate: boolean;
    onAct: (action: Action, note: string) => void;
    onFeature: () => void;
    onEdit: () => void;
}) {
    const [note, setNote] = useState("");
    const [noteOpen, setNoteOpen] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const isLong = item.body.length > 480;

    return (
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={item.status} />
                {item.isFeatured && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rcf-gold/15 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                        <Star className="h-3 w-3 fill-current" aria-hidden="true" /> Featured
                    </span>
                )}
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                    {categoryLabel(item.category)}
                </span>
                <span className="text-xs text-slate-400">
                    {formatEventDateTime(parseEventDate(item.createdAt))}
                </span>
            </div>

            <h3 className="mt-2.5 text-sm font-bold text-slate-900">{item.title}</h3>
            <p className="mt-1 text-xs text-slate-500">
                by {item.authorName}
                {item.isAnonymous && (
                    <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                        posted anonymously
                    </span>
                )}
                {item.editedAt && (
                    <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] text-slate-400">
                        <PencilLine className="h-3 w-3" aria-hidden="true" /> edited
                    </span>
                )}
            </p>

            <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-slate-600">
                {isLong && !expanded ? `${item.body.slice(0, 480).trimEnd()}…` : item.body}
            </p>
            {isLong && (
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-1 min-h-9 text-xs font-semibold text-rcf-navy hover:underline"
                >
                    {expanded ? "Show less" : "Read all"}
                </button>
            )}

            {item.scriptureReference && (
                <p className="mt-2 text-xs font-semibold text-slate-500">{item.scriptureReference}</p>
            )}

            {item.reviewNote && (
                <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    <span className="font-semibold">Note to poster:</span> {item.reviewNote}
                </p>
            )}

            {canModerate && (
                <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
                    {/* The note is only needed when something isn't published, so it
                        starts folded away rather than taking a screen of space. */}
                    {noteOpen ? (
                        <div className="space-y-1.5">
                            <label htmlFor={`note-${item.id}`} className="block text-xs font-semibold tracking-wide text-slate-500 uppercase">
                                Note to the poster (optional)
                            </label>
                            <input
                                id={`note-${item.id}`}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                maxLength={300}
                                placeholder="Shown to them if this isn't published"
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-rcf-navy focus:ring-4 focus:ring-rcf-navy/10"
                            />
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setNoteOpen(true)}
                            className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-slate-500 hover:text-rcf-navy"
                        >
                            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /> Add a note to the poster
                        </button>
                    )}

                    {/* Two big buttons side by side on a phone — the decision a moderator
                        makes most — with the rarer actions in a quieter row below. */}
                    <div className="grid grid-cols-2 gap-2">
                        {item.status !== "approved" ? (
                            <ActionButton busy={busy} tone="primary" onClick={() => onAct(item.status === "hidden" ? "restore" : "approve", note)}>
                                {item.status === "hidden" ? "Restore" : "Publish"}
                            </ActionButton>
                        ) : (
                            <ActionButton busy={busy} tone="muted" onClick={() => onAct("hide", note)}>
                                Hide
                            </ActionButton>
                        )}
                        {item.status !== "rejected" ? (
                            <ActionButton busy={busy} tone="danger" onClick={() => onAct("reject", note)}>
                                Don&apos;t publish
                            </ActionButton>
                        ) : (
                            <span />
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={onEdit}
                            disabled={busy}
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:opacity-50"
                        >
                            <PencilLine className="h-4 w-4" aria-hidden="true" /> Edit
                        </button>
                        {item.status === "approved" && (
                            <button
                                type="button"
                                onClick={onFeature}
                                disabled={busy}
                                aria-pressed={item.isFeatured}
                                className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:opacity-50 ${
                                    item.isFeatured ? "bg-rcf-gold/15 text-amber-700" : "text-slate-600 hover:bg-slate-100"
                                }`}
                            >
                                <Star className={`h-4 w-4 ${item.isFeatured ? "fill-current" : ""}`} aria-hidden="true" />
                                {item.isFeatured ? "Unfeature" : "Feature"}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </article>
    );
}

/**
 * Correct a testimony in place. Same zod schema as the server action, so what passes
 * here passes there; errors show under the field that caused them.
 */
function EditForm({
    item,
    onCancel,
    onSaved,
    onError,
}: {
    item: Testimony;
    onCancel: () => void;
    onSaved: (edit: TestimonyEdit) => void;
    onError: (message: string) => void;
}) {
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<TestimonyEdit>({
        resolver: zodResolver(testimonyEditSchema),
        defaultValues: {
            title: item.title,
            body: item.body,
            category: item.category,
            scriptureReference: item.scriptureReference || "",
        },
    });

    const submit = async (values: TestimonyEdit) => {
        const result = await editTestimonyAction(item.id, values);
        if (result.success) onSaved(values);
        else onError(result.error || "Couldn't save the changes");
    };

    const field =
        "w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-rcf-navy focus:ring-4 focus:ring-rcf-navy/10";
    const label = "block text-xs font-semibold tracking-wide text-slate-500 uppercase";

    return (
        <form
            onSubmit={handleSubmit(submit)}
            noValidate
            className="space-y-4 rounded-2xl border border-rcf-navy/20 bg-white p-4"
            aria-label={`Edit “${item.title}”`}
        >
            <p className="text-xs text-slate-500">
                Fix what the poster meant to say. They&apos;ll see that a moderator edited it.
            </p>

            <div className="space-y-1.5">
                <label htmlFor={`edit-title-${item.id}`} className={label}>Title</label>
                <input
                    id={`edit-title-${item.id}`}
                    {...register("title")}
                    aria-invalid={!!errors.title}
                    className={`${field} h-11`}
                />
                {errors.title && <p className="text-xs text-red-600">{errors.title.message}</p>}
            </div>

            <div className="space-y-1.5">
                <label htmlFor={`edit-body-${item.id}`} className={label}>Testimony</label>
                <textarea
                    id={`edit-body-${item.id}`}
                    {...register("body")}
                    rows={8}
                    aria-invalid={!!errors.body}
                    className={`${field} py-2.5 leading-relaxed`}
                />
                {errors.body && <p className="text-xs text-red-600">{errors.body.message}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <label htmlFor={`edit-category-${item.id}`} className={label}>Category</label>
                    <select id={`edit-category-${item.id}`} {...register("category")} className={`${field} h-11`}>
                        {TESTIMONY_CATEGORIES.map((c) => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                    </select>
                    {errors.category && <p className="text-xs text-red-600">{errors.category.message}</p>}
                </div>
                <div className="space-y-1.5">
                    <label htmlFor={`edit-scripture-${item.id}`} className={label}>Scripture (optional)</label>
                    <input
                        id={`edit-scripture-${item.id}`}
                        {...register("scriptureReference")}
                        aria-invalid={!!errors.scriptureReference}
                        placeholder="e.g. Psalm 23:1"
                        className={`${field} h-11`}
                    />
                    {errors.scriptureReference && (
                        <p className="text-xs text-red-600">{errors.scriptureReference.message}</p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="h-11 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-rcf-navy text-sm font-semibold text-white hover:bg-rcf-navy-light disabled:opacity-60"
                >
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                    {isSubmitting ? "Saving…" : "Save changes"}
                </button>
            </div>
        </form>
    );
}

function StatusPill({ status }: { status: TestimonyStatus }) {
    const map = {
        pending: { label: "Awaiting review", tone: "bg-amber-50 text-amber-700", Icon: Clock },
        approved: {
            label: "Published",
            tone: "bg-emerald-50 text-emerald-700",
            Icon: CheckCircle2,
        },
        rejected: { label: "Not published", tone: "bg-red-50 text-red-700", Icon: ShieldAlert },
        hidden: { label: "Hidden", tone: "bg-slate-100 text-slate-600", Icon: EyeOff },
    } as const;

    const { label, tone, Icon } = map[status];

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}
        >
            <Icon className="h-3 w-3" aria-hidden="true" />
            {label}
        </span>
    );
}

function ActionButton({
    busy,
    tone,
    onClick,
    children,
}: {
    busy: boolean;
    tone: "primary" | "muted" | "danger";
    onClick: () => void;
    children: React.ReactNode;
}) {
    const tones = {
        primary: "bg-rcf-navy text-white hover:bg-rcf-navy-light",
        muted: "border border-slate-200 text-slate-600 hover:bg-slate-50",
        danger: "border border-red-200 text-red-600 hover:bg-red-50",
    };

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={busy}
            className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:opacity-50 ${tones[tone]}`}
        >
            {busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {children}
        </button>
    );
}
