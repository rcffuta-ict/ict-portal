/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import {
    createTenureAction,
    updateTenureAction,
} from "../actions";
import { Save, AlertCircle, X, ArrowRightLeft } from "lucide-react";
import Link from "next/link";
import FormInput from "@/components/ui/FormInput";
import { TenureHero } from "./tenure-hero";
import { CoronationForm } from "./coronation-form";
import { SessionInsight } from "./session-insight";

export function TenureTab({ data, onSuccess, onNavigate }: any) {
    const [isEditing, setIsEditing] = useState(false);
    const [isCoronating, setIsCoronating] = useState(false);
    const active = data?.activeTenure;

    async function handleCreate(formData: FormData) {
        if (confirm("Create new tenure? This will archive any active tenure.")) {
            const res = await createTenureAction(formData);
            if (res.success) onSuccess();
            else alert(res.error);
        }
    }

    return (
        <div className="space-y-8">
            {active ? (
                <TenureHero
                    tenure={active}
                    canWrite={!!data?.canWriteTenure}
                    onEditSession={() => setIsEditing(true)}
                    onCoronate={() => setIsCoronating(true)}
                />
            ) : (
                <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center">
                    <AlertCircle className="h-10 w-10 mb-4 text-orange-500 opacity-50" />
                    <h3 className="text-xl font-bold text-slate-900">No Active Tenure</h3>
                    <p className="max-w-md text-slate-500 mt-2">
                        The system is archived. Initialize a new session to begin.
                    </p>
                </div>
            )}

            {active ? (
                <>
                    <SessionInsight refreshToken={data} onNavigate={onNavigate} />

                    {/* Handover / close — only for those who can run one. The server refuses
                        everyone else anyway; offering the button just led the President
                        to a "Restricted" page. */}
                    {data?.canHandover && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                            <div className="flex items-center gap-4">
                                <div className="rounded-full bg-amber-100 p-3 text-amber-700">
                                    <ArrowRightLeft className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-amber-900">Handover & Close Tenure</h4>
                                    <p className="text-sm text-amber-700/80">
                                        Archives this session and opens the next. Every handover is
                                        recorded, so you can pause and resume — and successors can
                                        see what was done.
                                    </p>
                                </div>
                            </div>
                            <Link
                                href="/dashboard/tenure/handover"
                                className="shrink-0 rounded-lg bg-amber-600 px-6 py-2.5 text-center text-sm font-bold text-white shadow-sm transition-colors hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
                            >
                                Handing Over
                            </Link>
                        </div>
                    )}
                </>
            ) : (
                <div className="mx-auto max-w-2xl">
                    <form
                        action={handleCreate}
                        className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-6"
                    >
                        <h3 className="text-lg font-bold text-slate-900">Configuration</h3>
                        <div className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormInput label="Session" name="session" required placeholder="e.g. 2026/2027" />
                                <FormInput label="Start Date" name="startDate" type="date" required />
                            </div>
                        </div>
                        <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-rcf-navy py-3.5 text-sm font-bold text-white shadow-lg hover:bg-opacity-90">
                            <Save className="h-4 w-4" /> Save & Activate
                        </button>
                    </form>
                </div>
            )}

            {isEditing && active && (
                <EditTenureModal tenure={active} onClose={() => setIsEditing(false)} onSuccess={onSuccess} />
            )}

            {isCoronating && active && (
                <CoronationForm tenure={active} onClose={() => setIsCoronating(false)} onSaved={onSuccess} />
            )}
        </div>
    );
}

function EditTenureModal({ tenure, onClose, onSuccess }: any) {
    async function handleUpdate(formData: FormData) {
        formData.append("id", tenure.id);
        const res = await updateTenureAction(formData);
        if (res.success) {
            onSuccess();
            onClose();
        } else alert(res.error);
    }
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900">Edit session</h3>
                    <button onClick={onClose}>
                        <X className="h-5 w-5 text-slate-500" />
                    </button>
                </div>
                <form action={handleUpdate} className="p-6 space-y-5">
                    <FormInput label="Session" name="session" defaultValue={tenure.session} required />
                    <p className="text-xs leading-relaxed text-slate-500">
                        The theme, its text and the coronation date are recorded with
                        &ldquo;Record coronation&rdquo; on the banner.
                    </p>
                    <button className="w-full py-2.5 rounded-xl bg-rcf-navy text-white font-bold text-sm">
                        Update
                    </button>
                </form>
            </div>
        </div>
    );
}
