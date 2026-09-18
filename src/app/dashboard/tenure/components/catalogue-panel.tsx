/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import {
    Crown,
    Shield,
    Users,
    GraduationCap,
    Cog,
    Loader2,
    RefreshCw,
    Lock,
    Sparkles,
} from "lucide-react";
import { getCatalogueAction, syncCatalogueAction } from "../actions";
import { PrivilegePills } from "./privilege-pills";
import { useAlertModal, AlertModal } from "@/components/ui/alert-modal";

const TIERS = ["PRESIDENT", "VP", "EXECUTIVE", "COORDINATOR", "SYSTEM"] as const;

const TIER_META: Record<string, { label: string; icon: any; blurb: string }> = {
    PRESIDENT: {
        label: "President",
        icon: Crown,
        blurb: "Sees everything, changes nothing — globally write-blocked by design.",
    },
    VP: {
        label: "Vice Presidents",
        icon: Shield,
        blurb: "VP Admin runs appointments, transfers and the handover; VP Church Growth sees church-wide.",
    },
    EXECUTIVE: {
        label: "Executives",
        icon: Users,
        blurb: "One per unit and team. Adds and removes their own members directly.",
    },
    COORDINATOR: {
        label: "Level Coordinators",
        icon: GraduationCap,
        blurb: "Scoped to their own generation — except the finalists, who cover every level.",
    },
    SYSTEM: {
        label: "System",
        icon: Cog,
        blurb: "The ICT Coordinator is the System Admin: full read and write everywhere.",
    },
};

/**
 * The leadership catalogue — the fellowship's org chart, as stored.
 *
 * "Frozen" here means constant ACROSS TENURES: a handover swaps the people in each
 * seat, never the seats themselves. It is not immutable — the VP Admin owns the
 * structure and can still edit it through the Roles view — but it is deliberately not
 * something that gets rebuilt every session.
 *
 * Read-only for everyone else, which is why this is its own panel: most people looking
 * at the cabinet want to understand the hierarchy, not edit it.
 */
export function CataloguePanel({ canEdit }: { canEdit: boolean }) {
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();

    const [positions, setPositions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const res = await getCatalogueAction();
            if (cancelled) return;
            setError(res.success ? null : res.error || "Could not load the catalogue.");
            setPositions(res.positions ?? []);
            setLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    const runSync = async () => {
        setSyncing(true);
        const res = await syncCatalogueAction();
        setSyncing(false);

        if (!res.success) {
            showAlert({ type: "error", title: "Sync failed", message: res.error || "Unknown error." });
            return;
        }
        showAlert({ type: "success", message: res.message ?? "Catalogue synced." });
        setLoading(true);
        setReloadKey((k) => k + 1);
    };

    return (
        <>
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <h3 className="font-bold text-slate-900">Leadership Structure</h3>
                        <p className="text-xs text-slate-500">
                            The same every tenure — handing over changes who sits in each seat,
                            not the seats.
                        </p>
                    </div>

                    {canEdit && (
                        <button
                            type="button"
                            onClick={runSync}
                            disabled={syncing}
                            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-rcf-navy transition-colors hover:border-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:opacity-60"
                        >
                            {syncing ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            Sync catalogue
                        </button>
                    )}
                </header>

                <div className="space-y-6 p-4 sm:p-6">
                    {loading ? (
                        <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            Loading structure…
                        </p>
                    ) : error ? (
                        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {error}
                        </p>
                    ) : (
                        TIERS.map((tier) => {
                            const rows = positions.filter((p) => p.tier === tier);
                            if (!rows.length) return null;
                            const meta = TIER_META[tier];
                            const Icon = meta.icon;

                            return (
                                <section key={tier}>
                                    <div className="mb-2 flex items-start gap-2">
                                        <Icon
                                            className="mt-0.5 h-4 w-4 shrink-0 text-rcf-navy"
                                            aria-hidden="true"
                                        />
                                        <div className="min-w-0">
                                            <h4 className="text-xs font-bold uppercase tracking-wide text-rcf-navy">
                                                {meta.label}
                                            </h4>
                                            <p className="text-[11px] leading-snug text-slate-500">
                                                {meta.blurb}
                                            </p>
                                        </div>
                                    </div>

                                    <ul className="space-y-1.5">
                                        {rows.map((p) => (
                                            <li
                                                key={p.id}
                                                className={`rounded-xl border p-3 ${
                                                    p.is_active
                                                        ? "border-slate-200"
                                                        : "border-dashed border-slate-200 bg-slate-50/60"
                                                }`}
                                            >
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                    <span className="text-sm font-bold text-slate-800">
                                                        {p.title}
                                                    </span>
                                                    {p.is_protected && (
                                                        <Lock
                                                            className="h-3 w-3 text-slate-300"
                                                            aria-label="Part of the fellowship catalogue"
                                                        />
                                                    )}
                                                    {!p.is_active && (
                                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                                                            inactive
                                                        </span>
                                                    )}
                                                    {isFinalistCoordinator(p) && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                                            <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                                                            covers every level
                                                        </span>
                                                    )}
                                                    <span className="ml-auto">
                                                        <PrivilegePills privileges={p.privileges} slug={p.slug} />
                                                    </span>
                                                </div>
                                                {p.description && (
                                                    <p className="mt-1 text-[11px] leading-snug text-slate-500">
                                                        {p.description}
                                                    </p>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            );
                        })
                    )}
                </div>
            </div>
        </>
    );
}

/**
 * The finalist coordinator is the one position whose authority is wider than its name:
 * a LEVEL privilege scoped "all" rather than "500". Worth calling out on screen, since
 * it is the single least obvious rule in the hierarchy.
 */
function isFinalistCoordinator(position: any): boolean {
    return (
        position.tier === "COORDINATOR" &&
        (position.privileges ?? []).some(
            (p: any) => p.tag === "LEVEL" && (p.scope === null || p.scope === "all"),
        )
    );
}
