import Link from "next/link";
import { ShieldAlert, ChevronLeft, Eye } from "lucide-react";
import { getMemberRecord, getOracleRefData } from "../actions";
import { MemberEditor } from "../components/member-editor";
import { AuditTrail } from "../components/audit-trail";

/**
 * One member's record — the System Admin's edit surface.
 *
 * `canWrite` comes back from the server and only controls what the form RENDERS;
 * `updateMemberAction` re-derives it with `requireSysAdmin()` on every save, so a
 * President (who can read this page) cannot write by tampering with the client.
 */
export default async function OracleMemberPage({
    params,
}: {
    params: Promise<{ profileId: string }>;
}) {
    const { profileId } = await params;
    const [record, refs] = await Promise.all([
        getMemberRecord(profileId),
        getOracleRefData(),
    ]);

    if (!record.success || !refs.success) {
        return (
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
                <ShieldAlert className="h-10 w-10 text-amber-500" aria-hidden="true" />
                <h1 className="text-lg font-bold text-rcf-navy">Not available</h1>
                <p className="text-sm text-gray-600">
                    {(!record.success && record.error) || "You don't have access to this member."}
                </p>
            </div>
        );
    }

    const row = record.row as Record<string, unknown>;
    const name =
        [row.first_name, row.last_name].filter(Boolean).join(" ") || "Member";
    const level = record.context?.academics?.currentLevel ?? null;
    const roles = (record.context?.roles ?? []).map((r) => r.title).filter(Boolean);

    const refData = {
        zones: refs.zones.map((z: { id: string; name: string }) => ({ id: z.id, label: z.name })),
        classSets: refs.classSets.map((c: { id: string; family_name: string | null; entry_year: number | null }) => ({
            id: c.id,
            label: c.family_name || `${c.entry_year ?? "Unknown"} set`,
        })),
        units: refs.units.map((u: { id: string; name: string; type: string }) => ({
            id: u.id,
            label: `${u.name}${u.type === "TEAM" ? " (team)" : ""}`,
        })),
    };

    return (
        <div className="space-y-5">
            <Link
                href="/dashboard/oracle"
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition-colors hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
            >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Back to Oracle
            </Link>

            <header className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rcf-navy/10 text-lg font-bold text-rcf-navy">
                    {typeof row.avatar_url === "string" && row.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                        <span>
                            {String(row.first_name ?? "?")[0]}
                            {String(row.last_name ?? "")[0]}
                        </span>
                    )}
                </div>
                <div className="min-w-0">
                    <h1 className="truncate text-xl font-bold tracking-tight text-rcf-navy">
                        {name}
                    </h1>
                    <p className="truncate text-sm text-slate-500">
                        {[level, roles.join(", ")].filter(Boolean).join(" · ") || "Member"}
                    </p>
                </div>
            </header>

            {!record.canWrite && (
                <p
                    role="status"
                    className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
                >
                    <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    You&rsquo;re viewing this record read-only. Only the System Admin can change
                    member information.
                </p>
            )}

            <MemberEditor
                profileId={profileId}
                row={row}
                refData={refData}
                unitId={record.unitId}
                teamIds={record.teamIds}
                canWrite={record.canWrite}
            />

            <AuditTrail profileId={profileId} />
        </div>
    );
}

// Member records must never be served from a cache.
export const dynamic = "force-dynamic";
