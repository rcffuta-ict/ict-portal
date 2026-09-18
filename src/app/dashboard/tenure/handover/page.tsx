import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert, ChevronLeft } from "lucide-react";
import { requireVpAdmin } from "@/lib/access-control";
import { listHandoverIntentsAction } from "../actions";
import { HandoverIndex } from "../components/handover-index";

export const metadata: Metadata = {
    title: "Handing Over",
    description: "Every handover of the fellowship — past, in progress, and abandoned.",
};

/**
 * The handover ledger — what you see before the wizard.
 *
 * Two jobs, and the second is the reason this page exists at all:
 *
 *   1. Start or RESUME a handover. The wizard is six deliberate steps and the person
 *      running it will be interrupted; an open intent is picked up exactly where it was
 *      left rather than begun again.
 *
 *   2. Show every handover that has ever been attempted. The people most affected by a
 *      handover — the incoming cabinet — arrive after it has happened. This is the
 *      record they inherit: who handed over, when, what they decided, and what they
 *      walked away from.
 *
 * VP Admin and System Admin only.
 */
export default async function HandoverIndexPage() {
    let authorized = true;
    try {
        await requireVpAdmin();
    } catch {
        authorized = false;
    }

    if (!authorized) {
        return (
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
                <ShieldAlert className="h-10 w-10 text-amber-500" aria-hidden="true" />
                <h1 className="text-lg font-bold text-rcf-navy">Restricted</h1>
                <p className="text-sm text-gray-600">
                    Only the VP Admin and the System Admin can see or run a handover.
                </p>
                <Link
                    href="/dashboard/tenure"
                    className="text-sm font-semibold text-rcf-navy underline underline-offset-2"
                >
                    Back to Tenure Manager
                </Link>
            </div>
        );
    }

    const res = await listHandoverIntentsAction();

    return (
        <div className="mx-auto max-w-3xl space-y-6 pb-20">
            <Link
                href="/dashboard/tenure"
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition-colors hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
            >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Back to Tenure Manager
            </Link>

            <header className="space-y-1 border-b border-slate-200 pb-5">
                <h1 className="text-2xl font-bold tracking-tight text-rcf-navy sm:text-3xl">
                    Handing Over
                </h1>
                <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
                    Every handover of the fellowship, in order. Each one records who ran it,
                    what they decided and how far they got — so whoever comes next can see
                    exactly what their predecessors did.
                </p>
            </header>

            <HandoverIndex
                intents={res.success ? res.data : []}
                loadError={res.success ? null : res.error}
            />
        </div>
    );
}

// Reads live handover state; a cached copy would be a dangerous thing to act on.
export const dynamic = "force-dynamic";
