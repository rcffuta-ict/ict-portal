import Link from "next/link";
import {
    ChevronLeft,
    CheckCircle2,
    XCircle,
    ArrowRight,
    Clock,
} from "lucide-react";

interface IntentSummary {
    id: string;
    status: string;
    step: number;
    payload: Record<string, unknown>;
    fromTenure: { id: string | null; label: string | null; session: string | null };
    toTenureId: string | null;
    initiatedBy: string | null;
    completedBy: string | null;
    completedAt: string | null;
    abandonedReason: string | null;
    createdAt: string;
    updatedAt: string;
}

interface EventRow {
    id: string;
    action: string;
    detail: string | null;
    actorName: string | null;
    createdAt: string;
}

/**
 * The read-only record of a finished handover.
 *
 * This is what a successor actually inherits — not a form they could accidentally
 * re-run, but the proceedings: who started it, what they decided at each step, and how
 * it ended. A completed handover renders here forever.
 *
 * Server component: it is pure history, so there is nothing to hydrate.
 */
export function HandoverRecord({
    intent,
    events,
}: {
    intent: IntentSummary;
    events: EventRow[];
}) {
    const completed = intent.status === "completed";
    const plannedSession = (intent.payload?.session as string) || null;
    // Handovers begun before tenures lost their names planned one; newer ones plan a
    // session only.
    const planned = (intent.payload?.name as string) || plannedSession;

    return (
        <>
            <Link
                href="/dashboard/tenure/handover"
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition-colors hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
            >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Back to handovers
            </Link>

            <header
                className={`rounded-2xl border p-5 ${
                    completed
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200 bg-slate-50"
                }`}
            >
                <div className="flex items-center gap-2">
                    {completed ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                    ) : (
                        <XCircle className="h-5 w-5 text-slate-400" aria-hidden="true" />
                    )}
                    <span
                        className={`text-[11px] font-bold uppercase tracking-wide ${
                            completed ? "text-emerald-700" : "text-slate-500"
                        }`}
                    >
                        {completed ? "Completed" : "Abandoned"}
                    </span>
                </div>

                <h1
                    className={`mt-2 flex flex-wrap items-center gap-2 text-xl font-bold ${
                        completed ? "text-emerald-900" : "text-slate-700"
                    }`}
                >
                    {intent.fromTenure.label ?? "Unknown"}
                    <ArrowRight className="h-4 w-4 opacity-60" aria-hidden="true" />
                    {planned ?? "—"}
                </h1>

                <p
                    className={`mt-1 text-sm ${
                        completed ? "text-emerald-800" : "text-slate-500"
                    }`}
                >
                    {intent.fromTenure.session ?? "?"} → {plannedSession ?? "?"}
                </p>

                {intent.abandonedReason && (
                    <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs italic text-slate-600">
                        &ldquo;{intent.abandonedReason}&rdquo;
                    </p>
                )}
            </header>

            <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                <Row label="Started by">{intent.initiatedBy ?? "Unknown"}</Row>
                <Row label="Started">{formatWat(intent.createdAt)}</Row>
                <Row label={completed ? "Completed by" : "Abandoned by"}>
                    {intent.completedBy ?? "Unknown"}
                </Row>
                <Row label={completed ? "Completed" : "Ended"}>
                    {formatWat(intent.completedAt ?? intent.updatedAt)}
                </Row>
                {!completed && <Row label="Reached">Step {intent.step + 1} of 6</Row>}
            </dl>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    Proceedings
                </h2>

                {events.length === 0 ? (
                    <p className="text-xs text-slate-400">Nothing was recorded.</p>
                ) : (
                    <ol className="space-y-3">
                        {events.map((e) => (
                            <li key={e.id} className="flex gap-3">
                                {/* A simple timeline rail — the dot marks each recorded act. */}
                                <span
                                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rcf-navy/40"
                                    aria-hidden="true"
                                />
                                <div className="min-w-0">
                                    <p className="text-sm text-slate-800">
                                        {e.detail || e.action.replace(/_/g, " ")}
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                        {e.actorName ?? "Unknown"} ·{" "}
                                        <time dateTime={e.createdAt}>{formatWat(e.createdAt)}</time>
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
            </section>
        </>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4 px-4 py-2.5">
            <dt className="shrink-0 text-xs font-medium text-slate-400">{label}</dt>
            <dd className="min-w-0 text-right text-sm font-medium text-slate-800">{children}</dd>
        </div>
    );
}

function formatWat(iso: string): string {
    return new Intl.DateTimeFormat("en-NG", {
        timeZone: "Africa/Lagos",
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(iso));
}
