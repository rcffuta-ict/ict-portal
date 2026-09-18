/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useState } from "react";
import {
    ArrowRight,
    Check,
    X,
    Loader2,
    Inbox,
    AlertCircle,
    History,
} from "lucide-react";
import {
    listTransferRequestsAction,
    approveTransferAction,
    declineTransferAction,
} from "../actions";
import { useAlertModal, AlertModal } from "@/components/ui/alert-modal";

/**
 * Unit transfer queue — the VP Admin's inbox.
 *
 * A member belongs to exactly one unit per tenure. When a second executive tries to
 * claim someone who is already placed, nothing moves: the request lands here and the
 * member stays where they are until this screen decides. That is the whole point —
 * two excos pulling at the same person is a disagreement between leaders, and it gets
 * resolved by the person whose office that is, not by whoever clicked last.
 */
export function TransfersTab({ onSuccess }: { onSuccess?: () => void }) {
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();

    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    /** Which request is mid-decision, so only that row shows a spinner. */
    const [deciding, setDeciding] = useState<string | null>(null);
    /** Bumped to re-run the fetch — lets handlers request a reload without duplicating it. */
    const [reloadKey, setReloadKey] = useState(0);

    // The fetch lives entirely inside the effect, and `loading` is turned ON by whoever
    // asks for a reload rather than by the effect itself: setting state synchronously
    // while an effect runs re-renders before paint, which React (and the
    // react-hooks/set-state-in-effect rule) rightly treats as a mistake.
    useEffect(() => {
        let cancelled = false;

        (async () => {
            const res = await listTransferRequestsAction(showHistory);
            if (cancelled) return; // unmounted, or superseded by a newer toggle
            setError(res.success ? null : res.error || "Could not load transfer requests.");
            setRequests(res.data ?? []);
            setLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [showHistory, reloadKey]);

    const reload = useCallback(() => {
        setLoading(true);
        setReloadKey((k) => k + 1);
    }, []);

    const toggleHistory = () => {
        setLoading(true);
        setShowHistory((v) => !v);
    };

    const decide = async (id: string, approve: boolean) => {
        setDeciding(id);
        setError(null);

        const res = approve
            ? await approveTransferAction(id)
            : await declineTransferAction(id);

        setDeciding(null);

        if (!res.success) {
            showAlert({
                type: "error",
                title: approve ? "Transfer failed" : "Could not decline",
                message: res.error || "Something went wrong.",
            });
            return;
        }

        showAlert({
            type: "success",
            message: approve
                ? "Transfer approved — the member has been moved."
                : "Transfer declined. The member stays where they are.",
        });
        reload();
        onSuccess?.();
    };

    const pending = requests.filter((r) => r.status === "pending");

    return (
        <>
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />

            <div className="mx-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="font-bold text-slate-900">Unit Transfers</h3>
                        <p className="text-xs text-slate-500">
                            {pending.length === 0
                                ? "Nothing waiting on you."
                                : `${pending.length} member${pending.length === 1 ? "" : "s"} waiting to be moved.`}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={toggleHistory}
                        aria-pressed={showHistory}
                        className={`inline-flex items-center gap-2 self-start rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                            showHistory
                                ? "border-rcf-navy bg-rcf-navy text-white"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                    >
                        <History className="h-3 w-3" aria-hidden="true" />
                        {showHistory ? "Showing all" : "Show decided"}
                    </button>
                </header>

                <div className="p-4 sm:p-6">
                    {error && (
                        <p
                            role="alert"
                            className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                        >
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            {error}
                        </p>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            Loading requests…
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-12 text-center">
                            <Inbox className="h-8 w-8 text-slate-300" aria-hidden="true" />
                            <p className="text-sm font-semibold text-slate-700">
                                No transfer requests
                            </p>
                            <p className="max-w-sm text-xs text-slate-500">
                                When an executive adds a member who already belongs to another
                                unit, the request appears here for your approval.
                            </p>
                        </div>
                    ) : (
                        <ul className="space-y-3">
                            {requests.map((r) => (
                                <TransferRow
                                    key={r.id}
                                    request={r}
                                    busy={deciding === r.id}
                                    disabled={!!deciding}
                                    onDecide={decide}
                                />
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </>
    );
}

function TransferRow({
    request,
    busy,
    disabled,
    onDecide,
}: {
    request: any;
    busy: boolean;
    disabled: boolean;
    onDecide: (id: string, approve: boolean) => void;
}) {
    const name =
        [request.member?.first_name, request.member?.last_name]
            .filter(Boolean)
            .join(" ") || "Unknown member";

    const isPending = request.status === "pending";

    return (
        <li className="rounded-xl border border-slate-200 p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1.5">
                    <p className="truncate text-sm font-bold text-slate-900">{name}</p>

                    {/* The move itself, readable at a glance and wrapping on a phone. */}
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium">
                            {request.fromUnit?.name ?? "No unit"}
                        </span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
                        <span className="rounded-md bg-rcf-navy/10 px-2 py-0.5 font-medium text-rcf-navy">
                            {request.toUnit?.name ?? "Unknown unit"}
                        </span>
                    </p>

                    <p className="text-[11px] text-slate-400">
                        Requested by {request.requesterName}
                        {request.requestedAt && (
                            <>
                                {" · "}
                                <time dateTime={request.requestedAt}>
                                    {formatWat(request.requestedAt)}
                                </time>
                            </>
                        )}
                    </p>

                    {!isPending && (
                        <p className="text-[11px] font-medium">
                            <StatusBadge status={request.status} />
                            {request.declineReason && (
                                <span className="ml-2 text-slate-500">
                                    {request.declineReason}
                                </span>
                            )}
                        </p>
                    )}
                </div>

                {isPending && (
                    <div className="flex shrink-0 gap-2">
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => onDecide(request.id, true)}
                            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-rcf-navy px-4 text-xs font-bold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:opacity-50 sm:flex-none"
                        >
                            {busy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            Approve
                        </button>
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => onDecide(request.id, false)}
                            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-600 transition-colors hover:border-red-300 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:opacity-50 sm:flex-none"
                        >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                            Decline
                        </button>
                    </div>
                )}
            </div>
        </li>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        approved: "bg-emerald-100 text-emerald-700",
        declined: "bg-red-100 text-red-700",
        cancelled: "bg-slate-100 text-slate-500",
    };
    return (
        <span className={`rounded-full px-2 py-0.5 ${styles[status] ?? styles.cancelled}`}>
            {status}
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
