/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { Layers, Users, ArrowRight, X } from "lucide-react";
import { UnitManager } from "./unit-manager";
import { getUnitDetailsAction } from "../actions";

export function LeaderUnitView({ data, onSuccess }: any) {
    const [selectedUnit, setSelectedUnit] = useState<any>(null);
    const [modalMembers, setModalMembers] = useState<any[]>([]);

    const handleOpen = async (unit: any) => {
        setSelectedUnit(unit);
        // Fetch current members for this specific unit
        const members = await getUnitDetailsAction(unit.id);
        setModalMembers(members);
    };

    // If the leader only has 1 unit, you *could* auto-open it,
    // but a dashboard view is often better for clarity.

    return (
        <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {data.units.map((u: any) => (
                    <div
                        key={u.id}
                        onClick={() => handleOpen(u)}
                        className="group bg-white p-6 rounded-2xl border border-slate-200 hover:border-rcf-navy/30 hover:shadow-lg transition-all cursor-pointer relative overflow-hidden"
                    >
                        {/* Decorative Background Icon */}
                        <div className="absolute -right-4 -top-4 text-slate-50 group-hover:text-blue-50 transition-colors">
                            {u.type === "UNIT" ? (
                                <Layers className="h-24 w-24" />
                            ) : (
                                <Users className="h-24 w-24" />
                            )}
                        </div>

                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <div
                                    className={`p-2.5 rounded-xl ${u.type === "UNIT" ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"}`}
                                >
                                    {u.type === "UNIT" ? (
                                        <Layers className="h-6 w-6" />
                                    ) : (
                                        <Users className="h-6 w-6" />
                                    )}
                                </div>
                                <span className="text-[10px] font-bold bg-slate-100 px-2 py-1 rounded text-slate-600 uppercase tracking-wide">
                                    {u.type}
                                </span>
                            </div>

                            <h3 className="font-bold text-xl text-slate-900 mb-1">
                                {u.name}
                            </h3>
                            <p className="text-xs font-bold text-rcf-navy uppercase tracking-wide opacity-80">
                                Role: {u.leadershipRole}
                            </p>

                            <div className="mt-8 flex items-center text-sm font-bold text-slate-400 group-hover:text-rcf-navy transition-colors">
                                Manage Members{" "}
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Reuse the UnitManager Modal logic */}
            {selectedUnit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[600px] flex flex-col overflow-hidden animate-in zoom-in-95">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-slate-900">
                                    {selectedUnit.name} Management
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Authorized: {selectedUnit.leadershipRole}
                                </p>
                            </div>
                            <button onClick={() => setSelectedUnit(null)}>
                                <X className="h-6 w-6 text-slate-500" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <UnitManager
                                unit={selectedUnit}
                                initialMembers={modalMembers}
                                tenureId={data.tenureId}
                                onSuccess={() => {
                                    onSuccess();
                                    handleOpen(selectedUnit); // Refresh list
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
