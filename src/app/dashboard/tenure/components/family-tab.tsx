/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { nameFamilyAction } from "../actions";
import {
    Sparkles,
    Calendar,
    Users,
    GraduationCap,
    Plus,
    X,
    Search,
} from "lucide-react";
import FormInput from "@/components/ui/FormInput";

export function FamilyTab({ data, onSuccess }: any) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [search, setSearch] = useState("");

    // Families + Counts
    const families = data?.families || [];
    const activeSession = data?.activeTenure?.session;
    const currentSessionYear = activeSession
        ? parseInt(activeSession.split("/")[0])
        : new Date().getFullYear();

    const getLevelBadge = (entryYear: number) => {
        const level = (currentSessionYear - entryYear + 1) * 100;
        if (level < 100)
            return { text: "Aspirant", color: "bg-gray-100 text-gray-500" };
        if (level > 500)
            return { text: "Alumni", color: "bg-green-100 text-green-700" };
        return { text: `${level}L`, color: "bg-purple-50 text-purple-700" };
    };

    const filtered = families.filter(
        (f: any) =>
            (f.family_name || "")
                .toLowerCase()
                .includes(search.toLowerCase()) ||
            f.entry_year.toString().includes(search)
    );

    async function handleSubmit(formData: FormData) {
        const res = await nameFamilyAction(formData);
        if (res.success) {
            onSuccess();
            setIsModalOpen(false);
        } else alert(res.error);
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-9 pl-9 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-rcf-navy"
                    />
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:bg-purple-700"
                >
                    <Plus className="h-4 w-4" /> Christen New Generation
                </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((f: any) => {
                    const badge = getLevelBadge(f.entry_year);
                    return (
                        <div
                            key={f.id}
                            className="group bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2.5 rounded-xl bg-slate-50 text-slate-500 group-hover:bg-purple-50 group-hover:text-purple-600">
                                    <GraduationCap className="h-5 w-5" />
                                </div>
                                <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${badge.color}`}
                                >
                                    {badge.text}
                                </span>
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-bold text-slate-900 text-lg leading-tight">
                                    {f.family_name || (
                                        <span className="italic text-slate-400">
                                            Unnamed
                                        </span>
                                    )}
                                </h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    {f.entry_year} Entry Set
                                </p>
                            </div>
                            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-slate-600">
                                    <Users className="h-4 w-4" />
                                    <span className="text-xs font-medium">
                                        Population
                                    </span>
                                </div>
                                <span className="text-sm font-bold text-slate-900">
                                    {f.memberCount || 0}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-purple-600" />
                                <h3 className="font-bold text-slate-900">
                                    Naming Ceremony
                                </h3>
                            </div>
                            <button onClick={() => setIsModalOpen(false)}>
                                <X className="h-5 w-5 text-slate-500" />
                            </button>
                        </div>
                        <form action={handleSubmit} className="p-6 space-y-5">
                            <FormInput
                                label="Entry Year"
                                name="entryYear"
                                type="number"
                                placeholder="2024"
                                required
                                leftIcon={<Calendar className="h-4 w-4" />}
                            />
                            <FormInput
                                label="Family Name"
                                name="familyName"
                                required
                                placeholder="e.g. Peculiar"
                                leftIcon={<Sparkles className="h-4 w-4" />}
                            />
                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm"
                                >
                                    Cancel
                                </button>
                                <button className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-sm">
                                    Christen
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
