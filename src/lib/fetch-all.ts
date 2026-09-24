/**
 * Every row of a query, however many there are.
 *
 * PostgREST caps a single response at `max_rows` (1000 here, supabase/config.toml), and
 * it does so SILENTLY: a plain `db.from("profiles").select(...)` on a fellowship of 1,200
 * returns 1,000 rows and no error. Every total built on it stops growing, and anything
 * that copies rows (the handover carry-over) quietly leaves people behind.
 *
 * Use this for any read that must be complete — whole-table reads and counts built by
 * hand. Filtered reads that can never approach 1000 (one generation, one unit) don't
 * need it. The query MUST have a stable order (e.g. `.order("id")`), or pages can
 * overlap and skip rows.
 *
 *   const profiles = await fetchAll((from, to) =>
 *       db.from("profiles").select("id, gender").order("id").range(from, to));
 */
export async function fetchAll<T>(
    build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
    pageSize = 1000,
): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; ; from += pageSize) {
        const { data, error } = await build(from, from + pageSize - 1);
        if (error) throw new Error(error.message);
        rows.push(...(data ?? []));
        if (!data || data.length < pageSize) return rows;
    }
}
