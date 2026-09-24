/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useState } from "react";
import { Crown, Loader2, RefreshCw, User } from "lucide-react";
import { getUnitDetailsAction } from "../actions";
import { RosterCard } from "@/components/dashboard/roster/roster-card";

/**
 * The Leadership tab: the Executives AMONG this unit's members.
 *
 * Not the unit's own offices. It's everyone on the roster who holds an Exco office this
 * tenure, whichever unit that office belongs to, because that's the question a unit asks:
 * which of our people are Excos? Leads come before assistants. It reads the same roster
 * as the Members tab (and with the same permission check), just filtered.
 */
export function UnitExecutives({ unit }: { unit: { id: string; name: string } }) {
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getUnitDetailsAction(unit.id);
            if (res.success) setMembers(res.data.filter((m: any) => m.excoOffice));
            else setError(res.error || "Couldn't load the Executives.");
        } catch {
            setError("Couldn't reach the server. Check your connection and try again.");
        }
        setLoading(false);
    }, [unit.id]);

    useEffect(() => {
        // Deferred a tick so the fetch's setState calls happen outside the effect body.
        const t = setTimeout(load, 0);
        return () => clearTimeout(t);
    }, [load]);

    const sorted = [...members].sort(
        (a, b) =>
            Number(b.excoLead) - Number(a.excoLead) ||
            `${a.first_name ?? ""} ${a.last_name ?? ""}`.localeCompare(`${b.first_name ?? ""} ${b.last_name ?? ""}`),
    );

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h4 className="mb-1 flex items-center gap-2 font-bold text-slate-700">
                <Crown className="h-4 w-4 text-amber-600" aria-hidden="true" /> Executives
                {!loading && !error && <span className="text-xs font-medium text-slate-400">{members.length}</span>}
            </h4>
            <p className="mb-4 text-xs text-slate-500">
                Members of {unit.name} who hold an Exco office this tenure.
            </p>

            {loading ? (
                <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500" role="status">
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    Loading Executives…
                </p>
            ) : error ? (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <p>{error}</p>
                    <button
                        type="button"
                        onClick={load}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-red-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                    >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
                    </button>
                </div>
            ) : sorted.length === 0 ? (
                <p className="rounded-xl border-2 border-dashed border-slate-100 py-10 text-center text-sm text-slate-400">
                    <User className="mx-auto mb-2 h-8 w-8 opacity-20" aria-hidden="true" />
                    None of this unit&apos;s members holds an Exco office.
                </p>
            ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                    {sorted.map((m) => (
                        <li key={m.membershipId || m.id}>
                            <RosterCard
                                href={`/dashboard/units/${unit.id}/member/${m.id}`}
                                firstName={m.first_name}
                                lastName={m.last_name}
                                gender={m.gender}
                                avatarUrl={m.avatar_url}
                                email={m.email}
                                phone={m.phone_number}
                                meta={`${m.excoOffice}${m.excoLead ? "" : " (assistant)"}`}
                                badge={
                                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-rcf-gold/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rcf-navy">
                                        {/* <Crown className="h-2.5 w-2.5" aria-hidden="true" />{m.excoOffice} {m.excoLead ? "" : "(Asst)"} */}
                                        {m.excoOffice} {m.excoLead ? "" : "Asst"}
                                    </span>
                                }
                            />
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
