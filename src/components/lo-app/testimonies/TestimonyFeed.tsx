"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, HandHeart, Loader2, RefreshCw, Search } from "lucide-react";
import { MemberGate } from "./MemberGate";
import { TestimonyCard } from "./TestimonyCard";
import { TestimonyComposer } from "./TestimonyComposer";
import { getTestimonies, toggleAmen } from "@/app/lo-app/testimonies/actions";
import { forgetLoMember, getLoMemberIdentity } from "@/app/lo-app/actions";
import { TESTIMONY_CATEGORIES, type Testimony, type TestimonyCategory } from "@/lib/testimonies";
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [category, setCategory] = useState<CategoryFilter>("all");
    const [search, setSearch] = useState("");

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

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getTestimonies({ category, search });
            if (result.success) {
                setTestimonies(result.data);
            } else {
                setError(result.error || "Failed to load testimonies");
            }
        } catch {
            setError("Failed to load testimonies");
        } finally {
            setLoading(false);
        }
    }, [category, search]);

    // Debounced so typing in the search box doesn't fire a request per keystroke.
    useEffect(() => {
        const timer = setTimeout(() => load(), 350);
        return () => clearTimeout(timer);
    }, [load]);

    const handleAmen = async (id: string) => {
        const current = testimonies.find((t) => t.id === id);
        if (!current) return;

        const wasAmened = current.viewerHasAmened;
        setTestimonies((prev) =>
            prev.map((t) =>
                t.id === id
                    ? {
                        ...t,
                        viewerHasAmened: !wasAmened,
                        amenCount: t.amenCount + (wasAmened ? -1 : 1),
                    }
                    : t,
            ),
        );

        const result = await toggleAmen(id);
        if (!result.success) {
            // Roll the optimistic update back.
            setTestimonies((prev) =>
                prev.map((t) =>
                    t.id === id
                        ? {
                            ...t,
                            viewerHasAmened: wasAmened,
                            amenCount: t.amenCount + (wasAmened ? 1 : -1),
                        }
                        : t,
                ),
            );
            onNotify?.("error", result.error || "Couldn't record your Amen");
        }
    };

    const handleForget = async () => {
        await forgetLoMember();
        setMember(null);
        setShowGate(false);
        load();
    };

    return (
        <>
            <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
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
                    />
                    {TESTIMONY_CATEGORIES.map((option) => (
                        <CategoryChip
                            key={option.id}
                            active={category === option.id}
                            onClick={() => setCategory(option.id)}
                            label={option.label}
                        />
                    ))}
                </div>
            </div>

            {/* Compose — members post; everyone else is offered the membership check */}
            {memberResolved &&
                (member ? (
                    <>
                        <TestimonyComposer member={member} events={events} onPosted={load} />
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

            {loading && testimonies.length === 0 ? (
                <div className="flex flex-col items-center py-20 text-center">
                    <Loader2 className="mb-3 h-5 w-5 animate-spin text-rcf-navy" />
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
            ) : testimonies.length === 0 ? (
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
                    {testimonies.map((testimony) => (
                        <TestimonyCard
                            key={testimony.id}
                            testimony={testimony}
                            canAmen={!!member}
                            onAmen={handleAmen}
                            onRequestMembership={() => setShowGate(true)}
                        />
                    ))}
                </div>
            )}

            {loading && testimonies.length > 0 && (
                <div className="flex justify-center py-6">
                    <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
                </div>
            )}
        </>
    );
}

function CategoryChip({
    active,
    onClick,
    label,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                active
                    ? "bg-rcf-navy text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900"
            }`}
        >
            {label}
        </button>
    );
}
