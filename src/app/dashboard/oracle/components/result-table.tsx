"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronRight, Users } from "lucide-react";
import { getField } from "../fields";

export interface ResultRow {
    id: string;
    cells: Record<string, unknown>;
}

export interface SortState {
    field: string;
    direction: "asc" | "desc";
}

/**
 * Query results.
 *
 * TWO renderings, one data set: a real table from `sm` up, and stacked cards below it.
 * A ten-column table on a mid-range Android phone is unreadable at any zoom level, and
 * the page body must never scroll sideways — so the small screen gets cards, and the
 * table keeps its own `overflow-x-auto` container for the wide case.
 */
export function ResultTable({
    columns,
    rows,
    sort,
    onSort,
    loading,
}: {
    columns: string[];
    rows: ResultRow[];
    sort?: SortState;
    onSort: (field: string) => void;
    loading?: boolean;
}) {
    if (!loading && rows.length === 0) {
        return (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
                <Users className="h-8 w-8 text-slate-300" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-700">No members match</p>
                <p className="text-xs text-slate-500">
                    Try removing a condition, or switch Match to &ldquo;Any&rdquo;.
                </p>
            </div>
        );
    }

    const label = (key: string) => getField(key)?.label ?? key;
    const show = (value: unknown) =>
        value === null || value === undefined || value === "" ? "—" : String(value);

    return (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
            {/* Small screens: one card per member. */}
            <ul className="space-y-2 sm:hidden">
                {rows.map((row) => {
                    const [first, ...rest] = columns;
                    return (
                        <li key={row.id}>
                            <Link
                                href={`/dashboard/oracle/${row.id}`}
                                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-rcf-navy/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                            >
                                <div className="min-w-0 flex-1 space-y-1">
                                    <p className="truncate text-sm font-bold text-slate-900">
                                        {show(row.cells[first])}
                                    </p>
                                    <dl className="space-y-0.5">
                                        {rest.map((c) => (
                                            <div key={c} className="flex gap-2 text-[11px]">
                                                <dt className="shrink-0 font-medium text-slate-400">
                                                    {label(c)}
                                                </dt>
                                                <dd className="min-w-0 flex-1 truncate text-slate-700">
                                                    {show(row.cells[c])}
                                                </dd>
                                            </div>
                                        ))}
                                    </dl>
                                </div>
                                <ChevronRight
                                    className="mt-1 h-4 w-4 shrink-0 text-slate-300"
                                    aria-hidden="true"
                                />
                            </Link>
                        </li>
                    );
                })}
            </ul>

            {/* Wide screens: a table, scrolling inside its own box. */}
            <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white sm:block">
                <table className="w-full min-w-max text-left text-sm">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                            {columns.map((c) => {
                                const field = getField(c);
                                const active = sort?.field === c;
                                return (
                                    <th
                                        key={c}
                                        scope="col"
                                        aria-sort={
                                            active
                                                ? sort!.direction === "asc"
                                                    ? "ascending"
                                                    : "descending"
                                                : "none"
                                        }
                                        className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500"
                                    >
                                        {field?.sortable ? (
                                            <button
                                                type="button"
                                                onClick={() => onSort(c)}
                                                className="inline-flex items-center gap-1 hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                                            >
                                                {label(c)}
                                                {active &&
                                                    (sort!.direction === "asc" ? (
                                                        <ArrowUp className="h-3 w-3" aria-hidden="true" />
                                                    ) : (
                                                        <ArrowDown className="h-3 w-3" aria-hidden="true" />
                                                    ))}
                                            </button>
                                        ) : (
                                            label(c)
                                        )}
                                    </th>
                                );
                            })}
                            <th scope="col" className="px-4 py-2.5">
                                <span className="sr-only">Open record</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {rows.map((row) => (
                            <tr key={row.id} className="transition-colors hover:bg-slate-50/60">
                                {columns.map((c) => (
                                    <td key={c} className="px-4 py-2.5 text-slate-700">
                                        {show(row.cells[c])}
                                    </td>
                                ))}
                                <td className="px-4 py-2.5">
                                    <Link
                                        href={`/dashboard/oracle/${row.id}`}
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-rcf-navy hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                                    >
                                        Open
                                        <ChevronRight className="h-3 w-3" aria-hidden="true" />
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
