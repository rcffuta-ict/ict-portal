"use client";

import { createUnitAction } from "../actions";
import { Plus, Layers, Users } from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import FormSelect from "@/components/ui/FormSelect";

export function StructureTab({ data, onSuccess }: any) {
    async function handleSubmit(formData: FormData) {
        const res = await createUnitAction(formData);
        if (res.success) {
            onSuccess();
            // Optional: Reset form here if needed via useRef
        } else {
            alert(res.error);
        }
    }

    return (
        <div className="grid gap-8 lg:grid-cols-3">
            {/* 1. Creation Form */}
            <div className="lg:col-span-1">
                <form
                    action={handleSubmit}
                    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 sticky top-6"
                >
                    <div>
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <Plus className="h-4 w-4 text-rcf-navy" />
                            Add Structure
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            Create a new container for workforce members.
                        </p>
                    </div>

                    <div className="space-y-1">
                        <FormInput
                            label="Unit / Team Name"
                            name="name"
                            required
                            placeholder="e.g. Protocol Unit"
                            className="w-full h-10 rounded-lg px-3 text-sm"
                        />
                    </div>

                    <div className="space-y-1">
                        <FormSelect name="type" className="w-full h-10 rounded-lg px-3 text-sm">
                            <option value="UNIT">Workforce Unit (Static)</option>
                            <option value="TEAM">Special Team (Dynamic)</option>
                        </FormSelect>
                        <p className="text-[10px] text-slate-400 leading-snug">
                            <strong>Units</strong> are permanent (e.g. Choir).{" "}
                            <strong>Teams</strong> are for specific tasks (e.g.
                            Dinner Committee).
                        </p>
                    </div>

                    <button className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all flex justify-center gap-2">
                        Create Structure
                    </button>
                </form>
            </div>

            {/* 2. Existing Units List */}
            <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <span className="font-bold text-slate-700 text-sm">
                            Existing Structure
                        </span>
                        <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">
                            {data?.units?.length || 0}
                        </span>
                    </div>

                    <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-100">
                        {data?.units?.length === 0 && (
                            <div className="p-8 text-center text-slate-400 text-sm">
                                No units created yet.
                            </div>
                        )}

                        {data?.units?.map((u: any) => (
                            <div
                                key={u.id}
                                className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`p-2 rounded-lg ${
                                            u.type === "UNIT"
                                                ? "bg-blue-50 text-blue-600"
                                                : "bg-orange-50 text-orange-600"
                                        }`}
                                    >
                                        {u.type === "UNIT" ? (
                                            <Layers className="h-4 w-4" />
                                        ) : (
                                            <Users className="h-4 w-4" />
                                        )}
                                    </div>
                                    <span className="font-medium text-slate-900">
                                        {u.name}
                                    </span>
                                </div>
                                <span
                                    className={`text-[10px] font-bold px-2 py-1 rounded border ${
                                        u.type === "UNIT"
                                            ? "bg-blue-50 border-blue-100 text-blue-700"
                                            : "bg-orange-50 border-orange-100 text-orange-700"
                                    }`}
                                >
                                    {u.type}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
