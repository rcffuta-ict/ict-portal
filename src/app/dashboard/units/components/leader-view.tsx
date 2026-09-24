"use client";

import { useState } from "react";
import { Layers, Users, ArrowRight, Cake, History } from "lucide-react";
import { UnitManager } from "./unit-manager";
import { UnitModal } from "./unit-modal";
import { UnitTabs, type UnitTab } from "./unit-tabs";
import { BirthdaysPanel } from "./birthdays-panel";
import { MembershipLog } from "./membership-log";

type TabType = "members" | "birthdays" | "log";

const TABS: UnitTab<TabType>[] = [
    { id: "members", label: "Members", icon: Users },
    { id: "birthdays", label: "Birthdays", icon: Cake },
    { id: "log", label: "Log", icon: History },
];

export interface LeaderUnit {
    id: string;
    slug: string;
    name: string;
    type: "UNIT" | "TEAM";
    leadershipRole: string;
}

/** The units and teams an Executive (lead or assistant) manages. */
export function LeaderUnitView({ units }: { units: LeaderUnit[] }) {
    const [selected, setSelected] = useState<LeaderUnit | null>(null);
    const [tab, setTab] = useState<TabType>("members");

    return (
        <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {units.map((u) => (
                    <li key={u.id}>
                        <button
                            type="button"
                            onClick={() => setSelected(u)}
                            className="group relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left transition-shadow hover:border-rcf-navy/30 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy sm:p-6"
                        >
                            <div className="absolute -right-4 -top-4 text-slate-50 transition-colors group-hover:text-blue-50" aria-hidden="true">
                                {u.type === "UNIT" ? <Layers className="h-24 w-24" /> : <Users className="h-24 w-24" />}
                            </div>

                            <div className="relative z-10">
                                <div className="mb-4 flex items-start justify-between">
                                    <div
                                        className={`rounded-xl p-2.5 ${u.type === "UNIT" ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"}`}
                                        aria-hidden="true"
                                    >
                                        {u.type === "UNIT" ? <Layers className="h-6 w-6" /> : <Users className="h-6 w-6" />}
                                    </div>
                                    <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                                        {u.type}
                                    </span>
                                </div>

                                <h3 className="mb-1 text-xl font-bold text-slate-900">{u.name}</h3>
                                <p className="text-xs font-bold uppercase tracking-wide text-rcf-navy opacity-80">
                                    {u.leadershipRole}
                                </p>

                                <span className="mt-6 flex items-center text-sm font-bold text-slate-400 transition-colors group-hover:text-rcf-navy">
                                    Manage members <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                                </span>
                            </div>
                        </button>
                    </li>
                ))}
            </ul>

            {selected && (
                <UnitModal
                    title={selected.name}
                    subtitle={`As ${selected.leadershipRole}`}
                    onClose={() => {
                        setSelected(null);
                        setTab("members");
                    }}
                >
                    <UnitTabs tabs={TABS} active={tab} onChange={setTab} />
                    {tab === "members" && <UnitManager unit={selected} />}
                    {tab === "birthdays" && <BirthdaysPanel unitId={selected.id} />}
                    {tab === "log" && <MembershipLog unitId={selected.id} />}
                </UnitModal>
            )}
        </>
    );
}
