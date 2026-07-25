/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from "react";

/** Presentational full-member detail. The server page fetches the profile context. */
export function MemberDetailView({ detail }: { detail: any }) {
    const p = detail.profile || {};
    const a = detail.academics || {};
    const loc = detail.location || {};

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-700 text-lg overflow-hidden shrink-0">
                    {p.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                        <span>{p.firstName?.[0]}{p.lastName?.[0]}</span>
                    )}
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-900">
                        {p.firstName} {p.middleName} {p.lastName}
                    </h2>
                    <p className="text-sm text-slate-500">
                        {a.currentLevel || detail.classSet?.currentLevel || "—"}
                    </p>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <DetailSection title="Bio">
                    <DetailRow label="Email" value={p.email} />
                    <DetailRow label="Phone" value={p.phoneNumber} />
                    <DetailRow label="Gender" value={p.gender} />
                    <DetailRow label="Date of birth" value={p.dob} />
                </DetailSection>

                <DetailSection title="Academics">
                    <DetailRow label="Matric number" value={a.matricNumber} />
                    <DetailRow label="Department" value={a.department} />
                    <DetailRow label="Faculty" value={a.faculty} />
                    <DetailRow label="Generation" value={a.family || detail.classSet?.familyName} />
                    <DetailRow label="Entry year" value={a.entryYear ?? detail.classSet?.entryYear} />
                </DetailSection>

                <DetailSection title="Location">
                    <DetailRow label="School address" value={loc.schoolAddress} />
                    <DetailRow label="Home address" value={loc.homeAddress} />
                    <DetailRow label="Residential zone" value={loc.residentialZone} />
                </DetailSection>

                <DetailSection title="Fellowship">
                    <DetailRow label="Unit" value={detail.unit?.name} />
                    <DetailRow label="Teams" value={(detail.teams || []).map((t: any) => t.name).join(", ")} />
                    <DetailRow label="Leadership" value={(detail.roles || []).map((r: any) => r.title).join(", ")} />
                </DetailSection>
            </div>
        </div>
    );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="rounded-xl border border-slate-100 overflow-hidden bg-white">
            <h4 className="bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                {title}
            </h4>
            <div className="divide-y divide-slate-50">{children}</div>
        </section>
    );
}

function DetailRow({ label, value }: { label: string; value: any }) {
    return (
        <div className="flex items-start justify-between gap-4 px-4 py-2.5">
            <span className="text-xs font-medium text-slate-400 shrink-0">{label}</span>
            <span className="text-sm text-slate-800 text-right break-words">
                {value === null || value === undefined || value === "" ? (
                    <span className="text-slate-300">—</span>
                ) : (
                    String(value)
                )}
            </span>
        </div>
    );
}
