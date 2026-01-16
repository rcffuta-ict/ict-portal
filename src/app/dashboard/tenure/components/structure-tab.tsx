/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { createUnitAction } from "../actions";
import {
    Plus,
    Layers,
    Users,
    Search,
    X,
    // User,
    AlertCircle,
    // UserCheck,
} from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import FormSelect from "@/components/ui/FormSelect";
import { ManageUnitModal } from "./manage-unit-modal";

// --- ENHANCED CARD COMPONENT ---
function StructureCard({ item, onClick }: { item: any; onClick: () => void }) {
    console.debug(item);
    const isUnit = item.type === "UNIT";
    const leaderCount = item.leaders?.length || 0;
    const mainLeader = item.leaders?.[0]; // Assuming first is the head/coordinator

    // Theme Config
    const theme = isUnit
        ? {
              icon: Layers,
              bg: "bg-blue-50",
              text: "text-blue-600",
              border: "border-blue-100",
          }
        : {
              icon: Users,
              bg: "bg-orange-50",
              text: "text-orange-600",
              border: "border-orange-100",
          };

    return (
        <div
            onClick={onClick}
            className="group relative flex flex-col justify-between bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer h-full"
        >
            {/* 1. Header: Icon & Type */}
            <div>
                <div className="flex justify-between items-start mb-3">
                    <div
                        className={`p-2.5 rounded-xl border ${theme.bg} ${theme.text} ${theme.border}`}
                    >
                        <theme.icon className="h-5 w-5" />
                    </div>
                    <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${theme.bg} ${theme.text} ${theme.border}`}
                    >
                        {item.type}
                    </span>
                </div>

                <h3 className="font-bold text-slate-900 text-lg leading-tight mb-1 truncate">
                    {item.name}
                </h3>
            </div>

            {/* 2. Middle: Leadership Status */}
            <div className="mt-4 mb-4">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-2">
                    Leadership
                </p>

                {/* CASE A: No Leaders */}
                {!item.leaders || item.leaders.length === 0 ? (
                    <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-xs font-bold">
                            No Admin Assigned
                        </span>
                    </div>
                ) : item.leaders.length === 1 ? (
                    // CASE B: Single Leader (Show Details)
                    <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <div className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm overflow-hidden">
                            {item.leaders[0].avatar_url ? (
                                <img
                                    src={item.leaders[0].avatar_url}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <span>
                                    {item.leaders[0].first_name[0]}
                                    {item.leaders[0].last_name[0]}
                                </span>
                            )}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-xs font-bold text-slate-900 truncate">
                                {item.leaders[0].first_name}{" "}
                                {item.leaders[0].last_name}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                                {item.leaders[0].role || "Coordinator"}
                            </p>
                        </div>
                    </div>
                ) : (
                    // CASE C: Multiple Leaders
                    <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <div className="flex -space-x-2 pl-1">
                            {item.leaders
                                .slice(0, 3)
                                .map((l: any, i: number) => (
                                    <div
                                        key={i}
                                        className="h-7 w-7 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500 overflow-hidden"
                                    >
                                        {l.avatar_url ? (
                                            <img
                                                src={l.avatar_url}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            l.first_name[0]
                                        )}
                                    </div>
                                ))}
                        </div>
                        <span className="text-xs font-bold text-slate-600 pr-2">
                            {item.leaders.length} Leaders
                        </span>
                    </div>
                )}
            </div>

            {/* 3. Footer: Member Count */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Workforce Size</span>
                <div className="flex items-center gap-1.5 text-slate-900 font-bold text-sm">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    {item.memberCount}
                </div>
            </div>
        </div>
    );
}

// --- MAIN COMPONENT ---
export function StructureTab({ data, onSuccess }: any) {
    const [selectedUnit, setSelectedUnit] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("ALL");

    console.debug("Data",data)

    const items = data?.units || []; // Assuming units and teams are both in this array from server

    const filtered = items.filter(
        (i: any) =>
            i.name.toLowerCase().includes(search.toLowerCase()) &&
            (filter === "ALL" || i.type === filter)
    );

    async function handleCreate(formData: FormData) {
        const res = await createUnitAction(formData);
        if (res.success) {
            onSuccess();
            setIsModalOpen(false);
        } else alert(res.error);
    }

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full h-9 pl-9 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-rcf-navy transition-all"
                        />
                    </div>
                    <div className="hidden lg:flex bg-slate-100 p-1 rounded-lg">
                        {["ALL", "UNIT", "TEAM"].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                                    filter === f
                                        ? "bg-white shadow text-slate-900"
                                        : "text-slate-500 hover:text-slate-700"
                                }`}
                            >
                                {f === "ALL" ? "All" : f + "s"}
                            </button>
                        ))}
                    </div>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-rcf-navy text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:bg-opacity-90 active:scale-95 transition-all w-full md:w-auto justify-center"
                >
                    <Plus className="h-4 w-4" /> Add New
                </button>
            </div>

            {/* Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((item: any) => (
                    <StructureCard
                        key={item.id}
                        item={item}
                        onClick={() => setSelectedUnit(item)}
                    />
                ))}

                {filtered.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">
                        <Layers className="h-10 w-10 mb-2 opacity-50" />
                        <p>No structures found matching your filters.</p>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-900">
                                Create Structure
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                            >
                                <X className="h-5 w-5 text-slate-500" />
                            </button>
                        </div>
                        <form action={handleCreate} className="p-6 space-y-5">
                            <div className="space-y-1">
                                <FormInput
                                    label="Unit / Team Name"
                                    name="name"
                                    required
                                    placeholder="e.g. Protocol"
                                />
                            </div>
                            <div className="space-y-1">
                                <FormSelect label="Type" name="type">
                                    <option value="UNIT">Workforce Unit</option>
                                    <option value="TEAM">Special Team</option>
                                </FormSelect>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Units are permanent (e.g. Choir). Teams are
                                    dynamic/task-force (e.g. Welfare Team).
                                </p>
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button className="flex-1 py-2.5 bg-rcf-navy text-white rounded-xl text-sm font-bold hover:bg-opacity-90">
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Manage Modal */}
            {selectedUnit && (
                <ManageUnitModal
                    unit={selectedUnit}
                    positions={data.positions}
                    onClose={() => setSelectedUnit(null)}
                />
            )}
        </div>
    );
}
