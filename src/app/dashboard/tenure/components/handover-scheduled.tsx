"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, XCircle, ArrowRight } from "lucide-react";
import { abandonHandoverIntentAction, applyDueHandoverAction } from "../actions";
import { useAlertModal, AlertModal } from "@/components/ui/alert-modal";

/**
 * A finished handover, waiting out its hour.
 *
 * The wizard's last step schedules the switch rather than making it, so the outgoing
 * cabinet gets an hour to wrap up and a mistake can still be cancelled. This screen
 * counts down and offers the cancel.
 *
 * When the countdown ends it asks the server to apply the switch (which only happens
 * if the hour really is up, by the server's clock), then re-renders. The page shows the
 * finished record as soon as the switch lands. Until then it asks again every few
 * seconds, which also covers a phone whose clock is a little ahead.
 */
export function HandoverScheduled({
    intentId,
    status,
    effectiveAt,
    fromLabel,
    toSession,
    scheduledBy,
}: {
    intentId: string;
    status: "scheduled" | "applying";
    effectiveAt: string | null;
    fromLabel: string;
    toSession: string | null;
    scheduledBy: string | null;
}) {
    const router = useRouter();
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();
    // No time recorded (should not happen): treat it as due, and let the server decide.
    const due = effectiveAt ? new Date(effectiveAt).getTime() : 0;
    const [now, setNow] = useState(() => Date.now());
    const asking = useRef(false);

    useEffect(() => {
        const tick = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(tick);
    }, []);

    const remaining = Math.max(0, due - now);
    const takingEffect = status === "applying" || remaining === 0;

    // Once due: ask the server to apply it, then re-render, every 5 seconds until the
    // page turns into the record.
    useEffect(() => {
        if (!takingEffect) return;
        const nudge = async () => {
            if (asking.current) return;
            asking.current = true;
            try {
                await applyDueHandoverAction();
            } catch {
                // A dropped request is retried on the next nudge.
            }
            asking.current = false;
            router.refresh();
        };
        nudge();
        const every = setInterval(nudge, 5000);
        return () => clearInterval(every);
    }, [takingEffect, router]);

    const cancel = () =>
        showAlert({
            type: "warning",
            title: "Cancel this handover?",
            message:
                "Nothing will change: the current tenure stays active and the outgoing cabinet keeps its access. The handover is kept in the history as cancelled, and you can start a new one.",
            confirmText: "Yes, cancel it",
            pendingText: "Cancelling…",
            onConfirm: async () => {
                let res: Awaited<ReturnType<typeof abandonHandoverIntentAction>>;
                try {
                    res = await abandonHandoverIntentAction(intentId, "Cancelled before it took effect.");
                } catch {
                    res = { success: false as const, error: "Couldn't reach the server. Try again." };
                }
                if (!res.success) {
                    showAlert({ type: "error", title: "Not cancelled", message: res.error || "Unknown error." });
                    router.refresh();
                    return;
                }
                router.refresh();
            },
        });

    return (
        <div className="flex min-h-full flex-col items-center justify-center bg-amber-50 p-6 text-center sm:p-8">
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />

            {takingEffect ? (
                <Loader2 className="h-12 w-12 animate-spin text-amber-600 motion-reduce:animate-none" aria-hidden="true" />
            ) : (
                <Clock className="h-12 w-12 text-amber-600" aria-hidden="true" />
            )}

            <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-amber-700">
                {takingEffect ? "Taking effect" : "Handover scheduled"}
            </p>
            <h1 className="mt-1 flex flex-wrap items-center justify-center gap-2 text-xl font-bold text-amber-950">
                {fromLabel}
                <ArrowRight className="h-4 w-4 opacity-60" aria-hidden="true" />
                {toSession ?? "the new session"}
            </h1>

            {takingEffect ? (
                <p role="status" className="mt-2 max-w-md text-sm text-amber-900">
                    Switching tenures now. This page updates by itself when it is done.
                </p>
            ) : (
                <>
                    {/* Updated every second, so it is a timer rather than a live region:
                        a screen reader would otherwise read out every tick. */}
                    <p
                        role="timer"
                        aria-live="off"
                        suppressHydrationWarning
                        className="mt-4 font-mono text-4xl font-bold tabular-nums text-amber-950 sm:text-5xl"
                    >
                        {formatCountdown(remaining)}
                    </p>
                    <p className="mt-2 max-w-md text-sm text-amber-900">
                        Takes effect at <strong>{effectiveAt ? formatWat(effectiveAt) : "the hour"}</strong>
                        {scheduledBy ? `, scheduled by ${scheduledBy}` : ""}.
                    </p>
                </>
            )}

            <div className="mx-auto mt-5 max-w-md rounded-2xl border border-amber-200 bg-white/70 p-4 text-left text-xs leading-relaxed text-amber-900">
                <p className="font-semibold">Until then</p>
                <p className="mt-1">
                    Nothing has changed. The current tenure stays active and the outgoing cabinet
                    keeps its access, so they can finish up.
                </p>
                <p className="mt-2 font-semibold">When it takes effect</p>
                <p className="mt-1">
                    The new session opens awaiting coronation, every generation moves up, and the
                    incoming VP Admin and ICT Coordinator are appointed. Then fill the rest of the
                    cabinet from the Tenure Manager.
                </p>
            </div>

            <div className="mt-5 flex w-full max-w-md flex-col gap-2 sm:flex-row">
                <a
                    href="/dashboard/tenure"
                    className="inline-flex h-12 flex-1 items-center justify-center rounded-xl bg-amber-700 px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-800"
                >
                    Back to Tenure Manager
                </a>
                {!takingEffect && (
                    <button
                        type="button"
                        onClick={cancel}
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-amber-300 px-5 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-800"
                    >
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                        Cancel handover
                    </button>
                )}
            </div>
        </div>
    );
}

/** "59:07", or "1:00:00" for the first second. */
function formatCountdown(ms: number): string {
    const total = Math.ceil(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(h ? 2 : 1, "0");
    const ss = String(s).padStart(2, "0");
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Everything in this app renders on Lagos wall-clock, server and client alike. */
function formatWat(iso: string): string {
    return new Intl.DateTimeFormat("en-NG", {
        timeZone: "Africa/Lagos",
        timeStyle: "short",
    }).format(new Date(iso));
}
