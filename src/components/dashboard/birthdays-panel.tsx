"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Cake, ChevronLeft, ChevronRight, Download, GraduationCap, Loader2, Phone, RefreshCw } from "lucide-react";
import { downloadCsv } from "@/lib/csv";
import { PaginatedGrid } from "@/components/dashboard/roster/paginated-grid";
import { MemberAvatar } from "@/components/dashboard/roster/member-avatar";

export type BirthdayRow = {
    profileId: string;
    firstName: string | null;
    lastName: string | null;
    name: string;
    avatarUrl: string | null;
    day: number;
    department: string | null;
    phone: string | null;
    level: string | null;
};

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

/** Today in Lagos, whatever the phone's own timezone is set to. */
function lagosToday(): { year: number; month: number; day: number } {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Lagos",
        year: "numeric",
        month: "numeric",
        day: "numeric",
    }).formatToParts(new Date());
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return { year: get("year"), month: get("month"), day: get("day") };
}

type Row = BirthdayRow;

/** How a panel gets one month's celebrants: each module's own gated server action. */
export type LoadBirthdays = (
    month: number,
    year: number,
) => Promise<{ success: boolean; data: BirthdayRow[]; error?: string }>;

/**
 * Birthdays in a group (a unit, or a generation), a month at a time. Opens on the current month; the arrows
 * step through the year.
 *
 * Each card is what a leader needs to act on it: the face, the name, the day, the
 * department (so a namesake is told apart), and a number to tap and call. Today's
 * celebrants are ringed in gold and sorted first, since those are the calls to make now.
 */
export function BirthdaysPanel({
    load: loadMonth,
    groupName,
    groupId,
    memberHref,
}: {
    /** Fetches a month; the caller's server action decides who may see it. */
    load: LoadBirthdays;
    /** Names the export file ("choir-unit-birthdays-march-2027.csv"). */
    groupName?: string;
    /** Identifies the group on the page (heading ids). */
    groupId: string;
    /** Where a name links to: that member's page in this module. */
    memberHref: (profileId: string) => string;
}) {
    // Held in a ref: callers pass a fresh closure every render, and depending on it
    // directly would refetch on every render.
    const loadRef = useRef(loadMonth);
    useEffect(() => {
        loadRef.current = loadMonth;
    });
    const today = lagosToday();
    const [cursor, setCursor] = useState({ year: today.year, month: today.month });
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        let res: Awaited<ReturnType<LoadBirthdays>>;
        try {
            res = await loadRef.current(cursor.month, cursor.year);
        } catch {
            res = { success: false, data: [], error: "Couldn't reach the server. Check your connection and try again." };
        }
        if (res.success) setRows(res.data);
        else setError(res.error || "Couldn't load birthdays.");
        setLoading(false);
    // A different group means a different page, which mounts a fresh panel.
    }, [cursor.month, cursor.year]);

    useEffect(() => {
        const t = setTimeout(load, 0);
        return () => clearTimeout(t);
    }, [load]);

    const step = (delta: number) =>
        setCursor(({ year, month }) => {
            const m = month + delta;
            if (m < 1) return { year: year - 1, month: 12 };
            if (m > 12) return { year: year + 1, month: 1 };
            return { year, month: m };
        });

    const monthName = MONTHS[cursor.month - 1];
    const isThisMonth = cursor.year === today.year && cursor.month === today.month;
    /** The month on screen, in birthday order — what the unit uses to plan greetings. */
    const exportCsv = () => {
        const byDay = [...rows].sort((a, b) => a.day - b.day);
        downloadCsv(
            `${(groupName ?? "group").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-birthdays-${monthName.toLowerCase()}-${cursor.year}.csv`,
            ["Name", "Birthday", "Level", "Department", "Phone"],
            byDay.map((r) => [r.name, `${r.day} ${monthName}`, r.level, r.department, r.phone]),
        );
    };

    // Today's celebrants first, then by day of the month.
    const sorted = [...rows].sort((a, b) => {
        const at = isThisMonth && a.day === today.day ? 0 : 1;
        const bt = isThisMonth && b.day === today.day ? 0 : 1;
        return at - bt || a.day - b.day;
    });

    return (
        <section aria-labelledby={`bdays-${groupId}`} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <h3 id={`bdays-${groupId}`} className="flex items-center gap-2 font-bold text-slate-700">
                    <Cake className="h-4 w-4" aria-hidden="true" /> Birthdays
                </h3>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={exportCsv}
                        disabled={loading || rows.length === 0}
                        aria-label={`Export ${monthName} birthdays`}
                        className="mr-1 inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:opacity-40"
                    >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="hidden sm:inline">Export</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => step(-1)}
                        aria-label="Previous month"
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                    >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span aria-live="polite" className="min-w-28 text-center text-sm font-semibold text-slate-700">
                        {monthName} {cursor.year !== today.year ? cursor.year : ""}
                    </span>
                    <button
                        type="button"
                        onClick={() => step(1)}
                        aria-label="Next month"
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                    >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
            </div>

            {loading ? (
                <p role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    Loading birthdays…
                </p>
            ) : error ? (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <p>{error}</p>
                    <button
                        type="button"
                        onClick={load}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                    >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
                    </button>
                </div>
            ) : (
                <PaginatedGrid
                    items={sorted}
                    label={`Birthdays in ${monthName}`}
                    resetKey={`${cursor.year}-${cursor.month}`}
                    getKey={(r) => r.profileId}
                    empty={
                        <p className="rounded-xl border-2 border-dashed border-slate-100 py-10 text-center text-sm text-slate-400">
                            No birthdays in {monthName}.
                        </p>
                    }
                    renderItem={(r) => {
                        const isToday = isThisMonth && r.day === today.day;
                        return (
                            <div
                                className={`flex h-full min-w-0 items-center gap-3 rounded-xl border p-3 ${
                                    isToday ? "border-rcf-gold/60 bg-rcf-gold/10" : "border-slate-100 bg-white"
                                }`}
                            >
                                <MemberAvatar
                                    url={r.avatarUrl}
                                    first={r.firstName}
                                    last={r.lastName}
                                    size={48}
                                    ring={isToday}
                                />
                                <div className="min-w-0 flex-1">
                                    <Link
                                        href={memberHref(r.profileId)}
                                        className="block truncate text-sm font-bold text-slate-900 hover:text-rcf-navy hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                                    >
                                        {r.name}
                                    </Link>
                                    <p className={`text-xs font-semibold ${isToday ? "text-rcf-navy" : "text-slate-600"}`}>
                                        {isToday ? "Today 🎉" : `${r.day} ${monthName}`}
                                    </p>
                                    {(r.level || r.department) && (
                                        <p className="flex min-w-0 items-center gap-1 text-[11px] text-slate-500">
                                            <GraduationCap className="h-3 w-3 shrink-0" aria-hidden="true" />
                                            <span className="truncate">
                                                {[r.level, r.department].filter(Boolean).join(" · ")}
                                            </span>
                                        </p>
                                    )}
                                </div>
                                {r.phone && (
                                    <a
                                        href={`tel:${r.phone}`}
                                        aria-label={`Call ${r.name}`}
                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-rcf-navy hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                                    >
                                        <Phone className="h-4 w-4" aria-hidden="true" />
                                    </a>
                                )}
                            </div>
                        );
                    }}
                />            )}
        </section>
    );
}
