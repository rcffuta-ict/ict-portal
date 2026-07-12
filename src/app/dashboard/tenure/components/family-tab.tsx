/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { createGenerationAction, setLevelOverrideAction } from "../actions";
import {
    Sparkles,
    Calendar,
    Users,
    GraduationCap,
    Plus,
    X,
    Search,
    Mars,
    Venus,
    Lock,
    Loader2,
} from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import { computeLevel, LEVELS } from "@/lib/levels";

export function FamilyTab({ data, onSuccess }: any) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [search, setSearch] = useState("");

    const families = data?.families || [];
    const session = data?.activeTenure?.session ?? null;

    /** Effective level = manual override, else computed from entry year + session. */
    function effectiveLevel(f: any): string | null {
        return f.level_override || computeLevel(f.entry_year, f.is_foundation, session);
    }

    const filtered = families.filter(
        (f: any) =>
            (f.family_name || "").toLowerCase().includes(search.toLowerCase()) ||
            f.entry_year.toString().includes(search)
    );

    async function handleCreate(formData: FormData) {
        const res = await createGenerationAction(formData);
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
                    <Plus className="h-4 w-4" /> Add Generation
                </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((f: any) => (
                    <GenerationCard
                        key={f.id}
                        f={f}
                        level={effectiveLevel(f)}
                        onSuccess={onSuccess}
                    />
                ))}

                {filtered.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">
                        <GraduationCap className="h-10 w-10 mb-2 opacity-50" />
                        <p>No generations yet.</p>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-purple-600" />
                                <h3 className="font-bold text-slate-900">New Generation</h3>
                            </div>
                            <button onClick={() => setIsModalOpen(false)}>
                                <X className="h-5 w-5 text-slate-500" />
                            </button>
                        </div>
                        <form action={handleCreate} className="p-6 space-y-5">
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
                                placeholder="e.g. Peculiar"
                                leftIcon={<Sparkles className="h-4 w-4" />}
                            />
                            <label className="flex items-start gap-2 text-sm text-slate-600">
                                <input type="checkbox" name="isFoundation" value="true" className="mt-0.5" />
                                <span>
                                    Foundation set (PDS/UABS) — always labelled PDS/UABS, outside the
                                    100–500 progression.
                                </span>
                            </label>
                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm"
                                >
                                    Cancel
                                </button>
                                <button className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-sm">
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function GenerationCard({ f, level, onSuccess }: any) {
    const [saving, setSaving] = useState(false);
    const s = f.stats || { total: f.memberCount || 0, male: 0, female: 0 };
    const isOverridden = !!f.level_override;

    async function onLevelChange(value: string) {
        // "" => clear override (revert to computed); "AUTO" sentinel also clears.
        const next = value === "AUTO" ? null : value;
        setSaving(true);
        const res = await setLevelOverrideAction(f.id, next);
        setSaving(false);
        if (res.success) onSuccess();
        else alert(res.error);
    }

    return (
        <div className="group bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex justify-between items-start mb-4">
                <div className="p-2.5 rounded-xl bg-slate-50 text-slate-500 group-hover:bg-purple-50 group-hover:text-purple-600">
                    <GraduationCap className="h-5 w-5" />
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider bg-purple-50 text-purple-700 border-purple-100">
                    {isOverridden && <Lock className="h-2.5 w-2.5" />}
                    {level || "—"}
                </span>
            </div>

            <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-lg leading-tight">
                    {f.family_name || <span className="italic text-slate-400">Unnamed</span>}
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {f.entry_year} Entry Set{f.is_foundation ? " · Foundation" : ""}
                </p>
            </div>

            {/* Gender stats */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-sm">
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

            {/* Level override */}
            <div className="mt-4">
                <label className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                    Level
                    {saving && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
                </label>
                <select
                    disabled={saving || f.is_foundation}
                    value={f.level_override || "AUTO"}
                    onChange={(e) => onLevelChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-rcf-navy focus:outline-none disabled:opacity-60"
                >
                    <option value="AUTO">Auto ({level || "—"})</option>
                    {LEVELS.map((l) => (
                        <option key={l} value={l}>
                            {l} (override)
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
