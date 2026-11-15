"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, BookOpen, HandHeart, Loader2, RefreshCw, Search } from "lucide-react";
import { MemberGate } from "./MemberGate";
import { TestimonyCard } from "./TestimonyCard";
import { TestimonyComposer } from "./TestimonyComposer";
import { PulpitView } from "./PulpitView";
import {
    getFeaturedTestimony,
    getTestimonies,
    getTestimonyCategoryCounts,
    getTestimonyCycleCounts,
    getTestimonyCycleSettings,
    toggleAmen,
} from "@/app/lo-app/testimonies/actions";
import { forgetLoMember, getLoMemberIdentity, getLoViewer } from "@/app/lo-app/actions";
import { TESTIMONY_CATEGORIES, type Testimony, type TestimonyCategory } from "@/lib/testimonies";
import {
    computeTestimonyCycles,
    DEFAULT_CYCLE_SETTINGS,
    type TestimonyCycleId,
    type TestimonyCycleSettings,
} from "@/lib/testimony-cycle";
import type { LoEvent } from "../LoAppClient";
import type { LoMember } from "@/lib/lo-member";

interface TestimonyFeedProps {
    events: LoEvent[];
    /** Bubbles up so the shell can show its toast. */
    onNotify?: (type: "success" | "error", message: string) => void;
}

type CategoryFilter = TestimonyCategory | "all";

export function TestimonyFeed({ events, onNotify }: TestimonyFeedProps) {
    const [member, setMember] = useState<LoMember | null>(null);
    const [memberResolved, setMemberResolved] = useState(false);
    const [showGate, setShowGate] = useState(false);

    const [testimonies, setTestimonies] = useState<Testimony[]>([]);
    const [featured, setFeatured] = useState<Testimony | null>(null);
    const [categoryCounts, setCategoryCounts] = useState<Record<string, number> | null>(null);
    const [publishedTotal, setPublishedTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [moreError, setMoreError] = useState<string | null>(null);
    const [category, setCategory] = useState<CategoryFilter>("all");
    const [cycle, setCycle] = useState<TestimonyCycleId>("this_week");
    const [cycleSettings, setCycleSettings] = useState<TestimonyCycleSettings>(DEFAULT_CYCLE_SETTINGS);
    const [cycleCounts, setCycleCounts] = useState<Record<TestimonyCycleId, number>>({
        this_week: 0,
        last_week: 0,
        two_weeks_ago: 0,
        older: 0,
        all: 0,
    });
    const [isExco, setIsExco] = useState(false);
    const [isPulpitMode, setIsPulpitMode] = useState(false);
    const [search, setSearch] = useState("");

    const cycles = useMemo(() => computeTestimonyCycles(new Date(), cycleSettings), [cycleSettings]);

    // Who is this? A portal session counts automatically; otherwise it's whoever
    // confirmed themselves on this device before.
    useEffect(() => {
        let active = true;
        getLoMemberIdentity()
            .then((result) => {
                if (active) setMember(result);
            })
            .catch(() => undefined)
            .finally(() => {
                if (active) setMemberResolved(true);
            });
        return () => {
            active = false;
        };
    }, []);

    // The featured card and the chip counts don't depend on the filter, so they load
    // once (and again after a post), not on every keystroke. Both are extras: if either
    // fails the feed still works, so their errors are swallowed.
    const loadExtras = useCallback(async () => {
        const [featuredResult, countsResult, settings, cycleCountsRes, viewer] = await Promise.all([
            getFeaturedTestimony().catch(() => null),
            getTestimonyCategoryCounts().catch(() => null),
            getTestimonyCycleSettings().catch(() => DEFAULT_CYCLE_SETTINGS),
            getTestimonyCycleCounts().catch(() => null),
            getLoViewer().catch(() => null),
        ]);
        if (featuredResult?.success) setFeatured(featuredResult.data);
        if (countsResult?.success) {
            setCategoryCounts(countsResult.data);
            setPublishedTotal(countsResult.total);
        }
        if (settings) setCycleSettings(settings);
        if (cycleCountsRes) setCycleCounts(cycleCountsRes);
        if (viewer?.isExco) setIsExco(true);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => void loadExtras(), 0);
        return () => clearTimeout(timer);
    }, [loadExtras]);

    /** First page for the current filter — replaces the list. */
    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        setMoreError(null);
        try {
            const result = await getTestimonies({ category, search, cycle });
            if (result.success) {
                setTestimonies(result.data);
                setHasMore(result.hasMore);
            } else {
                setError(result.error || "Failed to load testimonies");
            }
        } catch {
            setError("Failed to load testimonies");
        } finally {
            setLoading(false);
        }
    }, [category, search, cycle]);

    /**
     * The next page, on request. A button, not infinite scroll: on mobile data the
     * reader decides when to spend more, and a failure stays next to the button.
     */
    const loadMore = async () => {
        const last = testimonies[testimonies.length - 1];
        if (!last || loadingMore) return;
        setLoadingMore(true);
        setMoreError(null);
        try {
            const result = await getTestimonies({ category, search, before: last.createdAt, cycle });
            if (result.success) {
                setTestimonies((prev) => {
                    const seen = new Set(prev.map((t) => t.id));
                    return [...prev, ...result.data.filter((t) => !seen.has(t.id))];
                });
                setHasMore(result.hasMore);
            } else {
                setMoreError(result.error || "Couldn't load more testimonies");
            }
        } catch {
            setMoreError("Couldn't load more testimonies");
        } finally {
            setLoadingMore(false);
        }
    };

    const onPosted = () => {
        void load();
        void loadExtras();
    };

    // Debounced so typing in the search box doesn't fire a request per keystroke.
    useEffect(() => {
        const timer = setTimeout(() => load(), 350);
        return () => clearTimeout(timer);
    }, [load]);

    const handleAmen = async (id: string) => {
        const current = testimonies.find((t) => t.id === id) || (featured?.id === id ? featured : null);
        if (!current) return;

        const wasAmened = current.viewerHasAmened;
        const flip = (t: Testimony, toward: boolean): Testimony =>
            t.id === id
                ? { ...t, viewerHasAmened: toward, amenCount: t.amenCount + (toward ? 1 : -1) }
                : t;
        setTestimonies((prev) => prev.map((t) => flip(t, !wasAmened)));
        setFeatured((prev) => (prev ? flip(prev, !wasAmened) : prev));

        const result = await toggleAmen(id);
        if (!result.success) {
            // Roll the optimistic update back.
            setTestimonies((prev) => prev.map((t) => flip(t, wasAmened)));
            setFeatured((prev) => (prev ? flip(prev, wasAmened) : prev));
            onNotify?.("error", result.error || "Couldn't record your Amen");
        }
    };

    const handleForget = async () => {
        await forgetLoMember();
        setMember(null);
        setShowGate(false);
        load();
    };

    // The pinned card belongs to the unfiltered feed only.
    const showFeatured = !!featured && category === "all" && !search.trim();

    return (
        <>
            <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
                {/* Conspicuous Exco Pulpit Mode Banner */}
                {isExco && (
                    <div className="mb-3 flex items-center justify-between rounded-xl bg-rcf-navy px-3.5 py-2.5 text-white shadow-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rcf-gold text-rcf-navy shadow-xs">
                                <BookOpen className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-white tracking-wide">
                                        Pulpit Reading Mode
                                    </span>
                                    <span className="rounded-full bg-rcf-gold/20 px-1.5 py-0.5 text-[9px] font-semibold text-rcf-gold">
                                        Excos
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-300 truncate">
                                    {isPulpitMode ? "Active: Large text & read tracker" : "Optimized for reading on the pulpit"}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsPulpitMode(!isPulpitMode)}
                            className={`shrink-0 ml-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all shadow-xs active:scale-95 ${
                                isPulpitMode
                                    ? "bg-rcf-gold text-rcf-navy hover:bg-amber-300"
                                    : "bg-white text-rcf-navy hover:bg-slate-100"
                            }`}
                        >
                            <BookOpen className="h-3.5 w-3.5" />
                            <span>{isPulpitMode ? "Exit Pulpit" : "Enter Pulpit"}</span>
                        </button>
                    </div>
                )}

                <div className="relative">
                    <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <label htmlFor="testimony-search" className="sr-only">
                        Search testimonies
                    </label>
                    <input
                        id="testimony-search"
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search testimonies"
                        className="w-full rounded-full border border-transparent bg-white py-2.5 pr-4 pl-10 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-500 focus:border-rcf-navy focus:ring-4 focus:ring-rcf-navy/10"
                    />
                </div>

                <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1">
                    <CategoryChip
                        active={category === "all"}
                        onClick={() => setCategory("all")}
                        label="All"
                        count={categoryCounts ? publishedTotal : undefined}
                    />
                    {TESTIMONY_CATEGORIES
                        // Once counts are in, an empty category is a dead end — leave it
                        // out, unless it is the one already selected.
                        .filter((option) => !categoryCounts || categoryCounts[option.id] || category === option.id)
                        .map((option) => (
                            <CategoryChip
                                key={option.id}
                                active={category === option.id}
                                onClick={() => setCategory(option.id)}
                                label={option.label}
                                count={categoryCounts?.[option.id]}
                            />
                        ))}
                </div>

                {/* Sunday Cycle Filter Chips */}
                <div className="no-scrollbar -mx-1 mt-2.5 flex items-center gap-1.5 overflow-x-auto px-1">
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                        Sunday:
                    </span>
                    {cycles.allCycles.map((c) => {
                        const count = cycleCounts[c.id];
                        return (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => setCycle(c.id)}
                                className={`min-h-7 shrink-0 rounded-full border px-2.5 text-[11px] font-semibold whitespace-nowrap transition-colors inline-flex items-center gap-1.5 ${
                                    cycle === c.id
                                        ? "border-rcf-navy bg-rcf-navy text-white shadow-xs"
                                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                }`}
                            >
                                <span>{c.label}</span>
                                {c.id !== "all" && c.id !== "older" && (
                                    <span className={`text-[9px] ${cycle === c.id ? "text-rcf-gold font-bold" : "text-slate-400"}`}>
                                        ({c.sundayLabel})
                                    </span>
                                )}
                                {count !== undefined && (
                                    <span
                                        className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                                            cycle === c.id
                                                ? "bg-white/20 text-white"
                                                : "bg-slate-100 text-slate-600"
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

            {/* Compose — members post; everyone else is offered the membership check */}
            {memberResolved &&
                (member ? (
                    <>
                        <TestimonyComposer member={member} events={events} onPosted={onPosted} />
                        <div className="px-4 pt-2 pb-3 text-[11px] text-slate-400">
                            Posting as{" "}
                            <span className="font-semibold text-slate-500">
                                {member.fullName}
                            </span>
                            {member.via === "link" && (
                                <>
                                    {" · "}
                                    <button
                                        type="button"
                                        onClick={handleForget}
                                        className="font-semibold text-slate-500 underline hover:text-rcf-navy"
                                    >
                                        Not you?
                                    </button>
                                </>
                            )}
                        </div>
                    </>
                ) : showGate ? (
                    <MemberGate
                        onVerified={(verified) => {
                            setMember(verified);
                            setShowGate(false);
                            load();
                        }}
                    />
                ) : (
                    <div className="border-b border-slate-100 px-4 py-5">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <p className="text-sm font-semibold text-slate-900">
                                Have a testimony to share?
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-slate-500">
                                Testimonies are posted by fellowship members. Confirm your
                                membership once on this device — no account or password needed.
                            </p>
                            <button
                                type="button"
                                onClick={() => setShowGate(true)}
                                className="mt-3 w-full rounded-2xl bg-rcf-navy px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-rcf-navy-light sm:w-auto"
                            >
                                Share a testimony
                            </button>
                        </div>
                    </div>
                ))}

            {isPulpitMode ? (
                <div className="p-4">
                    <PulpitView
                        items={testimonies}
                        cycle={cycle}
                        cycles={cycles}
                        cycleCounts={cycleCounts}
                        onCycleChange={(newCycle) => setCycle(newCycle)}
                        onClose={() => setIsPulpitMode(false)}
                        onNotify={onNotify}
                    />
                </div>
            ) : loading && testimonies.length === 0 && !(showFeatured && featured) ? (
                <div className="flex flex-col items-center py-20 text-center">
                    <Loader2 className="mb-3 h-5 w-5 animate-spin text-rcf-navy motion-reduce:animate-none" />
                    <p className="text-sm text-slate-500">Loading testimonies...</p>
                </div>
            ) : error ? (
                <div className="m-4 flex flex-col items-center rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
                    <AlertCircle className="mb-2 h-5 w-5 text-red-600" />
                    <p className="text-sm font-medium text-red-700">{error}</p>
                    <button
                        type="button"
                        onClick={load}
                        className="mt-3 text-xs font-semibold text-red-600 underline hover:text-red-700"
                    >
                        Try again
                    </button>
                </div>
            ) : testimonies.length === 0 && !showFeatured ? (
                <div className="flex flex-col items-center px-4 py-20 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rcf-navy/5">
                        <HandHeart className="h-8 w-8 text-rcf-navy/30" />
                    </div>
                    <h3 className="mb-1 text-lg font-bold text-slate-900">
                        {search || category !== "all" ? "Nothing here yet" : "No testimonies yet"}
                    </h3>
                    <p className="max-w-sm text-sm text-slate-500">
                        {search || category !== "all"
                            ? "Try a different search or category."
                            : "Be the first to testify of what God has done."}
                    </p>
                </div>
            ) : (
                <div>
                    {showFeatured && featured && (
                        <TestimonyCard
                            testimony={featured}
                            canAmen={!!member}
                            onAmen={handleAmen}
                            onRequestMembership={() => setShowGate(true)}
                            featured
                        />
                    )}
                    {testimonies
                        .filter((t) => !(showFeatured && t.id === featured?.id))
                        .map((testimony) => (
                            <TestimonyCard
                                key={testimony.id}
                                testimony={testimony}
                                canAmen={!!member}
                                onAmen={handleAmen}
                                onRequestMembership={() => setShowGate(true)}
                            />
                        ))}

                    {(hasMore || moreError) && (
                        <div className="flex flex-col items-center gap-2 px-4 py-6">
                            {moreError && (
                                <p role="alert" className="text-xs text-red-600">
                                    {moreError}
                                </p>
                            )}
                            <button
                                type="button"
                                onClick={loadMore}
                                disabled={loadingMore}
                                className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 transition-colors hover:border-rcf-navy/40 hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:opacity-60"
                            >
                                {loadingMore && (
                                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                                )}
                                {loadingMore ? "Loading…" : moreError ? "Try again" : "Load more testimonies"}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {loading && testimonies.length > 0 && (
                <div className="flex justify-center py-6">
                    <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
                </div>
            )}

            {/* Mobile Floating Action Button for Excos */}
            {isExco && !isPulpitMode && (
                <div className="fixed right-4 bottom-20 z-40 lg:hidden">
                    <button
                        type="button"
                        onClick={() => setIsPulpitMode(true)}
                        className="inline-flex items-center gap-2 rounded-full bg-rcf-navy px-4 py-2.5 text-xs font-bold text-white shadow-xl ring-2 ring-white/80 transition-all active:scale-95 hover:bg-rcf-navy-light"
                    >
                        <BookOpen className="h-4 w-4 text-rcf-gold" />
                        <span>Pulpit Mode</span>
                    </button>
                </div>
            )}
        </>
    );
}

function CategoryChip({
    active,
    onClick,
    label,
    count,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    /** Published testimonies in this category; omitted until the counts arrive. */
    count?: number;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`inline-flex min-h-9 shrink-0 items-center rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                active
                    ? "bg-rcf-navy text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900"
            }`}
        >
            {label}
            {count !== undefined && (
                <span className={`ml-1.5 tabular-nums ${active ? "text-white/70" : "text-slate-400"}`}>
                    {count}
                </span>
            )}
        </button>
    );
}
