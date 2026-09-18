import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { requireModuleWrite } from "@/lib/access-control";
import { ictAdmin } from "@/lib/ict";
import { HandoverWizard } from "../components/handover-wizard";

export const metadata: Metadata = {
    title: "Handing Over",
    description:
        "Close the current tenure, advance every generation, and open the next.",
};

/**
 * The handover — a full-screen wizard, one procedure per screen.
 *
 * This closes one tenure and opens the next: every generation is re-levelled, the
 * finalists become alumni, and the outgoing cabinet loses its access. It is the single
 * most consequential and least reversible thing anyone can do in this portal, and it
 * happens once a year.
 *
 * So it takes over the whole screen. The sidebar, the dashboard chrome and every other
 * navigation affordance are painted over deliberately — there is nothing else to click,
 * nothing to half-do while distracted, and no backdrop to dismiss by accident the way a
 * modal invites. One step fills the viewport at a time, and you cannot reach the commit
 * without passing through each one.
 *
 * It sits at z-150: above the dashboard chrome (z-40/50), but below the preview banner
 * (z-200), so a preview deployment still says so even mid-handover — running this
 * against the wrong environment is precisely the mistake worth preventing.
 */
export default async function HandoverPage() {
    let authorized = true;
    try {
        await requireModuleWrite("tenure");
    } catch {
        authorized = false;
    }

    if (!authorized) {
        return (
            <Curtain>
                <ShieldAlert className="h-10 w-10 text-amber-500" aria-hidden="true" />
                <h1 className="text-lg font-bold text-rcf-navy">Restricted</h1>
                <p className="max-w-sm text-sm text-gray-600">
                    Only someone with write access to the Tenure module can run a handover.
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

    const { data: active } = await ictAdmin.supabase
        .from("tenures")
        .select("id, name, session, start_date")
        .eq("is_active", true)
        .maybeSingle();

    if (!active) {
        return (
            <Curtain>
                <h1 className="text-lg font-bold text-rcf-navy">No active tenure</h1>
                <p className="max-w-sm text-sm text-gray-600">
                    There is nothing to hand over from. Create and activate a tenure first.
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

    return (
        <Curtain align="stretch">
            <HandoverWizard
                currentTenure={{
                    id: active.id,
                    name: active.name,
                    session: active.session,
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

// Reads live tenure state; a cached copy would be a dangerous thing to act on.
export const dynamic = "force-dynamic";
