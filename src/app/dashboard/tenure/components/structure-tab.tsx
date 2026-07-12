/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { createUnitAction } from "../actions";
import { Plus, Layers, Users, Search, X, AlertCircle, Mars, Venus } from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import FormSelect from "@/components/ui/FormSelect";

// --- VISIBILITY CARD (non-interactive) ---
function StructureCard({ item }: { item: any }) {
    const isUnit = item.type === "UNIT";
    const isLoose = isUnit && item.is_workforce === false; // "loose unit" (e.g. Sisters Unit)
    const mainLeader = item.leaders?.[0];
    const s = item.stats || { total: item.memberCount || 0, male: 0, female: 0 };

    const theme = isUnit
        ? { icon: Layers, bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100" }
        : { icon: Users, bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-100" };

    return (
        <div className="flex flex-col justify-between bg-white rounded-2xl border border-slate-200 p-5 shadow-sm h-full">
            <div>
                <div className="flex justify-between items-start mb-3">
                    <div className={`p-2.5 rounded-xl border ${theme.bg} ${theme.text} ${theme.border}`}>
                        <theme.icon className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${theme.bg} ${theme.text} ${theme.border}`}>
                            {item.type}
                        </span>
                        {isLoose && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider bg-slate-100 text-slate-500 border-slate-200">
                                Loose · non-workforce
                            </span>
                        )}
                    </div>
                </div>

                <h3 className="font-bold text-slate-900 text-lg leading-tight mb-1 truncate">
                    {item.name}
                </h3>
            </div>

            {/* Leadership */}
            <div className="mt-4 mb-4">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-2">Leader</p>
                {mainLeader ? (
                    <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <div className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm overflow-hidden">
                            {mainLeader.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={mainLeader.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                                <span>{mainLeader.first_name?.[0]}{mainLeader.last_name?.[0]}</span>
                            )}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-xs font-bold text-slate-900 truncate">
                                {mainLeader.first_name} {mainLeader.last_name}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">{mainLeader.role || "Coordinator"}</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-xs font-bold">No leader assigned</span>
                    </div>
                )}
            </div>

            {/* Gender stats */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-1.5 text-sky-600 font-medium">
                    <Mars className="h-4 w-4" /> {s.male}
                </span>
                <span className="inline-flex items-center gap-1.5 text-pink-600 font-medium">
                    <Venus className="h-4 w-4" /> {s.female}
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-900 font-bold">
                    <Users className="h-4 w-4 text-slate-400" /> {s.total}
                </span>
            </div>
        </div>
    );
}

// --- MAIN COMPONENT ---
export function StructureTab({ data, onSuccess }: any) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("ALL");

    const items = data?.units || [];

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
                                    filter === f ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"
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
                    <StructureCard key={item.id} item={item} />
                ))}

                {filtered.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">
                        <Layers className="h-10 w-10 mb-2 opacity-50" />
                        <p>No units or teams found.</p>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-900">Create Structure</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                                <X className="h-5 w-5 text-slate-500" />
                            </button>
                        </div>
                        <form action={handleCreate} className="p-6 space-y-5">
                            <FormInput label="Unit / Team Name" name="name" required placeholder="e.g. Protocol" />
                            <div className="space-y-1">
                                <FormSelect label="Type" name="type">
                                    <option value="UNIT">Workforce Unit</option>
                                    <option value="TEAM">Special Team</option>
                                </FormSelect>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Units are permanent (e.g. Choir). Teams are dynamic/task-force.
                                </p>
                            </div>
                            <label className="flex items-start gap-2 text-sm text-slate-600">
                                <input type="checkbox" name="isWorkforce" value="false" className="mt-0.5" />
                                <span>
                                    Loose unit — members do <b>not</b> count as workforce (e.g. Sisters
                                    Unit). Only applies to Units.
                                </span>
                            </label>
                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">
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
        </div>
    );
}
