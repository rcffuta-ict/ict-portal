/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { createUnitAction } from "../actions";
import {
    Plus,
    Layers,
    Users,
    Search,
    MoreHorizontal,
    User,
    X,
} from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import FormSelect from "@/components/ui/FormSelect";
import { ManageUnitModal } from "./manage-unit-modal"; // Need this file

export function StructureTab({ data, onSuccess }: any) {
    const [selectedUnit, setSelectedUnit] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("ALL");

    // We only show UNITS and TEAMS here (Levels are in FamilyTab)
    const items = data.units;
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
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full h-9 pl-9 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-rcf-navy"
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
                                        : "text-slate-500"
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-rcf-navy text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:bg-opacity-90"
                >
                    <Plus className="h-4 w-4" /> Add New
                </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((item: any) => (
                    <div
                        key={item.id}
                        onClick={() => setSelectedUnit(item)}
                        className="group bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div
                                className={`p-2.5 rounded-xl ${
                                    item.type === "UNIT"
                                        ? "bg-blue-50 text-blue-600"
                                        : "bg-orange-50 text-orange-600"
                                }`}
                            >
                                {item.type === "UNIT" ? (
                                    <Layers className="h-5 w-5" />
                                ) : (
                                    <Users className="h-5 w-5" />
                                )}
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase">
                                {item.type}
                            </span>
                        </div>
                        <h3 className="font-bold text-slate-900 text-lg mb-1 truncate">
                            {item.name}
                        </h3>
                        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex -space-x-2">
                                {item.leaders
                                    ?.slice(0, 3)
                                    .map((l: any, i: number) => (
                                        <div
                                            key={i}
                                            className="h-8 w-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center font-bold text-[10px] text-slate-500"
                                        >
                                            {l.first_name[0]}
                                        </div>
                                    ))}
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-slate-400 uppercase font-bold">
                                    Members
                                </p>
                                <p className="text-sm font-bold text-slate-700">
                                    {item.memberCount}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-900">
                                Create Structure
                            </h3>
                            <button onClick={() => setIsModalOpen(false)}>
                                <X className="h-5 w-5 text-slate-500" />
                            </button>
                        </div>
                        <form action={handleCreate} className="p-6 space-y-5">
                            <FormInput
                                label="Name"
                                name="name"
                                required
                                placeholder="e.g. Protocol"
                            />
                            <FormSelect label="Type" name="type">
                                <option value="UNIT">Workforce Unit</option>
                                <option value="TEAM">Special Team</option>
                            </FormSelect>
                            <button className="w-full py-2.5 rounded-xl bg-rcf-navy text-white font-bold text-sm">
                                Create
                            </button>
                        </form>
                    </div>
                </div>
            )}

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
