/**
 * CSV rendering shared by every export in the app (level export, Oracle export).
 *
 * Kept in one place because of `csvCell`'s formula-injection guard: getting that
 * wrong in a copy of this code is the kind of bug nobody notices until a member's
 * spreadsheet runs something it shouldn't.
 */

/**
 * RFC4180 cell + spreadsheet formula-injection guard: a value starting with =, +, -, @
 * (or a tab/CR) is executed as a formula by Excel/Sheets, so prefix it with an apostrophe.
 */
export function csvCell(value: unknown): string {
    if (value === null || value === undefined) return "";
    let s = String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows of already-resolved values -> an RFC4180 document (CRLF line endings). */
export function toCsv(header: string[], rows: unknown[][]): string {
    return [
        header.map(csvCell).join(","),
        ...rows.map((r) => r.map(csvCell).join(",")),
    ].join("\r\n");
}

/** "generations-members-2026-08-27.csv" — a stable, sortable export filename. */
export function csvFilename(base: string): string {
    const slug = (base || "export")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    return `${slug || "export"}-${new Date().toISOString().slice(0, 10)}.csv`;
}
