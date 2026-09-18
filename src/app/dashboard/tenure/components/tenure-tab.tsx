/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import {
    createTenureAction,
    updateTenureAction,
} from "../actions";
import {
    Save,
    AlertCircle,
    Clock,
    Users,
    UsersRound,
    Mars,
    Venus,
    CalendarCheck,
    Edit3,
    X,
    ArrowRightLeft,
    Sparkles,
} from "lucide-react";
import Link from "next/link";
import FormInput from "@/components/ui/FormInput";

export function TenureTab({ data, onSuccess }: any) {
    const [isEditing, setIsEditing] = useState(false);
    const active = data?.activeTenure;
    const stats = data?.sessionStats;

    const daysActive = active
        ? Math.floor(
              (new Date().getTime() - new Date(active.start_date).getTime()) /
                  (1000 * 3600 * 24)
          )
        : 0;

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
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rcf-navy to-[#312e81] p-8 text-white shadow-2xl md:p-10">
                    <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl"></div>
                    <div className="relative z-10 grid gap-8 lg:grid-cols-2 lg:items-end">
                        <div className="space-y-3">
                            <div className="flex items-center gap-4">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-green-400/30 bg-green-500/20 px-3 py-1 text-xs font-bold text-green-300">
                                    <span className="h-2 w-2 animate-pulse rounded-full bg-green-400"></span>{" "}
                                    Active
                                </span>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center gap-1.5 text-xs font-medium text-blue-200 hover:text-white bg-white/10 px-3 py-1 rounded-full"
                                >
                                    <Edit3 className="h-3 w-3" /> Edit
                                </button>
                            </div>
                            <h2 className="font-serif text-4xl font-bold leading-tight md:text-5xl">
                                {active.name}
                            </h2>
                            <p className="text-xl font-light text-blue-200">
                                {active.session} Session
                            </p>
                            {active.theme && (
                                <p className="inline-flex items-center gap-2 rounded-full bg-yellow-400/15 px-3 py-1 text-sm font-medium text-yellow-200">
                                    <Sparkles className="h-4 w-4" /> Theme: {active.theme}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-col gap-4 lg:items-end">
                            <div className="flex items-center gap-4 rounded-xl bg-white/10 p-4 border border-white/10">
                                <Clock className="h-6 w-6 text-yellow-300" />
                                <div>
                                    <p className="text-xs font-bold uppercase text-blue-200">
                                        Time Elapsed
                                    </p>
                                    <p className="text-2xl font-bold leading-none">
                                        {daysActive}{" "}
                                        <span className="text-sm font-normal opacity-70">
                                            Days
                                        </span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
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
                    {/* Session statistics */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <MetricCard label="Total Members" value={stats?.totalMembers ?? 0} icon={Users} color="text-blue-600" bg="bg-blue-50" />
                        <MetricCard label="Workers" value={stats?.totalWorkers ?? 0} icon={UsersRound} color="text-emerald-600" bg="bg-emerald-50" />
                        <MetricCard label="Male" value={stats?.totalMale ?? 0} icon={Mars} color="text-sky-600" bg="bg-sky-50" />
                        <MetricCard label="Female" value={stats?.totalFemale ?? 0} icon={Venus} color="text-pink-600" bg="bg-pink-50" />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                        <MetricCard label="Units" value={stats?.totalUnits ?? 0} icon={Users} color="text-indigo-600" bg="bg-indigo-50" small />
                        <MetricCard label="Teams" value={stats?.totalTeams ?? 0} icon={Users} color="text-orange-600" bg="bg-orange-50" small />
                        <MetricCard label="Start Date" value={new Date(active.start_date).toLocaleDateString()} icon={CalendarCheck} color="text-slate-600" bg="bg-slate-100" isDate small />
                    </div>

                    {/* Handover / close */}
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className="rounded-full bg-amber-100 p-3 text-amber-700">
                                <ArrowRightLeft className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-amber-900">Handover & Close Tenure</h4>
                                <p className="text-sm text-amber-700/80">
                                    Archives this session and opens the next, appointing the incoming
                                    VP Admin and ICT Coordinator.
                                </p>
                            </div>
                        </div>
                        <Link
                            href="/dashboard/tenure/handover"
                            className="shrink-0 rounded-lg bg-amber-600 px-6 py-2.5 text-center text-sm font-bold text-white shadow-sm transition-colors hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
                        >
                            Begin Handover
                        </Link>
                    </div>
                </>
            ) : (
                <div className="mx-auto max-w-2xl">
                    <form
                        action={handleCreate}
                        className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-6"
                    >
                        <h3 className="text-lg font-bold text-slate-900">Configuration</h3>
                        <div className="space-y-4">
                            <FormInput label="Tenure Name" name="name" required placeholder="e.g. The Dominion Tenure" />
                            <FormInput label="Theme" name="theme" placeholder="e.g. Arise & Shine" />
                            <div className="grid grid-cols-2 gap-4">
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
        </div>
    );
}

function MetricCard({ label, value, icon: Icon, color, bg, isDate, small }: any) {
    return (
        <div className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className={`rounded-xl p-3 ${bg} ${color}`}>
                <Icon className="h-5 w-5" />
            </div>
            <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
                <p className={`mt-1 font-bold text-slate-900 ${isDate || small ? "text-lg" : "text-3xl"}`}>
                    {value}
                </p>
            </div>
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
                    <h3 className="font-bold text-slate-900">Edit Details</h3>
                    <button onClick={onClose}>
                        <X className="h-5 w-5 text-slate-500" />
                    </button>
                </div>
                <form action={handleUpdate} className="p-6 space-y-5">
                    <FormInput label="Name" name="name" defaultValue={tenure.name} required />
                    <FormInput label="Session" name="session" defaultValue={tenure.session} required />
                    <FormInput label="Theme" name="theme" defaultValue={tenure.theme || ""} placeholder="e.g. Arise & Shine" />
                    <button className="w-full py-2.5 rounded-xl bg-rcf-navy text-white font-bold text-sm">
                        Update
                    </button>
                </form>
            </div>
        </div>
    );
}
