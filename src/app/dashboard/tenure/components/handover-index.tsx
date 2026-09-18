"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
    ArrowRight,
    Play,
    Loader2,
    CheckCircle2,
    CircleDashed,
    XCircle,
    AlertTriangle,
    History,
    Flag,
} from "lucide-react";
import { createHandoverIntentAction, abandonHandoverIntentAction } from "../actions";
import { useAlertModal, AlertModal } from "@/components/ui/alert-modal";

export interface HandoverIntentRow {
    id: string;
    status: "draft" | "in_progress" | "completed" | "abandoned";
    step: number;
    fromTenure: { id: string | null; name: string | null; session: string | null };
    toTenure: { id: string; name: string | null; session: string | null } | null;
    plannedName: string | null;
    plannedSession: string | null;
    initiatedBy: string | null;
    completedBy: string | null;
    completedAt: string | null;
    abandonedReason: string | null;
    createdAt: string;
    updatedAt: string;
}

const TOTAL_STEPS = 6;

/**
 * The handover ledger.
 *
 * An OPEN intent is pulled to the top and given the primary action, because resuming
 * one is almost always why someone opened this page. Everything else reads as history.
 */
export function HandoverIndex({
    intents,
    loadError,
}: {
    intents: HandoverIntentRow[];
    loadError: string | null;
}) {
    const router = useRouter();
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();

    const [starting, setStarting] = useState(false);
    const [abandoning, setAbandoning] = useState<string | null>(null);

    const open = intents.find((i) => i.status === "draft" || i.status === "in_progress");
    const history = intents.filter((i) => i !== open);

    const begin = async () => {
        setStarting(true);
        const res = await createHandoverIntentAction();

        if (!res.success) {
            setStarting(false);
            showAlert({
                type: "error",
                title: "Could not start",
                message: res.error || "Unknown error.",
            });
            return;
        }

        // `joined` means someone else had already opened one — say so rather than
        // letting it look like a brand-new handover they just created.
        if (res.joined) {
            showAlert({
                type: "info",
                title: "Picking up where it was left",
                message: "A handover of this tenure was already underway, so you're continuing that one.",
            });
        }
        router.push(`/dashboard/tenure/handover/${res.intentId}`);
    };

    const abandon = async (id: string) => {
        setAbandoning(id);
        const res = await abandonHandoverIntentAction(id);
        setAbandoning(null);

        if (!res.success) {
            showAlert({ type: "error", title: "Could not abandon", message: res.error || "Unknown error." });
            return;
        }
        router.refresh();
    };

    return (
        <>
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />

            {loadError && (
                <p
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    {loadError}
                </p>
            )}

            {/* --- The open one, or the invitation to start --------------------- */}
            {open ? (
                <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={open.status} />
                        <span className="text-xs font-medium text-amber-800">
                            step {Math.min(open.step + 1, TOTAL_STEPS)} of {TOTAL_STEPS}
                        </span>
                    </div>

                    <h2 className="mt-2 text-lg font-bold text-amber-900">
                        {open.fromTenure.name ?? "Current tenure"}
                        {open.plannedName ? ` → ${open.plannedName}` : " → …"}
                    </h2>
                    <p className="text-sm text-amber-800/90">
                        Started by {open.initiatedBy ?? "someone"} · last touched{" "}
                        {formatWat(open.updatedAt)}
                    </p>

                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-amber-200">
                        <div
                            className="h-full rounded-full bg-amber-600 transition-all"
                            style={{ width: `${(open.step / TOTAL_STEPS) * 100}%` }}
                        />
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <a
                            href={`/dashboard/tenure/handover/${open.id}`}
                            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 text-sm font-bold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
                        >
                            <Play className="h-4 w-4" aria-hidden="true" />
                            Resume handover
                        </a>
                        <button
                            type="button"
                            disabled={abandoning === open.id}
                            onClick={() => abandon(open.id)}
                            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-amber-300 px-4 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 disabled:opacity-50"
                        >
                            {abandoning === open.id && (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            )}
                            Abandon
                        </button>
                    </div>
                </section>
            ) : (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
                    <Flag className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
                    <h2 className="mt-2 text-base font-bold text-rcf-navy">
                        No handover in progress
                    </h2>
                    <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-slate-500">
                        Starting one opens a six-step wizard. Nothing is committed until the
                        last step, and your progress is saved as you go — you can close the
                        page and come back.
                    </p>
                    <button
                        type="button"
                        onClick={begin}
                        disabled={starting || !!loadError}
                        className="mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-rcf-navy px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:opacity-50"
                    >
                        {starting ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        )}
                        {starting ? "Starting…" : "Begin a handover"}
                    </button>
                </section>
            )}

            {/* --- Everything that came before --------------------------------- */}
            <section className="space-y-2">
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                    <History className="h-3.5 w-3.5" aria-hidden="true" />
                    Previous handovers
                </h2>

                {history.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                        Nothing yet. The first completed handover will be recorded here for
                        whoever comes next.
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {history.map((intent) => (
                            <li key={intent.id}>
                                <a
                                    href={`/dashboard/tenure/handover/${intent.id}`}
                                    className="block rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-rcf-navy/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy sm:p-4"
                                >
                                    <div className="flex flex-wrap items-center gap-2">
                                        <StatusPill status={intent.status} />
                                        <span className="text-sm font-bold text-slate-900">
                                            {intent.fromTenure.name ?? "Unknown"}
                                            {" → "}
                                            {intent.toTenure?.name ?? intent.plannedName ?? "—"}
                                        </span>
                                    </div>

                                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                                        {intent.fromTenure.session ?? "?"}
                                        {" → "}
                                        {intent.toTenure?.session ?? intent.plannedSession ?? "?"}
                                        {" · "}
                                        {intent.status === "completed"
                                            ? `completed by ${intent.completedBy ?? "someone"} on ${formatWat(intent.completedAt ?? intent.updatedAt)}`
                                            : `started by ${intent.initiatedBy ?? "someone"} on ${formatWat(intent.createdAt)}`}
                                    </p>

                                    {intent.abandonedReason && (
                                        <p className="mt-1 text-[11px] italic text-slate-400">
                                            &ldquo;{intent.abandonedReason}&rdquo;
                                        </p>
                                    )}
                                </a>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </>
    );
}

function StatusPill({ status }: { status: HandoverIntentRow["status"] }) {
    const meta = {
        draft: { label: "Draft", icon: CircleDashed, cls: "bg-slate-100 text-slate-600" },
        in_progress: { label: "In progress", icon: CircleDashed, cls: "bg-amber-200 text-amber-900" },
        completed: { label: "Completed", icon: CheckCircle2, cls: "bg-emerald-100 text-emerald-700" },
        abandoned: { label: "Abandoned", icon: XCircle, cls: "bg-slate-100 text-slate-500" },
    }[status];
    const Icon = meta.icon;

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.cls}`}
        >
            <Icon className="h-2.5 w-2.5" aria-hidden="true" />
            {meta.label}
        </span>
    );
}

/** Everything in this app renders on Lagos wall-clock, server and client alike. */
function formatWat(iso: string): string {
    return new Intl.DateTimeFormat("en-NG", {
        timeZone: "Africa/Lagos",
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(iso));
}
