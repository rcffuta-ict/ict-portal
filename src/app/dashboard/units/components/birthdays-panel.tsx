"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Cake, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { getUnitBirthdaysAction } from "../actions";

type Row = { profileId: string; name: string; avatarUrl: string | null; day: number };

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

/**
 * Birthdays in this unit, a month at a time. Opens on the current month; the arrows
 * step through the year. Today's celebrants are highlighted.
 */
export function BirthdaysPanel({ unitId }: { unitId: string }) {
    const today = lagosToday();
    const [cursor, setCursor] = useState({ year: today.year, month: today.month });
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        const res = await getUnitBirthdaysAction(unitId, cursor.month, cursor.year);
        if (res.success) setRows(res.data);
        else setError(res.error || "Couldn't load birthdays.");
        setLoading(false);
    }, [unitId, cursor.month, cursor.year]);

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

    return (
        <section aria-labelledby={`bdays-${unitId}`} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <h3 id={`bdays-${unitId}`} className="flex items-center gap-2 font-bold text-slate-700">
                    <Cake className="h-4 w-4" aria-hidden="true" /> Birthdays
                </h3>
                <div className="flex items-center gap-1">
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
            ) : rows.length === 0 ? (
                <p className="rounded-xl border-2 border-dashed border-slate-100 py-10 text-center text-sm text-slate-400">
                    No birthdays in {monthName}.
                </p>
            ) : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                    {rows.map((r) => {
                        const isToday = isThisMonth && r.day === today.day;
                        return (
                            <li
                                key={r.profileId}
                                className={`flex items-center gap-3 px-3 py-2.5 ${isToday ? "bg-rcf-gold/15" : ""}`}
                            >
                                <span
                                    className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg text-center leading-none ${
                                        isToday ? "bg-rcf-gold text-rcf-navy" : "bg-slate-100 text-slate-700"
                                    }`}
                                >
                                    <span className="text-sm font-bold">{r.day}</span>
                                    <span className="text-[9px] uppercase">{monthName.slice(0, 3)}</span>
                                </span>
                                <Link
                                    href={`/dashboard/units/${unitId}/member/${r.profileId}`}
                                    className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 hover:text-rcf-navy hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                                >
                                    {r.name}
                                </Link>
                                {isToday && (
                                    <span className="shrink-0 rounded-full bg-rcf-navy px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                                        Today
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
