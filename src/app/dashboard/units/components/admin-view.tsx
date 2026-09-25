/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Layers, Users } from "lucide-react";

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

            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((u: any) => (
                    <li key={u.id}>
                        <Link
                            href={`/dashboard/units/${u.id}`}
                            className="block w-full rounded-2xl border border-slate-200 bg-white p-5 text-left transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
                        >
                            <div className="mb-3 flex items-start justify-between">
                                <div
                                    className={`rounded-xl p-2.5 ${u.type === "UNIT" ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"}`}
                                    aria-hidden="true"
                                >
                                    {u.type === "UNIT" ? <Layers className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                                </div>
                                <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-600">
                                    {u.type}
                                </span>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">{u.name}</h3>
                            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                                <span>{u.isGenderCategory ? "Members (by gender)" : "This session"}</span>
                                <span className="text-sm font-bold text-slate-900">{u.memberCount}</span>
                            </div>
                        </Link>
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
