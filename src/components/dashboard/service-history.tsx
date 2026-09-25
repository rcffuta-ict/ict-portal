/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { Loader2, Award, History } from "lucide-react";
import { getServiceHistoryAction } from "@/app/dashboard/tenure/actions";

/**
 * Every office a member has served in, by session.
 *
 * "Welfare Coordinator (2025/2026), Director of Commerce (2026/2027)" — the record a
 * fellowship actually asks for at a handover, for a reference, or years later when
 * somebody wants to know who ran a unit. Until migration 0014 it did not survive: the
 * click that ended an appointment deleted the row.
 *
 * Current and past are visibly different. "She is the Welfare Coordinator" and "she was
 * the Welfare Coordinator" are different statements, and a list that blurs them is
 * worse than no list — somebody will read it as the former.
 *
 * Renders nothing at all when a member has never held an office, rather than an empty
 * card. Most members have not, and a permanent "No service record" panel on every
 * profile is noise on a phone.
 */
export function ServiceHistory({ profileId }: { profileId: string }) {
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        getServiceHistoryAction(profileId)
            .then((res) => {
                if (cancelled) return;
                if (res.success) setRows(res.data);
                else setError(res.error || null);
            })
            .catch(() => {
                if (!cancelled) setError("Could not load the service record.");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [profileId]);

    if (loading) {
        return (
            <p className="flex items-center gap-2 py-6 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                Loading service record…
            </p>
        );
    }

    // A failure here is not worth a red box on somebody's profile — the rest of the
    // page is still useful, and this is supplementary.
    if (error || rows.length === 0) return null;

    const current = rows.filter((r) => r.isCurrent);
    const past = rows.filter((r) => !r.isCurrent);

    return (
        <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                <History className="h-3.5 w-3.5" />
                Service record
            </h3>

            {current.length > 0 && <Group rows={current} tone="current" />}
            {past.length > 0 && (
                <div className="space-y-2">
                    {current.length > 0 && (
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-300">
                            Previously
                        </p>
                    )}
                    <Group rows={past} tone="past" />
                </div>
            )}
        </section>
    );
}

function Group({ rows, tone }: { rows: any[]; tone: "current" | "past" }) {
    const isCurrent = tone === "current";
    return (
        <ul className="space-y-2">
            {rows.map((row) => (
                <li
                    key={row.id}
                    className={`flex items-start gap-3 rounded-xl border p-3 ${
                        isCurrent
                            ? "border-rcf-navy/20 bg-rcf-navy/5"
                            : "border-slate-200 bg-white"
                    }`}
                >
                    <Award
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                            isCurrent ? "text-rcf-navy" : "text-slate-300"
                        }`}
                    />
                    <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span
                                className={`text-sm font-bold ${
                                    isCurrent ? "text-slate-900" : "text-slate-600"
                                }`}
                            >
                                {row.title}
                            </span>
                            {!row.isLead && (
                                <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    Assistant
                                </span>
                            )}
                            {isCurrent && (
                                <span className="rounded border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                                    Serving
                                </span>
                            )}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                            {row.session ?? "Session unknown"}
                            {row.contextName && ` · ${row.contextName}`}
                        </p>
                    </div>
                </li>
            ))}
        </ul>
    );
}
