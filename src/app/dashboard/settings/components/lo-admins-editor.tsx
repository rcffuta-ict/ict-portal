"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HandHeart, KeyRound, Loader2, RefreshCw, Search, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import {
    addLoAdminAction,
    getLoAdminsData,
    removeLoAdminAction,
    type LoAdminsData,
    type LoLeaderOption,
} from "../actions";
import { AlertModal, useAlertModal } from "@/components/ui/alert-modal";

/**
 * Who moderates Lo! besides the System Admin and the VP Admin.
 *
 * Only leaders of the active tenure who already have a portal login can be chosen —
 * moderating needs a session, and this screen never creates a login. Leaders without
 * one are listed but can't be picked, with the reason, so nobody wonders where they
 * went. Every rule is re-checked by the server action; this list is only a picker.
 */
export function LoAdminsEditor() {
    const [data, setData] = useState<LoAdminsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setData(await getLoAdminsData());
        } catch {
            setData({ authorized: true, error: "Couldn't load Lo! admins." });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => void load(), 0);
        return () => clearTimeout(timer);
    }, [load]);

    const leaders = useMemo(() => data?.leaders ?? [], [data]);
    const admins = leaders.filter((l) => l.isLoAdmin);
    const canWrite = !!data?.canWrite;

    const q = query.trim().toLowerCase();
    const candidates = q
        ? leaders.filter(
            (l) => !l.isLoAdmin && (l.name.toLowerCase().includes(q) || l.offices.toLowerCase().includes(q)),
        )
        : [];

    const add = async (leader: LoLeaderOption) => {
        setBusyId(leader.profileId);
        setError(null);
        const result = await addLoAdminAction(leader.profileId);
        if (result.success) {
            setQuery("");
            await load();
        } else {
            setError(result.error || "Couldn't add them.");
        }
        setBusyId(null);
    };

    const remove = (leader: LoLeaderOption) => {
        showAlert({
            type: "warning",
            title: "Remove Lo! admin?",
            message: `${leader.name} will stop being able to publish testimonies and answer questions on Lo! straight away.`,
            confirmText: "Remove",
            pendingText: "Removing…",
            onConfirm: async () => {
                setError(null);
                const result = await removeLoAdminAction(leader.profileId);
                if (!result.success) setError(result.error || "Couldn't remove them.");
                await load();
            },
        });
    };

    if (data && !data.authorized) return null;

    return (
        <section aria-labelledby="lo-admins-heading" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />

            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="rounded-lg bg-rcf-gold/15 p-2 text-amber-700">
                        <HandHeart className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                        <h2 id="lo-admins-heading" className="font-bold text-slate-900">Lo! admins</h2>
                        <p className="mt-0.5 text-sm text-slate-500">
                            Leaders who publish testimonies and answer questions on Lo!. It gives them
                            nothing else in the portal, and it ends at handover.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => void load()}
                    aria-label="Refresh Lo! admins"
                    className="shrink-0 rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
                </button>
            </div>

            {error && (
                <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    {error}
                </p>
            )}

            {loading && !data ? (
                <p role="status" className="mt-6 flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Loading…
                </p>
            ) : data?.error ? (
                <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <p>{data.error}</p>
                    <button type="button" onClick={() => void load()} className="mt-2 min-h-9 text-xs font-bold underline">
                        Try again
                    </button>
                </div>
            ) : !data?.tenureId ? (
                <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                    There is no active tenure, so there are no leaders to appoint.
                </p>
            ) : (
                <div className="mt-5 space-y-5">
                    <div>
                        <h3 className="text-xs font-bold tracking-wide text-slate-400 uppercase">
                            Current ({admins.length})
                        </h3>
                        {admins.length === 0 ? (
                            <p className="mt-2 rounded-xl border-2 border-dashed border-slate-100 py-6 text-center text-sm text-slate-400">
                                No Lo! admins yet. The System Admin and the VP Admin always moderate Lo!.
                            </p>
                        ) : (
                            <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100">
                                {admins.map((leader) => (
                                    <li key={leader.profileId} className="flex items-center gap-3 p-3">
                                        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                                        <LeaderText leader={leader} />
                                        {canWrite && (
                                            <button
                                                type="button"
                                                onClick={() => remove(leader)}
                                                aria-label={`Remove ${leader.name} as Lo! admin`}
                                                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-red-100 px-3 text-xs font-bold text-red-600 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                            >
                                                <UserMinus className="h-4 w-4" aria-hidden="true" />
                                                <span className="hidden sm:inline">Remove</span>
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {canWrite && (
                        <div>
                            <label htmlFor="lo-admin-search" className="text-xs font-bold tracking-wide text-slate-400 uppercase">
                                Add a leader
                            </label>
                            <div className="relative mt-2">
                                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                                <input
                                    id="lo-admin-search"
                                    type="search"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search by name or office"
                                    className="h-11 w-full rounded-xl border border-slate-200 pr-3 pl-9 text-sm placeholder:text-slate-400 focus:border-rcf-navy focus:outline-none"
                                />
                            </div>

                            {q && (
                                <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100">
                                    {candidates.length === 0 && (
                                        <li className="p-4 text-center text-sm text-slate-400">
                                            No leader of this tenure matches &ldquo;{query}&rdquo;.
                                        </li>
                                    )}
                                    {candidates.slice(0, 12).map((leader) => (
                                        <li key={leader.profileId} className="flex items-center gap-3 p-3">
                                            <LeaderText leader={leader} />
                                            {leader.hasLogin ? (
                                                <button
                                                    type="button"
                                                    onClick={() => add(leader)}
                                                    disabled={!!busyId}
                                                    className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-rcf-navy px-3 text-xs font-bold text-white hover:bg-rcf-navy-light focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy focus-visible:ring-offset-2 disabled:opacity-60"
                                                >
                                                    {busyId === leader.profileId ? (
                                                        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                                                    ) : (
                                                        <UserPlus className="h-4 w-4" aria-hidden="true" />
                                                    )}
                                                    Add
                                                </button>
                                            ) : (
                                                <span className="inline-flex shrink-0 items-center gap-1 text-right text-[11px] leading-tight text-slate-400">
                                                    <KeyRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                    Their office has
                                                    <br className="sm:hidden" /> no portal login
                                                </span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

function LeaderText({ leader }: { leader: LoLeaderOption }) {
    return (
        <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{leader.name}</p>
            <p className="truncate text-xs text-slate-500">{leader.offices || "—"}</p>
        </div>
    );
}
