import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { requireVpAdmin } from "@/lib/access-control";
import { getHandoverIntentAction } from "../../actions";
import { HandoverWizard } from "../../components/handover-wizard";
import { HandoverRecord } from "../../components/handover-record";

export const metadata: Metadata = {
    title: "Handing Over",
    description: "Close the current tenure, advance every generation, and open the next.",
};

/**
 * One handover — either the live wizard, or the record of a finished one.
 *
 * WHY IT TAKES OVER THE SCREEN
 *   A handover closes one tenure and opens the next: every generation is re-levelled,
 *   the finalists become alumni, and the outgoing cabinet loses its access. It is the
 *   least reversible thing anyone can do here, and it happens once a year. So the
 *   sidebar, the dashboard chrome and every other navigation affordance are painted
 *   over — there is nothing else to click, nothing to half-do while distracted, and no
 *   backdrop to dismiss by accident the way a modal invites.
 *
 *   It sits at z-150: above the dashboard chrome (z-40/50), but below the preview
 *   banner (z-200), so a preview deployment still says so even mid-handover — running
 *   this against the wrong environment is precisely the mistake worth preventing.
 *
 * A completed or abandoned intent renders read-only instead: this URL is also how a
 * successor reads what their predecessor did.
 */
export default async function HandoverIntentPage({
    params,
}: {
    params: Promise<{ intentId: string }>;
}) {
    const { intentId } = await params;

    let authorized = true;
    try {
        await requireVpAdmin();
    } catch {
        authorized = false;
    }

    if (!authorized) {
        return (
            <Curtain>
                <ShieldAlert className="h-10 w-10 text-amber-500" aria-hidden="true" />
                <h1 className="text-lg font-bold text-rcf-navy">Restricted</h1>
                <p className="max-w-sm text-sm text-gray-600">
                    Only the VP Admin and the System Admin can see or run a handover.
                </p>
                <Link
                    href="/dashboard/tenure"
                    className="text-sm font-semibold text-rcf-navy underline underline-offset-2"
                >
                    Back to Tenure Manager
                </Link>
            </Curtain>
        );
    }

    const res = await getHandoverIntentAction(intentId);

    if (!res.success) {
        return (
            <Curtain>
                <h1 className="text-lg font-bold text-rcf-navy">Not found</h1>
                <p className="max-w-sm text-sm text-gray-600">{res.error}</p>
                <Link
                    href="/dashboard/tenure/handover"
                    className="text-sm font-semibold text-rcf-navy underline underline-offset-2"
                >
                    Back to handovers
                </Link>
            </Curtain>
        );
    }

    const { intent, events } = res;

    // Finished, one way or the other — this is a record, not a form.
    if (intent.status === "completed" || intent.status === "abandoned") {
        return (
            <div className="mx-auto max-w-3xl space-y-5 pb-20">
                <HandoverRecord intent={intent} events={events} />
            </div>
        );
    }

    if (!intent.fromTenure.id) {
        return (
            <Curtain>
                <h1 className="text-lg font-bold text-rcf-navy">No tenure to hand over</h1>
                <p className="max-w-sm text-sm text-gray-600">
                    This handover&rsquo;s outgoing tenure no longer exists.
                </p>
                <Link
                    href="/dashboard/tenure/handover"
                    className="text-sm font-semibold text-rcf-navy underline underline-offset-2"
                >
                    Back to handovers
                </Link>
            </Curtain>
        );
    }

    return (
        <Curtain align="stretch">
            <HandoverWizard
                intentId={intent.id}
                initialStep={intent.step}
                initialPayload={intent.payload}
                currentTenure={{
                    id: intent.fromTenure.id,
                    name: intent.fromTenure.name ?? "Current tenure",
                    session: intent.fromTenure.session ?? "",
                }}
            />
        </Curtain>
    );
}

/**
 * The full-screen curtain.
 *
 * `fixed inset-0` rather than a tall page, so the dashboard sidebar and header are
 * genuinely covered instead of merely scrolled past. globals.css already offsets
 * `.fixed.inset-0` when the preview banner is showing, so this doesn't tuck underneath
 * it on a preview build.
 */
function Curtain({
    children,
    align = "center",
}: {
    children: React.ReactNode;
    align?: "center" | "stretch";
}) {
    return (
        <div className="fixed inset-0 z-[150] overflow-y-auto overscroll-contain bg-slate-50">
            {align === "center" ? (
                <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
                    {children}
                </div>
            ) : (
                <div className="flex min-h-full flex-col">{children}</div>
            )}
        </div>
    );
}

export const dynamic = "force-dynamic";
