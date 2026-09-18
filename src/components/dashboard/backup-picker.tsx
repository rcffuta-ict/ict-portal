"use client";

import { useMemo, useState } from "react";
import {
    Download,
    Loader2,
    FileType,
    FileJson,
    FileSpreadsheet,
    Lock,
    LockOpen,
    ShieldCheck,
    Check,
    Database,
    AlertTriangle,
} from "lucide-react";
import {
    BACKUP_TABLES,
    BACKUP_GROUP_LABELS,
    DEFAULT_TABLE_SELECTION,
    type BackupGroup,
} from "@/lib/backup-tables";
import FormInput from "@/components/ui/FormInput";

/**
 * Choose what goes into a backup, and download it.
 *
 * Shared on purpose: the handover wizard uses this for its first step, and it stands
 * alone anywhere else a backup is offered. It renders from the same registry the server
 * validates against (`src/lib/backup-tables.ts`), so the two can't drift.
 *
 * REQUIRED tables are shown as permanently checked rather than hidden. Someone deciding
 * what to keep should be able to see the whole picture — including the parts that
 * aren't theirs to drop, and why.
 */
export function BackupPicker({
    tenureId,
    tenureName,
    presidentName,
    onDownloaded,
}: {
    tenureId?: string | null;
    tenureName?: string | null;
    /** Default passphrase — the president of the tenure being backed up. */
    presidentName?: string | null;
    onDownloaded?: () => void;
}) {
    const [selected, setSelected] = useState<Set<string>>(
        () => new Set(DEFAULT_TABLE_SELECTION),
    );
    const [format, setFormat] = useState<"json" | "csv">("json");
    const [lock, setLock] = useState(true);
    const [useCustom, setUseCustom] = useState(false);
    const [custom, setCustom] = useState("");
    const [status, setStatus] = useState<"idle" | "preparing" | "done">("idle");
    const [error, setError] = useState<string | null>(null);

    const groups = useMemo(() => {
        const order: BackupGroup[] = [
            "identity",
            "structure",
            "access",
            "audit",
            "invites",
            "activity",
        ];
        return order
            .map((g) => ({ group: g, tables: BACKUP_TABLES.filter((t) => t.group === g) }))
            .filter((g) => g.tables.length > 0);
    }, []);

    const toggle = (name: string, required: boolean) => {
        if (required) return; // not a choice — a bundle without it can't restore
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    const optionalCount = BACKUP_TABLES.filter(
        (t) => !t.required && selected.has(t.name),
    ).length;
    const optionalTotal = BACKUP_TABLES.filter((t) => !t.required).length;

    const passphrase = useCustom ? custom.trim() : (presidentName ?? "").trim();
    const canLock = lock && passphrase.length > 0;

    const href = useMemo(() => {
        const params = new URLSearchParams();
        if (tenureId) params.set("tenure", tenureId);

        const optional = BACKUP_TABLES.filter((t) => !t.required && selected.has(t.name)).map(
            (t) => t.name,
        );
        if (optional.length) params.set("tables", optional.join(","));
        if (format === "csv") params.set("format", "csv");
        if (!canLock) params.set("lock", "0");
        if (canLock && useCustom) params.set("passphrase", passphrase);

        const qs = params.toString();
        return `/dashboard/tenure/backup${qs ? `?${qs}` : ""}`;
    }, [tenureId, selected, format, canLock, useCustom, passphrase]);

    const download = async () => {
        setStatus("preparing");
        setError(null);

        try {
            const res = await fetch(href);

            if (!res.ok) {
                // The route answers failures as JSON, so surface its actual reason
                // (403, a missing table) rather than a generic "download failed".
                let message = `Backup failed (${res.status}).`;
                try {
                    const body = await res.json();
                    if (body?.error) message = body.error;
                } catch {
                    /* non-JSON error body — keep the status message */
                }
                setError(message);
                setStatus("idle");
                return;
            }

            // Filename comes from the server so it always matches what was actually built.
            const disposition = res.headers.get("Content-Disposition") ?? "";
            const match = disposition.match(/filename="([^"]+)"/);
            const filename = match?.[1] ?? "rcf-backup";

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);

            setStatus("done");
            onDownloaded?.();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Backup failed.");
            setStatus("idle");
        }
    };

    return (
        <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-rcf-navy">
                        <Database className="h-4 w-4" aria-hidden="true" />
                        What gets backed up
                    </h3>
                    <span className="text-[11px] font-medium text-slate-400">
                        {optionalCount} of {optionalTotal} optional included
                    </span>
                </header>

                <div className="divide-y divide-slate-100">
                    {groups.map(({ group, tables }) => (
                        <fieldset key={group} className="px-4 py-3">
                            <legend className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                                {BACKUP_GROUP_LABELS[group]}
                            </legend>

                            <ul className="space-y-1.5">
                                {tables.map((t) => {
                                    const on = t.required || selected.has(t.name);
                                    return (
                                        <li key={t.name}>
                                            <label
                                                className={`flex items-start gap-3 rounded-xl border p-2.5 transition-colors ${
                                                    t.required
                                                        ? "cursor-default border-slate-100 bg-slate-50/70"
                                                        : "cursor-pointer border-slate-200 hover:border-slate-300"
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={on}
                                                    disabled={t.required}
                                                    onChange={() => toggle(t.name, t.required)}
                                                    className="mt-0.5 h-4 w-4 shrink-0 accent-rcf-navy disabled:opacity-60"
                                                />
                                                <span className="min-w-0">
                                                    <span className="flex flex-wrap items-center gap-1.5">
                                                        <span className="text-sm font-semibold text-slate-800">
                                                            {t.label}
                                                        </span>
                                                        {t.required && (
                                                            <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                                                                always
                                                            </span>
                                                        )}
                                                        {t.tenureColumn && (
                                                            <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                                                                this tenure only
                                                            </span>
                                                        )}
                                                        {t.redact?.length && (
                                                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                                                                <ShieldCheck className="h-2.5 w-2.5" aria-hidden="true" />
                                                                redacted
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                                                        {t.description}
                                                    </span>
                                                </span>
                                            </label>
                                        </li>
                                    );
                                })}
                            </ul>
                        </fieldset>
                    ))}
                </div>
            </section>

            {/* ---------------------------------------------------------------- */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-rcf-navy">
                    <FileType className="h-4 w-4" aria-hidden="true" />
                    Format
                </h3>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <FormatCard
                        checked={format === "json"}
                        onSelect={() => setFormat("json")}
                        icon={FileJson}
                        title="JSON"
                        detail="One file that can rebuild the database. This is what a restore needs — it keeps column types and the links between tables."
                    />
                    <FormatCard
                        checked={format === "csv"}
                        onSelect={() => setFormat("csv")}
                        icon={FileSpreadsheet}
                        title="CSV (zipped)"
                        detail="One spreadsheet per table, in a single .zip. For reading and sharing — CSV loses types and relationships, so it can't be restored from."
                    />
                </div>
            </section>

            {/* ---------------------------------------------------------------- */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-rcf-navy">
                    {canLock ? (
                        <Lock className="h-4 w-4" aria-hidden="true" />
                    ) : (
                        <LockOpen className="h-4 w-4 text-amber-600" aria-hidden="true" />
                    )}
                    Lock the file
                </h3>

                <label className="mt-3 flex cursor-pointer items-start gap-3">
                    <input
                        type="checkbox"
                        checked={lock}
                        onChange={(e) => setLock(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-rcf-navy"
                    />
                    <span className="text-sm text-slate-700">
                        Encrypt with AES-256
                        <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                            This file holds every member&rsquo;s phone number, date of birth and home
                            address. It will end up in a Downloads folder and probably a chat app.
                        </span>
                    </span>
                </label>

                {lock && (
                    <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
                        <label className="flex cursor-pointer items-start gap-3">
                            <input
                                type="radio"
                                name="passphrase-mode"
                                checked={!useCustom}
                                onChange={() => setUseCustom(false)}
                                className="mt-0.5 h-4 w-4 shrink-0 accent-rcf-navy"
                            />
                            <span className="min-w-0 text-sm text-slate-700">
                                Use the president&rsquo;s name
                                <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                                    {presidentName ? (
                                        <>
                                            Unlocks with <strong>{presidentName}</strong> — case and
                                            spacing don&rsquo;t matter. Memorable years from now,
                                            which is what an archive needs.
                                        </>
                                    ) : (
                                        <>
                                            No president is appointed for
                                            {tenureName ? ` ${tenureName}` : " this tenure"}, so
                                            there&rsquo;s no default. Set a custom passphrase.
                                        </>
                                    )}
                                </span>
                            </span>
                        </label>

                        <label className="flex cursor-pointer items-start gap-3">
                            <input
                                type="radio"
                                name="passphrase-mode"
                                checked={useCustom}
                                onChange={() => setUseCustom(true)}
                                className="mt-0.5 h-4 w-4 shrink-0 accent-rcf-navy"
                            />
                            <span className="min-w-0 text-sm text-slate-700">
                                Set my own
                                <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                                    Stronger. Write it down somewhere you&rsquo;ll still have next
                                    year — there is no way to recover the file without it.
                                </span>
                            </span>
                        </label>

                        {useCustom && (
                            <FormInput
                                label="Passphrase"
                                value={custom}
                                onChange={(e) => setCustom(e.target.value)}
                                placeholder="At least a few words"
                            />
                        )}

                        {!useCustom && presidentName && (
                            <p className="flex items-start gap-1.5 text-[11px] leading-snug text-amber-700">
                                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                                A name is easy to guess for anyone who knows the fellowship. It
                                stops a file being read by accident, not by someone determined.
                            </p>
                        )}
                    </div>
                )}

                {lock && !passphrase && (
                    <p role="alert" className="mt-3 text-xs font-medium text-red-600">
                        Enter a passphrase, or turn encryption off to download unlocked.
                    </p>
                )}
            </section>

            {error && (
                <p
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    {error}
                </p>
            )}

            {status === "done" && !error && (
                <p
                    role="status"
                    className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                >
                    <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    Backup downloaded. Keep it somewhere you&rsquo;ll still have it next year.
                </p>
            )}

            {/*
              Fetched rather than linked. A plain <a download> gives the browser the job
              and gives us NOTHING to show — no pending state while the server pages
              thousands of rows, and a 403 or a failed build would render as a blank tab
              instead of an error. Going through fetch costs holding the file in memory
              briefly (a few MB) and buys an honest progress and failure story.
            */}
            <button
                type="button"
                disabled={status === "preparing" || (lock && !passphrase)}
                onClick={download}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-rcf-navy px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
            >
                {status === "preparing" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : canLock ? (
                    <Lock className="h-4 w-4" aria-hidden="true" />
                ) : (
                    <Download className="h-4 w-4" aria-hidden="true" />
                )}
                {status === "preparing"
                    ? "Preparing backup…"
                    : `Download ${canLock ? "locked " : ""}${format === "csv" ? "CSV" : "JSON"} backup${tenureName ? ` — ${tenureName}` : ""}`}
            </button>

            <p className="text-[11px] text-slate-500">
                You&rsquo;ll get a{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px]">
                    .{canLock ? "rcfvault" : format === "csv" ? "zip" : "json"}
                </code>{" "}
                file named after the tenure and its theme.
                {canLock && " Keep the passphrase — there is no way to open it without one."}
            </p>

            {status === "preparing" && (
                <p className="text-[11px] text-slate-500" role="status" aria-live="polite">
                    Reading every table for this tenure{canLock ? " and encrypting the file" : ""}.
                    On a large fellowship this takes a few seconds — don&rsquo;t close the page.
                </p>
            )}

            <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" aria-hidden="true" />
                Password hashes, live sessions and invite tokens are never written to the file,
                encrypted or not. After a restore, leaders set a new password on first login.
            </p>
        </div>
    );
}

function FormatCard({
    checked,
    onSelect,
    icon: Icon,
    title,
    detail,
}: {
    checked: boolean;
    onSelect: () => void;
    icon: React.ElementType;
    title: string;
    detail: string;
}) {
    return (
        <label
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                checked ? "border-rcf-navy bg-rcf-navy/5" : "border-slate-200 hover:border-slate-300"
            }`}
        >
            <input
                type="radio"
                name="backup-format"
                checked={checked}
                onChange={onSelect}
                className="mt-0.5 h-4 w-4 shrink-0 accent-rcf-navy"
            />
            <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                    <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    {title}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                    {detail}
                </span>
            </span>
        </label>
    );
}
