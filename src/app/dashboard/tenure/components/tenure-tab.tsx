"use client";

import { createTenureAction, closeTenureAction } from "../actions";
import { Save, AlertCircle, Power } from "lucide-react";
import FormInput from "@/components/ui/FormInput";

export function TenureTab({ data, onSuccess }: any) {
    const active = data?.activeTenure;

    async function handleCreate(formData: FormData) {
        if (
            confirm(
                "Are you sure? This will archive any existing active tenure."
            )
        ) {
            const res = await createTenureAction(formData);
            if (res.success) onSuccess();
            else alert(res.error);
        }
    }

    async function handleClose() {
        if (
            confirm(
                "This will close the current session. All appointments will be archived."
            )
        ) {
            await closeTenureAction(active.id);
            onSuccess();
        }
    }

    return (
        <div className="grid gap-8 lg:grid-cols-2">
            {/* Active Tenure Card */}
            {active ? (
                <div className="bg-gradient-to-br from-rcf-navy to-[#312e81] rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>

                    <div className="relative z-10">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-pink-300 text-xs font-bold uppercase tracking-widest mb-2">
                                    Current Active Session
                                </p>
                                <h2 className="text-3xl font-serif font-bold">
                                    {active.name}
                                </h2>
                                <p className="text-lg opacity-80 mt-1">
                                    {active.session}
                                </p>
                            </div>
                            <div className="bg-green-500/20 text-green-300 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30 flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>{" "}
                                Active
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-white/10 flex gap-6">
                            <button
                                onClick={handleClose}
                                className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-200 px-4 py-2 rounded-lg text-sm font-bold transition-all border border-red-500/30"
                            >
                                <Power className="h-4 w-4" /> Close Tenure
                            </button>
                            {/* Add 'Update' button logic here if needed */}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-8 flex flex-col items-center justify-center text-center text-orange-800">
                    <AlertCircle className="h-10 w-10 mb-4 opacity-50" />
                    <h3 className="font-bold text-lg">No Active Tenure</h3>
                    <p className="text-sm opacity-80 max-w-xs">
                        The system is currently in archival mode. Initialize a
                        new session to begin appointments.
                    </p>
                </div>
            )}

            {/* Create / Overwrite Form */}
            <form
                action={handleCreate}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 h-fit"
            >
                <div>
                    <h3 className="font-bold text-slate-900">
                        Initialize New Tenure
                    </h3>
                    <p className="text-xs text-slate-500">
                        Start a new academic session.
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="space-y-1">
                        <FormInput
                            label="Tenure Name"
                            name="name"
                            required
                            placeholder="e.g. The Dominion Tenure"
                            className="input-field"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <FormInput
                                label="Session"
                                name="session"
                                required
                                placeholder="e.g. 2026/2027"
                                className="input-field"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">
                                Start Date
                            </label>
                            <FormInput
                                name="startDate"
                                type="date"
                                required
                                className="input-field"
                            />
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all flex justify-center gap-2"
                >
                    <Save className="h-4 w-4" /> Save & Activate
                </button>
            </form>
        </div>
    );
}
