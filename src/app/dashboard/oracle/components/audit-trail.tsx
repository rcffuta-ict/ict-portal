import { History, ArrowRight } from "lucide-react";
import { getAuditTrail } from "../actions";
import { getField } from "../fields";

/**
 * What has been changed on this member, and by whom.
 *
 * Server component: the trail is part of the record, so it arrives with the page rather
 * than after a client fetch. A missing table (migration 0010 not yet applied) degrades
 * to a plain notice instead of an error.
 */
export async function AuditTrail({ profileId }: { profileId: string }) {
    const res = await getAuditTrail(profileId);

    if (!res.success) {
        return (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <Heading />
                <p className="text-xs text-slate-400">
                    The audit log isn&rsquo;t available yet — apply{" "}
                    <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px]">
                        db/migrations/0010_admin_audit_log.sql
                    </code>{" "}
                    to start recording changes.
                </p>
            </section>
        );
    }

    if (!res.data.length) {
        return (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <Heading />
                <p className="text-xs text-slate-400">
                    No admin changes recorded for this member.
                </p>
            </section>
        );
    }

    const label = (field: string | null) => {
        if (!field) return "record";
        // The log stores COLUMN names; map back to the human label where one exists.
        const match = getField(field);
        if (match) return match.label;
        const byColumn = { unit: "Unit", team: "Team" } as Record<string, string>;
        return byColumn[field] ?? field;
    };

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <Heading />
            <ol className="divide-y divide-slate-50">
                {res.data.map((entry: Record<string, string | null>) => (
                    <li key={entry.id as string} className="py-2.5 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span className="text-xs font-bold text-slate-700">
                                {label(entry.field)}
                            </span>
                            <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-slate-500">
                                <Value>{entry.old_value}</Value>
                                <ArrowRight className="h-3 w-3 shrink-0 text-slate-300" aria-hidden="true" />
                                <Value>{entry.new_value}</Value>
                            </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                            {entry.actor_name || "Unknown admin"} ·{" "}
                            <time dateTime={entry.created_at ?? undefined}>
                                {entry.created_at
                                    ? new Intl.DateTimeFormat("en-NG", {
                                        timeZone: "Africa/Lagos",
                                        dateStyle: "medium",
                                        timeStyle: "short",
                                    }).format(new Date(entry.created_at))
                                    : "—"}
                            </time>
                        </p>
                    </li>
                ))}
            </ol>
        </section>
    );
}

function Heading() {
    return (
        <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            Change history
        </h3>
    );
}

function Value({ children }: { children: string | null }) {
    if (!children) return <em className="text-slate-300">empty</em>;
    return <span className="truncate rounded bg-slate-50 px-1.5 py-0.5 font-mono">{children}</span>;
}
