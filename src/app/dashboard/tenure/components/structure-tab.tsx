/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { UnitCard, UNIT_CARD_GRID } from "@/components/dashboard/unit-card";
import { createUnitAction } from "../actions";
import { Plus, Search, X, Layers } from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import FormSelect from "@/components/ui/FormSelect";

function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

// --- MAIN COMPONENT ---
export function StructureTab({ data, onSuccess }: any) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("ALL");
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [slugTouched, setSlugTouched] = useState(false);

    const items = data?.units || [];

    function openModal() {
        setName("");
        setSlug("");
        setSlugTouched(false);
        setIsModalOpen(true);
    }

    function onNameChange(value: string) {
        setName(value);
        if (!slugTouched) setSlug(slugify(value));
    }

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
                    onClick={openModal}
                    className="flex items-center gap-2 bg-rcf-navy text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:bg-opacity-90 active:scale-95 transition-all w-full md:w-auto justify-center"
                >
                    <Plus className="h-4 w-4" /> Add New
                </button>
            </div>

            {/* Grid */}
            <div className={UNIT_CARD_GRID}>
                {filtered.map((item: any) => (
                    <UnitCard key={item.id} unit={item} />
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
                            <FormInput
                                label="Unit / Team Name"
                                name="name"
                                required
                                placeholder="e.g. Protocol"
                                value={name}
                                onChange={(e) => onNameChange(e.target.value)}
                            />
                            <div className="space-y-1">
                                <FormInput
                                    label="Slug (permanent)"
                                    name="slug"
                                    value={slug}
                                    onChange={(e) => {
                                        setSlugTouched(true);
                                        setSlug(slugify(e.target.value));
                                    }}
                                    placeholder="e.g. protocol"
                                />
                                <p className="text-[10px] text-slate-400">
                                    Auto-filled from the name. Used to scope Exco access (<span className="font-mono">Exco:{slug || "slug"}</span>); can&apos;t change once created.
                                </p>
                            </div>
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
