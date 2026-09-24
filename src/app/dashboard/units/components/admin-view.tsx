/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { Search, Layers, Users, Crown, UserCog, Cake, History } from "lucide-react";
import { UnitManager } from "./unit-manager";
import { UnitPositionsManager } from "./unit-positions-manager";
import { UnitLeadershipCard } from "./unit-leadership-card";
import { UnitModal } from "./unit-modal";
import { UnitTabs, type UnitTab } from "./unit-tabs";
import { BirthdaysPanel } from "./birthdays-panel";
import { MembershipLog } from "./membership-log";

type TabType = "workers" | "birthdays" | "log" | "positions" | "leadership";

const TABS: UnitTab<TabType>[] = [
    { id: "workers", label: "Workers", icon: Users },
    { id: "birthdays", label: "Birthdays", icon: Cake },
    { id: "log", label: "Log", icon: History },
    { id: "positions", label: "Positions", icon: UserCog },
    { id: "leadership", label: "Leadership", icon: Crown },
];

/**
 * Every unit and team, for the admin read tier.
 *
 * `canWriteAll` is false for the President, who sees everything but changes nothing;
 * the roster then opens read-only. The server enforces it either way.
 */
export function AdminUnitView({
    data,
    onSuccess,
}: {
    data: { units: any[]; tenureId: string | null; canWriteAll: boolean };
    onSuccess: () => void;
}) {
    const [search, setSearch] = useState("");
    const [selectedUnit, setSelectedUnit] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<TabType>("workers");

    const filtered = data.units.filter((u: any) =>
        u.name.toLowerCase().includes(search.toLowerCase()),
    );

    const close = () => {
        setSelectedUnit(null);
        setActiveTab("workers");
    };

    return (
        <>
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
                            <button
                                type="button"
                                onClick={() => setSelectedUnit(u)}
                                className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy"
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
                            </button>
                        </li>
                    ))}
                    {filtered.length === 0 && (
                        <li className="col-span-full rounded-2xl border-2 border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
                            No unit or team matches &ldquo;{search}&rdquo;.
                        </li>
                    )}
                </ul>
            </div>

            {selectedUnit && (
                <UnitModal
                    title={selectedUnit.name}
                    subtitle={data.canWriteAll ? undefined : "Read-only"}
                    onClose={close}
                    wide
                >
                    <UnitTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

                    {activeTab === "workers" && (
                        <UnitManager
                            unit={selectedUnit}
                            readOnly={!data.canWriteAll}
                            onChanged={onSuccess}
                        />
                    )}

                    {activeTab === "birthdays" && <BirthdaysPanel unitId={selectedUnit.id} />}

                    {activeTab === "log" && <MembershipLog unitId={selectedUnit.id} />}

                    {activeTab === "positions" && (
                        <UnitPositionsManager
                            unit={selectedUnit}
                            tenureId={data.tenureId ?? ""}
                            onSuccess={onSuccess}
                        />
                    )}

                    {activeTab === "leadership" && (
                        <UnitLeadershipCard
                            unitId={selectedUnit.id}
                            unitName={selectedUnit.name}
                            unitType={selectedUnit.type}
                            tenureId={data.tenureId ?? ""}
                        />
                    )}
                </UnitModal>
            )}
        </>
    );
}
