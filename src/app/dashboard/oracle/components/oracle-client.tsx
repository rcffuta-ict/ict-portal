"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Loader2, Download, AlertCircle, Play } from "lucide-react";
import { runOracleQuery, exportOracleQuery } from "../actions";
import {
    DEFAULT_COLUMNS,
    type Condition,
    type MatchMode,
    type OracleQuery,
} from "../fields";
import { QueryBuilder, type RefData } from "./query-builder";
import { ColumnPicker } from "./column-picker";
import { ResultTable, type ResultRow, type SortState } from "./result-table";

const PAGE_SIZE = 25;

/**
 * Where the current question is kept while the admin opens a record. Only its SHAPE
 * (conditions, columns, search, sort), never member data. Session storage, so it lasts
 * for the tab and is gone when the browser closes.
 */
const QUERY_KEY = "oracle:query:v1";

interface SavedQuery {
    conditions: Condition[];
    match: MatchMode;
    columns: string[];
    search: string;
    sort?: SortState;
}

function readSavedQuery(): SavedQuery | null {
    try {
        const raw = sessionStorage.getItem(QUERY_KEY);
        if (!raw) return null;
        const q = JSON.parse(raw) as Partial<SavedQuery>;
        if (!Array.isArray(q.conditions) || !Array.isArray(q.columns) || !q.columns.length) return null;
        return {
            conditions: q.conditions,
            match: q.match === "any" ? "any" : "all",
            columns: q.columns,
            search: typeof q.search === "string" ? q.search : "",
            sort: q.sort,
        };
    } catch {
        return null; // private mode, blocked storage, or a malformed value: start fresh
    }
}

/**
 * The Oracle query screen.
 *
 * Paging, filtering and sorting all run in Postgres — the fellowship is a few thousand
 * profiles, and shipping them to a phone on mobile data just to filter in the browser
 * is exactly what this project can't afford. One page (25) crosses the wire at a time,
 * and "Load more" is an explicit button so a member on a slow connection stays in
 * control of what they download.
 */
export function OracleClient({
    refData,
    initial,
}: {
    refData: RefData;
    initial: {
        rows: ResultRow[];
        columns: string[];
        total: number;
        error?: string;
    };
}) {
    const [conditions, setConditions] = useState<Condition[]>([]);
    const [match, setMatch] = useState<MatchMode>("all");
    const [columns, setColumns] = useState<string[]>(initial.columns.length ? initial.columns : DEFAULT_COLUMNS);
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState<SortState | undefined>();

    const [rows, setRows] = useState<ResultRow[]>(initial.rows);
    const [total, setTotal] = useState(initial.total);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(initial.error ?? null);
    const [notice, setNotice] = useState<string | null>(null);

    // Guards against a slow response overwriting a newer one.
    const requestId = useRef(0);
    // The server already delivered page 1; don't refetch it on mount.
    const primed = useRef(true);

    const buildQuery = useCallback(
        (overrides: Partial<OracleQuery> = {}): OracleQuery => ({
            conditions,
            match,
            columns,
            search,
            sort,
            page: 1,
            pageSize: PAGE_SIZE,
            ...overrides,
        }),
        [conditions, match, columns, search, sort],
    );

    const fetchPage = useCallback(
        async (nextPage: number, append: boolean, overrides: Partial<OracleQuery> = {}) => {
            const id = ++requestId.current;
            if (append) setLoadingMore(true);
            else setLoading(true);
            setError(null);

            const res = await runOracleQuery(buildQuery({ ...overrides, page: nextPage }));
            if (id !== requestId.current) return; // superseded by a newer request

            if (!res.success) {
                setError(res.error || "Query failed.");
                if (!append) setRows([]);
            } else {
                setRows((prev) => (append ? [...prev, ...res.rows] : res.rows));
                setTotal(res.total);
                setPage(nextPage);
            }
            if (append) setLoadingMore(false);
            else setLoading(false);
        },
        [buildQuery],
    );

    // Coming back from a record: put the question back and run it again. Deferred a
    // tick, so it isn't a state change during the effect's own commit.
    const restored = useRef(false);
    useEffect(() => {
        const saved = readSavedQuery();
        restored.current = true;
        if (!saved) return;
        const t = setTimeout(() => {
            setConditions(saved.conditions);
            setMatch(saved.match);
            setColumns(saved.columns);
            setSearch(saved.search);
            setSort(saved.sort);
            fetchPage(1, false, saved);
        }, 0);
        return () => clearTimeout(t);
        // Mount only: this reads what the previous visit left behind.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Remember the question as it changes (after the restore above has had its turn).
    useEffect(() => {
        if (!restored.current) return;
        try {
            sessionStorage.setItem(QUERY_KEY, JSON.stringify({ conditions, match, columns, search, sort }));
        } catch {
            // Storage unavailable: the query just won't survive leaving the page.
        }
    }, [conditions, match, columns, search, sort]);

    // Debounced re-query whenever the shape of the question changes.
    useEffect(() => {
        if (primed.current) {
            primed.current = false;
            return;
        }
        const t = setTimeout(() => fetchPage(1, false), search ? 300 : 0);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, columns, sort, match]);

    const toggleSort = (field: string) => {
        setSort((prev) =>
            prev?.field === field
                ? { field, direction: prev.direction === "asc" ? "desc" : "asc" }
                : { field, direction: "asc" },
        );
    };

    const onExport = async () => {
        setExporting(true);
        setError(null);
        setNotice(null);
        const res = await exportOracleQuery(buildQuery());
        setExporting(false);

        if (!res.success) {
            setError(res.error || "Export failed.");
            return;
        }
        // Blob + object URL: the CSV never touches the network a second time.
        const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename;
        a.click();
        URL.revokeObjectURL(url);
        setNotice(
            res.truncated
                ? `Exported the first ${res.count} rows — narrow the query to get the rest.`
                : `Exported ${res.count} member${res.count === 1 ? "" : "s"}.`,
        );
    };

    const hasMore = rows.length < total;

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                    />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name, email, phone or matric…"
                        aria-label="Search members"
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition-all focus:border-rcf-navy focus:ring-4 focus:ring-blue-500/10"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => fetchPage(1, false)}
                        disabled={loading}
                        className="inline-flex h-12 items-center gap-2 rounded-xl bg-rcf-navy px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:opacity-60"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <Play className="h-4 w-4" aria-hidden="true" />
                        )}
                        Run
                    </button>
                    <button
                        type="button"
                        onClick={onExport}
                        disabled={exporting || loading}
                        className="inline-flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-rcf-navy transition-colors hover:border-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:opacity-60"
                    >
                        {exporting ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <Download className="h-4 w-4" aria-hidden="true" />
                        )}
                        <span className="hidden sm:inline">Export CSV</span>
                    </button>
                </div>
            </div>

            <QueryBuilder
                conditions={conditions}
                match={match}
                refData={refData}
                onChange={setConditions}
                onMatchChange={setMatch}
                disabled={loading}
            />

            <ColumnPicker columns={columns} onChange={setColumns} disabled={loading} />

            {error && (
                <p
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    {error}
                </p>
            )}

            {notice && (
                <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {notice}
                </p>
            )}

            <p className="text-xs font-medium text-slate-500" role="status" aria-live="polite">
                {loading
                    ? "Running query…"
                    : `${total} member${total === 1 ? "" : "s"} match — showing ${rows.length}.`}
            </p>

            <ResultTable
                columns={columns}
                rows={rows}
                sort={sort}
                onSort={toggleSort}
                loading={loading}
            />

            {hasMore && (
                <button
                    type="button"
                    onClick={() => fetchPage(page + 1, true)}
                    disabled={loadingMore}
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-rcf-navy transition-colors hover:border-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:opacity-60"
                >
                    {loadingMore ? (
                        <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            Loading…
                        </span>
                    ) : (
                        `Load more (${total - rows.length} left)`
                    )}
                </button>
            )}
        </div>
    );
}
