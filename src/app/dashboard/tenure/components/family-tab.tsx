"use client";

import { nameFamilyAction } from "../actions";
import { Sparkles, Calendar, Users } from "lucide-react";
import FormInput from "@/components/ui/FormInput";

export function FamilyTab({ data, onSuccess }: any) {
    async function handleSubmit(formData: FormData) {
        const res = await nameFamilyAction(formData);
        if (res.success) {
            onSuccess();
        } else {
            alert(res.error);
        }
    }

    return (
        <div className="grid gap-8 lg:grid-cols-2">
            {/* 1. Naming Form */}
            <form
                action={handleSubmit}
                className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6 h-fit"
            >
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
                        <Sparkles className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">
                            Naming Ceremony
                        </h3>
                        <p className="text-sm text-slate-500 leading-snug">
                            Assign a spiritual name to a specific academic set.
                            This name stays with them from 100L to 500L.
                        </p>
                    </div>
                </div>

                <div className="space-y-4 pt-2">
                    <div className="space-y-1">
                        <FormInput
                            label={
                                <span>
                                    Entry Year (Set)
                                </span>
                            }
                            name="entryYear"
                            type="number"
                            placeholder="2024"
                            min={2010}
                            max={2030}
                            required
                            className="w-full h-10 rounded-lg pl-9 pr-3 text-sm"
                        />
                        <p className="text-[10px] text-slate-400">
                            The year they gained admission (e.g. 2021).
                        </p>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">
                            Family Name
                        </label>
                        <FormInput
                            name="familyName"
                            required
                            placeholder="e.g. Peculiar Generation"
                            className="w-full h-10 rounded-lg px-3 text-sm"
                        />
                    </div>
                </div>

                <button className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-purple-700 transition-all shadow-lg shadow-purple-200">
                    Christen Family
                </button>
            </form>

            {/* 2. Existing Families List */}
            <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                    Registered Generations
                </h4>

                {data?.families?.length === 0 && (
                    <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
                        No families named yet.
                    </div>
                )}

                {data?.families?.map((f: any) => (
                    <div
                        key={f.id}
                        className="bg-white p-5 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow"
                    >
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                                {f.entry_year} Set
                            </span>
                            <span className="text-lg font-bold text-rcf-navy">
                                {f.family_name || "Unnamed"}
                            </span>
                        </div>

                        {/* Logic to calculate current level roughly based on active tenure session could go here visually */}
                        <div className="h-8 w-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                            <Users className="h-4 w-4" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
