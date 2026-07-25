/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { Search, Layers, Users, X, Crown, UserCog } from "lucide-react";
import { UnitManager } from "./unit-manager";
import { UnitPositionsManager } from "./unit-positions-manager";
import { UnitLeadershipCard } from "./unit-leadership-card";
import { getUnitDetailsAction } from "../actions";

type TabType = "workers" | "positions" | "leadership";

export function AdminUnitView({ data, onSuccess }: any) {
    const [search, setSearch] = useState("");
    const [selectedUnit, setSelectedUnit] = useState<any>(null);
    const [modalMembers, setModalMembers] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>("workers");

    const filtered = data.units.filter((u: any) =>
        u.name.toLowerCase().includes(search.toLowerCase()),
    );

    const handleOpen = async (unit: any) => {
        setSelectedUnit(unit);
        // Fetch fresh members list for this unit
        const members = await getUnitDetailsAction(unit.id);
        setModalMembers(members);
    };

    return (
        <>
            <div className="space-y-6">
                {/* Toolbar */}
                <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex">
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search units..."
                            className="w-full pl-9 h-9 rounded-xl bg-slate-50 border-none text-sm focus:ring-2 focus:ring-rcf-navy outline-none"
                        />
                    </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.map((u: any) => (
                        <div
                            key={u.id}
                            onClick={() => handleOpen(u)}
                            className="group bg-white p-6 rounded-2xl border border-slate-200 hover:shadow-md cursor-pointer transition-all hover:-translate-y-1"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div
                                    className={`p-2.5 rounded-xl ${u.type === "UNIT" ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"}`}
                                >
                                    {u.type === "UNIT" ? (
                                        <Layers className="h-5 w-5" />
                                    ) : (
                                        <Users className="h-5 w-5" />
                                    )}
                                </div>
                                <span className="text-[10px] font-bold bg-slate-100 px-2 py-1 rounded text-slate-600 uppercase">
                                    {u.type}
                                </span>
                            </div>
                            <h3 className="font-bold text-lg text-slate-900">
                                {u.name}
                            </h3>
                            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
                                <span>Total Workforce</span>
                                <span className="font-bold text-slate-900 text-sm">
                                    {u.memberCount}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal for Admin to Manage Unit */}
            {selectedUnit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-150 flex flex-col overflow-hidden">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-slate-900">
                                    {selectedUnit.name} Management
                                </h3>
                                <button onClick={() => {
                                    setSelectedUnit(null);
                                    setActiveTab("workers");
                                }}>
                                    <X className="h-6 w-6 text-slate-500" />
                                </button>
                            </div>
                            
                            {/* Tabs */}
                            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setActiveTab("workers")}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                        activeTab === "workers"
                                            ? "bg-white text-rcf-navy shadow-sm"
                                            : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                    <Users className="h-4 w-4" />
                                    Workers
                                </button>
                                <button
                                    onClick={() => setActiveTab("positions")}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                        activeTab === "positions"
                                            ? "bg-white text-rcf-navy shadow-sm"
                                            : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                    <UserCog className="h-4 w-4" />
                                    Positions
                                </button>
                                <button
                                    onClick={() => setActiveTab("leadership")}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                        activeTab === "leadership"
                                            ? "bg-white text-rcf-navy shadow-sm"
                                            : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                    <Crown className="h-4 w-4" />
                                    Leadership
                                </button>
                            </div>
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {activeTab === "workers" && (
                                <UnitManager
                                    unit={selectedUnit}
                                    initialMembers={modalMembers}
                                    tenureId={data.tenureId}
                                    onSuccess={() => {
                                        onSuccess(); // Refresh Admin Grid counts
                                        handleOpen(selectedUnit); // Refresh Modal list
                                    }}
                                />
                            )}
                            
                            {activeTab === "positions" && (
                                <UnitPositionsManager
                                    unit={selectedUnit}
                                    tenureId={data.tenureId}
                                    onSuccess={onSuccess}
                                />
                            )}
                            
                            {activeTab === "leadership" && (
                                <UnitLeadershipCard
                                    unitId={selectedUnit.id}
                                    unitName={selectedUnit.name}
                                    unitType={selectedUnit.type}
                                    tenureId={data.tenureId}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
