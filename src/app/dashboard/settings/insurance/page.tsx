import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, ArrowLeft, AlertTriangle } from "lucide-react";
import { getCurrentContext } from "@/lib/access-control";
import { getTenurePresidentName } from "@/lib/backup";
import { db } from "@/lib/db";
import { tenureFullLabel } from "@/lib/tenure";
import { BackupPicker } from "@/components/dashboard/backup-picker";
import type { Metadata } from "next";

// Plain string, matching every other leaf page here: the root layout's
// "%s | ICT Portal, RCFFUTA" template applies to it.
export const metadata: Metadata = {
    title: "System Insurance",
    description: "Take a complete, encrypted backup of the entire portal database.",
};
export const dynamic = "force-dynamic";

/**
 * FULL SYSTEM INSURANCE — the System Admin's complete backup.
 *
 * Distinct from the handover's backup step, which is tenure-scoped and belongs to the
 * VP Admin. This one covers every tenure and all history, and it is what you take before
 * a structural change to the database. A tenure-scoped file cannot restore a dropped
 * column or a deleted tenure, so it is not an undo for a migration; this is.
 */
export default async function InsurancePage() {
    const ctx = await getCurrentContext();

    // Not requireSysAdmin(): a thrown error renders an error page. Someone who wandered
    // in should land back on Settings, not on a stack trace.
    if (!ctx) redirect("/login");
    if (!ctx.isSysAdmin) redirect("/dashboard/settings");

    const { data: tenure } = await db
        .from("tenures")
        .select("id, session, theme")
        .eq("is_active", true)
        .maybeSingle();

    const presidentName = tenure?.id ? await getTenurePresidentName(tenure.id) : null;

    return (
        <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
            <Link
                href="/dashboard/settings"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
            >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Settings
            </Link>

            <header className="mt-4">
                <h1 className="flex items-center gap-2.5 font-serif text-2xl font-bold text-slate-900 sm:text-3xl">
                    <ShieldCheck className="h-7 w-7 shrink-0 text-rcf-navy" aria-hidden="true" />
                    System insurance
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    A complete copy of the fellowship&rsquo;s database — every tenure, every
                    member, all history. This is the one you take <strong>before</strong> anything
                    structural: a migration, a cleanup, handing the project over.
                </p>
            </header>

            <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
                <div className="text-sm leading-relaxed text-amber-900">
                    <p className="font-semibold">This is not the handover backup.</p>
                    <p className="mt-1">
                        The backup inside the handover wizard is scoped to a single tenure — it
                        proves that tenure was captured before it closed. It cannot bring back a
                        dropped column or a deleted tenure. This one can.
                    </p>
                </div>
            </div>

            <div className="mt-6">
                <BackupPicker
                    scope="system"
                    tenureId={tenure?.id ?? null}
                    tenureLabel={tenure ? tenureFullLabel(tenure) : null}
                    presidentName={presidentName}
                />
            </div>

            <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-bold text-slate-900">Restoring one</h2>
                <ol className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-600">
                    <li>
                        1. <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">node scripts/restore-backup.mjs &lt;file&gt;</code>{" "}
                        — dry run by default; it tells you what it would write and stops.
                    </li>
                    <li>2. Add <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">--commit</code> once the dry run reads correctly.</li>
                    <li>
                        3. Leaders set a new password on their first login afterwards: password
                        hashes and live sessions are deliberately never included in a backup.
                    </li>
                </ol>
            </section>
        </div>
    );
}
