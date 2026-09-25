/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { UnitCard, UNIT_CARD_GRID } from "@/components/dashboard/unit-card";

/**
 * Every unit and team, for the admin read tier. Each card opens the unit's own page
 * (`/dashboard/units/[unitId]`), which is read-only for the President.
 */
export function AdminUnitView({ data }: { data: { units: any[] } }) {
    const [search, setSearch] = useState("");

    const filtered = data.units.filter((u: any) =>
        u.name.toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <div className="space-y-5">
            <div className="relative w-full md:w-80">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search units…"
                    aria-label="Search units and teams"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 text-sm outline-none focus:ring-2 focus:ring-rcf-navy"
                />
            </div>

            <ul className={UNIT_CARD_GRID}>
                {filtered.map((u: any) => (
                    <li key={u.id}>
                        <UnitCard unit={u} href={`/dashboard/units/${u.id}`} />
                    </li>
                ))}
                {filtered.length === 0 && (
                    <li className="col-span-full rounded-2xl border-2 border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
                        No unit or team matches &ldquo;{search}&rdquo;.
                    </li>
                )}
            </ul>
        </div>
    );
}
