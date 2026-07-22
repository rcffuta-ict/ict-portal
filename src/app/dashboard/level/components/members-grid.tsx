/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
    Users,
    Search,
    Loader2,
    Mail,
    Phone,
    Mars,
    Venus,
    Briefcase,
    UserMinus,
    AlertCircle,
} from "lucide-react";
import { getLevelMembersAction, getLevelStatsAction } from "../actions";
import { ExportPanel } from "./export-panel";

const PAGE_SIZE = 24;

interface Stats {
    total: number;
    male: number;
    female: number;
    unspecified: number;
    workers: number;
    nonWorkers: number;
}

/**
 * Paged, searchable grid of a generation's members.
 *
 * Search and paging both run server-side — only one page (24) of profiles ever crosses
 * the wire, which keeps the first paint cheap on mobile data. "Load more" is an explicit
 * button rather than scroll-triggered so a member on a slow connection stays in control
 * of what they download.
 */
export function MembersGrid({ classSetId }: { classSetId: string }) {
    const [members, setMembers] = useState<any[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Guards against an older, slower request overwriting a newer one.
    const requestId = useRef(0);

    const fetchPage = useCallback(
        async (nextPage: number, term: string, append: boolean) => {
            const id = ++requestId.current;
            if (append) setLoadingMore(true);
            else setLoading(true);
            setError(null);
            const res = await getLevelMembersAction(classSetId, {
                page: nextPage,
                pageSize: PAGE_SIZE,
                query: term,
            });
            if (id !== requestId.current) return; // superseded
            if (!res.success) setError(res.error || "Could not load members.");
            setMembers((prev) => (append ? [...prev, ...(res.data || [])] : res.data || []));
            setTotal(res.total || 0);
            setPage(nextPage);
            if (append) setLoadingMore(false);
            else setLoading(false);
        },
        [classSetId],
    );

    // Debounced search — one request per pause, not per keystroke.
    useEffect(() => {
        const t = setTimeout(() => fetchPage(1, query, false), query ? 300 : 0);
        return () => clearTimeout(t);
    }, [query, fetchPage]);

    useEffect(() => {
        getLevelStatsAction(classSetId).then((r) => {
            if (r.success && r.stats) setStats(r.stats as Stats);
        });
    }, [classSetId]);

    const hasMore = members.length < total;

    return (
        <div className="space-y-4">
            {stats && <StatsStrip stats={stats} />}

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="flex items-center gap-2 font-bold text-slate-700">
                        <Users className="h-4 w-4" /> Members
                        <span className="text-xs font-medium text-slate-400">
                            {query ? `${total} match${total === 1 ? "" : "es"}` : total}
                        </span>
                    </h4>
                    <ExportPanel classSetId={classSetId} memberCount={stats?.total ?? total} />
                </div>

                <div className="relative mb-4">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search name, email, phone or matric no."
                        aria-label="Search members"
                        className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rcf-navy focus:outline-none"
                    />
                    {loading && query && (
                        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-300" />
                    )}
                </div>

                {error && (
                    <p className="mb-3 flex items-start gap-1.5 text-xs text-red-600">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
                    </p>
                )}

                {loading ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-[86px] animate-pulse rounded-xl border border-slate-100 bg-slate-50"
                            />
                        ))}
                    </div>
                ) : members.length === 0 ? (
                    <p className="rounded-xl border-2 border-dashed border-slate-100 py-10 text-center text-sm text-slate-400">
                        {query ? `No member matches “${query}”.` : "No members yet."}
                    </p>
                ) : (
                    <>
                        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {members.map((m) => (
                                <li key={m.id}>
                                    <MemberCard classSetId={classSetId} member={m} />
                                </li>
                            ))}
                        </ul>

                        <div className="mt-5 flex flex-col items-center gap-2">
                            <p className="text-[11px] text-slate-400">
                                Showing {members.length} of {total}
                            </p>
                            {hasMore && (
                                <button
                                    type="button"
                                    onClick={() => fetchPage(page + 1, query, true)}
                                    disabled={loadingMore}
                                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-5 text-xs font-bold text-slate-600 hover:border-rcf-navy/40 hover:text-rcf-navy disabled:opacity-60"
                                >
                                    {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                                    Load more
                                </button>
                            )}
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}

function MemberCard({ classSetId, member }: { classSetId: string; member: any }) {
    const name = [member.first_name, member.last_name].filter(Boolean).join(" ");
    return (
        <Link
            href={`/dashboard/level/${classSetId}/member/${member.id}`}
            className="flex h-full items-center gap-3 rounded-xl border border-slate-100 p-3 transition-colors hover:border-rcf-navy/30 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rcf-navy"
        >
            <span
                aria-hidden
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    member.gender === "female"
                        ? "bg-pink-50 text-pink-600"
                        : "bg-emerald-50 text-emerald-700"
                }`}
            >
                {member.first_name?.[0]}
                {member.last_name?.[0]}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-slate-900">{name}</span>
                {member.email && (
                    <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-500">
                        <Mail className="h-3 w-3 shrink-0" /> {member.email}
                    </span>
                )}
                {member.phone_number && (
                    <span className="flex items-center gap-1 truncate text-[11px] text-slate-400">
                        <Phone className="h-3 w-3 shrink-0" /> {member.phone_number}
                    </span>
                )}
            </span>
        </Link>
    );
}

function StatsStrip({ stats }: { stats: Stats }) {
    const items = [
        { label: "Total", value: stats.total, icon: Users, tone: "text-slate-700 bg-slate-100" },
        { label: "Male", value: stats.male, icon: Mars, tone: "text-sky-600 bg-sky-50" },
        { label: "Female", value: stats.female, icon: Venus, tone: "text-pink-600 bg-pink-50" },
        { label: "Workers", value: stats.workers, icon: Briefcase, tone: "text-emerald-600 bg-emerald-50" },
        { label: "Non-workers", value: stats.nonWorkers, icon: UserMinus, tone: "text-amber-600 bg-amber-50" },
    ];
    return (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {items.map((s) => (
                <div
                    key={s.label}
                    className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3"
                >
                    <span className={`rounded-lg p-2 ${s.tone}`}>
                        <s.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                        <dt className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            {s.label}
                        </dt>
                        <dd className="text-lg font-bold leading-tight text-slate-900">{s.value}</dd>
                    </span>
                </div>
            ))}
        </dl>
    );
}
