"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Divides evenly into the 1, 2 and 3-column grid, so no page ends ragged. */
export const GRID_PAGE_SIZE = 24;

/**
 * The layout every Workforce listing shares: a grid of cards — one column on a phone,
 * two from `sm`, three from `xl` — paged in the browser.
 *
 * Paged because Brothers' and Sisters' hold half the fellowship each, and rendering
 * hundreds of cards (and their photos) at once is what makes a mid-range phone stutter.
 * In the browser because each listing already arrives in one request; paging it on the
 * server would cost a round trip per page on a slow connection for no saving.
 *
 * `resetKey` returns to page 1 whenever it changes — pass the filter text, the month,
 * whatever defines "a different list". The page is also clamped, so removing the last
 * card on the final page steps back instead of showing an empty page.
 */
export function PaginatedGrid<T>({
    items,
    getKey,
    renderItem,
    empty,
    label,
    resetKey,
    pageSize = GRID_PAGE_SIZE,
}: {
    items: T[];
    getKey: (item: T) => string;
    renderItem: (item: T) => React.ReactNode;
    /** Shown in place of the grid when `items` is empty. */
    empty: React.ReactNode;
    /** Names the list for screen readers, e.g. "Choir Unit members". */
    label: string;
    resetKey?: unknown;
    pageSize?: number;
}) {
    const [page, setPage] = useState(1);
    // Reset during render rather than in an effect, so the stale page never paints.
    const [seenKey, setSeenKey] = useState(resetKey);
    if (seenKey !== resetKey) {
        setSeenKey(resetKey);
        setPage(1);
    }

    if (items.length === 0) return <>{empty}</>;

    const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
    const current = Math.min(page, pageCount);
    const visible = items.slice((current - 1) * pageSize, current * pageSize);

    return (
        <div className="space-y-4">
            <ul aria-label={label} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((item) => (
                    <li key={getKey(item)} className="min-w-0">
                        {renderItem(item)}
                    </li>
                ))}
            </ul>

            {pageCount > 1 && (
                <nav
                    aria-label={`${label}, pages`}
                    className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4"
                >
                    <button
                        type="button"
                        onClick={() => setPage(current - 1)}
                        disabled={current === 1}
                        className="inline-flex h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
                    </button>
                    <p className="text-xs text-slate-500" aria-live="polite">
                        Page <strong className="text-slate-700">{current}</strong> of {pageCount}
                        <span className="hidden sm:inline"> · {items.length} in all</span>
                    </p>
                    <button
                        type="button"
                        onClick={() => setPage(current + 1)}
                        disabled={current === pageCount}
                        className="inline-flex h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                </nav>
            )}
        </div>
    );
}
