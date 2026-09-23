/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo, useState } from "react";
import { Search, ShieldCheck, KeyRound, UserCheck } from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import { PrivilegePills } from "../privilege-pills";

/**
 * Step 1 — which office is being filled.
 *
 * Office first, member second. The old flow searched the fellowship and then offered a
 * dropdown of thirty-six offices, which asks you to know who you want before the screen
 * has told you what you are filling. Starting from the office means the rest of the
 * flow can narrow itself: the level grid knows which generation to expect, and the
 * member list knows which offices its candidates already hold.
 *
 * Offices are grouped by tier, in the fellowship's own order, so the list reads as the
 * hierarchy rather than as an alphabetical inventory.
 */

const TIER_ORDER = ["PRESIDENT", "VP", "EXECUTIVE", "COORDINATOR"] as const;

const TIER_LABEL: Record<string, string> = {
    PRESIDENT: "President",
    VP: "Vice Presidents",
    EXECUTIVE: "Executives",
    COORDINATOR: "Coordinators",
    OTHER: "Other offices",
};

export function OfficeStep({
    positions,
    leadership,
    onPick,
}: {
    positions: any[];
    leadership: any[];
    onPick: (office: any) => void;
}) {
    const [query, setQuery] = useState("");

    // Who holds what, so an occupied office says so on its own card. Re-appointing over
    // a sitting holder is a legitimate act, but it should be a visible decision rather
    // than something discovered from an error after pressing Appoint.
    const holdersByPosition = useMemo(() => {
        const map = new Map<string, string[]>();
        for (const row of leadership ?? []) {
            if (!row?.position_id) continue;
            const person = row.profile
                ? `${row.profile.first_name} ${row.profile.last_name}`
                : null;
            if (!person) continue;
            const list = map.get(row.position_id) ?? [];
            list.push(row.is_lead === false ? `${person} (assistant)` : person);
            map.set(row.position_id, list);
        }
        return map;
    }, [leadership]);

    const grouped = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const active = (positions ?? [])
            .filter((p: any) => p.is_active !== false)
            .filter((p: any) =>
                !needle ||
                `${p.title} ${p.alias ?? ""} ${p.slug ?? ""}`.toLowerCase().includes(needle),
            );

        const buckets = new Map<string, any[]>();
        for (const position of active) {
            const tier = TIER_ORDER.includes(position.tier) ? position.tier : "OTHER";
            buckets.set(tier, [...(buckets.get(tier) ?? []), position]);
        }
        return [...TIER_ORDER, "OTHER"]
            .filter((tier) => buckets.has(tier))
            .map((tier) => ({ tier, label: TIER_LABEL[tier], offices: buckets.get(tier)! }));
    }, [positions, query]);

    const total = grouped.reduce((sum, g) => sum + g.offices.length, 0);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-bold text-slate-900">Which office?</h3>
                <p className="mt-1 text-sm text-slate-500">
                    Pick the office being filled. The next step narrows the fellowship down
                    to one generation.
                </p>
            </div>

            <FormInput
                type="search"
                placeholder="Filter offices…"
                value={query}
                onChange={(e: any) => setQuery(e.target.value)}
                leftIcon={<Search className="h-5 w-5" />}
                aria-label="Filter offices"
            />

            {total === 0 && (
                <p className="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
                    No office matches “{query}”.
                </p>
            )}

            {grouped.map((group) => (
                <section key={group.tier} className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        {group.label}
                    </h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {group.offices.map((office: any) => {
                            const holders = holdersByPosition.get(office.id) ?? [];
                            return (
                                <button
                                    key={office.id}
                                    type="button"
                                    onClick={() => onPick(office)}
                                    className="flex min-h-11 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-rcf-navy/40 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rcf-navy"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-slate-900">
                                                {office.alias || office.title}
                                            </p>
                                            {office.alias && (
                                                <p className="truncate text-[11px] text-slate-400">
                                                    {office.title}
                                                </p>
                                            )}
                                        </div>
                                        {office.grants_login && (
                                            <span
                                                title="Appointment to this office provisions a portal login."
                                                className="flex shrink-0 items-center gap-1 rounded border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-600"
                                            >
                                                <KeyRound className="h-3 w-3" /> Login
                                            </span>
                                        )}
                                    </div>

                                    <PrivilegePills privileges={office.position_privileges} />

                                    <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                        {holders.length > 0 ? (
                                            <>
                                                <UserCheck className="h-3 w-3 shrink-0 text-emerald-600" />
                                                <span className="truncate">{holders.join(", ")}</span>
                                            </>
                                        ) : (
                                            <>
                                                <ShieldCheck className="h-3 w-3 shrink-0 text-slate-300" />
                                                <span className="text-slate-400">Vacant</span>
                                            </>
                                        )}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}
