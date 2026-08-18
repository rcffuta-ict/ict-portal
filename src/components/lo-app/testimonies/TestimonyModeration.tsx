"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    CheckCircle2,
    Clock,
    EyeOff,
    Loader2,
    RefreshCw,
    ShieldAlert,
    ShieldCheck,
} from "lucide-react";
import {
    getTestimoniesForReview,
    moderateTestimony,
} from "@/app/lo-app/testimonies/actions";
import { categoryLabel, type Testimony, type TestimonyStatus } from "@/lib/testimonies";
import { formatEventDateTime, parseEventDate } from "@/lib/event-utils";

interface TestimonyModerationProps {
    onNotify?: (type: "success" | "error", message: string) => void;
}

type QueueFilter = "pending" | "approved" | "rejected" | "hidden" | "all";

const FILTERS: { id: QueueFilter; label: string }[] = [
    { id: "pending", label: "Awaiting review" },
    { id: "approved", label: "Published" },
    { id: "rejected", label: "Not published" },
    { id: "hidden", label: "Hidden" },
    { id: "all", label: "All" },
];

/**
 * The review queue. Testimonies are held until a moderator releases them, so this
 * is the only path to a public testimony — the action behind each button re-checks
 * ADMIN server-side.
 */
export function TestimonyModeration({ onNotify }: TestimonyModerationProps) {
    const [items, setItems] = useState<Testimony[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<QueueFilter>("pending");
    const [busyId, setBusyId] = useState<string | null>(null);
    const [notes, setNotes] = useState<Record<string, string>>({});

    const load = useCallback(async () => {
        setLoading(true);
        const result = await getTestimoniesForReview();
        if (result.success) {
            setItems(result.data);
        } else {
            onNotify?.("error", result.error || "Failed to load the review queue");
        }
        setLoading(false);
    }, [onNotify]);

    // Kick the first fetch off asynchronously: setting state synchronously inside an
    // effect body triggers a cascading render (and trips react-hooks lint).
    useEffect(() => {
        let active = true;

        getTestimoniesForReview()
            .then((result) => {
                if (!active) return;
                if (result.success) setItems(result.data);
                else onNotify?.("error", result.error || "Failed to load the review queue");
            })
            .catch(() => {
                if (active) onNotify?.("error", "Failed to load the review queue");
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
        // Mount only; the refresh button re-runs `load` on demand.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const counts = useMemo(() => {
        const base: Record<string, number> = {
            pending: 0,
            approved: 0,
            rejected: 0,
            hidden: 0,
            all: items.length,
        };
        for (const item of items) base[item.status] = (base[item.status] || 0) + 1;
        return base;
    }, [items]);

    const visible = useMemo(
        () => (filter === "all" ? items : items.filter((item) => item.status === filter)),
        [items, filter],
    );

    const act = async (
        id: string,
        action: "approve" | "reject" | "hide" | "restore",
        nextStatus: TestimonyStatus,
    ) => {
        setBusyId(id);
        const result = await moderateTestimony(id, action, notes[id]);

        if (result.success) {
            setItems((prev) =>
                prev.map((item) =>
                    item.id === id
                        ? { ...item, status: nextStatus, reviewNote: notes[id] || item.reviewNote }
                        : item,
                ),
            );
            onNotify?.(
                "success",
                action === "approve" || action === "restore"
                    ? "Testimony published"
                    : action === "reject"
                        ? "Testimony not published"
                        : "Testimony hidden",
            );
        } else {
            onNotify?.("error", result.error || "That didn't work");
        }
        setBusyId(null);
    };

    return (
        <div className="p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-rcf-navy" />
                    <h2 className="text-base font-bold text-slate-900">Testimony review</h2>
                </div>
                <button
                    type="button"
                    onClick={load}
                    aria-label="Refresh queue"
                    className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                    <RefreshCw className="h-4 w-4" />
                </button>
            </div>

            <div className="no-scrollbar -mx-1 mb-4 flex gap-2 overflow-x-auto px-1">
                {FILTERS.map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        onClick={() => setFilter(option.id)}
                        aria-pressed={filter === option.id}
                        className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                            filter === option.id
                                ? "border-rcf-navy bg-rcf-navy text-white"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                    >
                        {option.label}
                        {!!counts[option.id] && (
                            <span className="ml-1.5 tabular-nums opacity-70">
                                {counts[option.id]}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex flex-col items-center py-16 text-center">
                    <Loader2 className="mb-3 h-5 w-5 animate-spin text-rcf-navy" />
                    <p className="text-sm text-slate-500">Loading queue...</p>
                </div>
            ) : visible.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-medium text-slate-500">
                        {filter === "pending"
                            ? "Nothing waiting for review."
                            : "Nothing here."}
                    </p>
                </div>
            ) : (
                <ul className="space-y-3">
                    {visible.map((item) => (
                        <li
                            key={item.id}
                            className="rounded-2xl border border-slate-200 bg-white p-4"
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <StatusPill status={item.status} />
                                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                                    {categoryLabel(item.category)}
                                </span>
                                <span className="text-xs text-slate-400">
                                    {formatEventDateTime(parseEventDate(item.createdAt))}
                                </span>
                            </div>

                            <h3 className="mt-2.5 text-sm font-bold text-slate-900">
                                {item.title}
                            </h3>
                            <p className="mt-1 text-xs text-slate-500">
                                by {item.authorName}
                                {item.isAnonymous && (
                                    <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                                        posted anonymously
                                    </span>
                                )}
                            </p>

                            <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-slate-600">
                                {item.body}
                            </p>

                            {item.scriptureReference && (
                                <p className="mt-2 text-xs font-semibold text-slate-500">
                                    {item.scriptureReference}
                                </p>
                            )}

                            <div className="mt-4 space-y-2">
                                <label
                                    htmlFor={`note-${item.id}`}
                                    className="block text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                >
                                    Note to the poster (optional)
                                </label>
                                <input
                                    id={`note-${item.id}`}
                                    value={notes[item.id] || ""}
                                    onChange={(e) =>
                                        setNotes((prev) => ({
                                            ...prev,
                                            [item.id]: e.target.value,
                                        }))
                                    }
                                    placeholder="Shown to them if this isn't published"
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-rcf-navy focus:ring-4 focus:ring-rcf-navy/10"
                                />

                                <div className="flex flex-wrap gap-2 pt-1">
                                    {item.status !== "approved" && (
                                        <ActionButton
                                            busy={busyId === item.id}
                                            tone="primary"
                                            onClick={() =>
                                                act(
                                                    item.id,
                                                    item.status === "hidden"
                                                        ? "restore"
                                                        : "approve",
                                                    "approved",
                                                )
                                            }
                                        >
                                            {item.status === "hidden" ? "Restore" : "Publish"}
                                        </ActionButton>
                                    )}
                                    {item.status === "approved" && (
                                        <ActionButton
                                            busy={busyId === item.id}
                                            tone="muted"
                                            onClick={() => act(item.id, "hide", "hidden")}
                                        >
                                            Hide
                                        </ActionButton>
                                    )}
                                    {item.status !== "rejected" && (
                                        <ActionButton
                                            busy={busyId === item.id}
                                            tone="danger"
                                            onClick={() => act(item.id, "reject", "rejected")}
                                        >
                                            Don&apos;t publish
                                        </ActionButton>
                                    )}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
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
            <Icon className="h-3 w-3" />
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
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${tones[tone]}`}
        >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {children}
        </button>
    );
}
