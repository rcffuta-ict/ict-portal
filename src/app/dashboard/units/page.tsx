/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { getUnitModuleData } from "./actions";
import { Loader2, ShieldAlert, Layers, GraduationCap, Crown } from "lucide-react";
import { AdminUnitView } from "./components/admin-view";
import { LeaderUnitView } from "./components/leader-view";
import { LevelView } from "./components/level-view";
import { AppointPanel } from "./components/appoint-panel";

type Tab = "admin" | "units" | "levels";

export default function UnitsPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>("units");

    const load = async () => {
        setLoading(true);
        const res = await getUnitModuleData();
        setData(res);
        // Pick a sensible default tab based on what the user can access.
        if (res?.isAdmin) setTab("admin");
        else if (res?.managedUnits?.length) setTab("units");
        else if (res?.managedLevels?.length) setTab("levels");
        setLoading(false);
    };

    useEffect(() => {
        let active = true;
        (async () => {
            const res = await getUnitModuleData();
            if (!active) return;
            setData(res);
            if (res?.isAdmin) setTab("admin");
            else if (res?.managedUnits?.length) setTab("units");
            else if (res?.managedLevels?.length) setTab("levels");
            setLoading(false);
        })();
        return () => {
            active = false;
        };
    }, []);

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="animate-spin text-rcf-navy" />
            </div>
        );
    }

    if (!data?.authorized || data.role === "NONE") {
        return <AccessDenied />;
    }

    const hasUnits = data.managedUnits?.length > 0;
    const hasLevels = data.managedLevels?.length > 0;

    const tabs: { key: Tab; label: string; icon: any; show: boolean }[] = [
        { key: "admin", label: "Administration", icon: Crown, show: data.isAdmin },
        { key: "units", label: "My Units & Teams", icon: Layers, show: hasUnits },
        { key: "levels", label: "My Levels", icon: GraduationCap, show: hasLevels },
    ];
    const visibleTabs = tabs.filter((t) => t.show);

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex flex-col gap-1 border-b border-slate-200 pb-6">
                <h1 className="text-3xl font-bold text-rcf-navy">Workforce Management</h1>
                <p className="text-slate-500">
                    {data.isAdmin
                        ? "Oversee units, appoint leaders, and manage leadership roles."
                        : "Manage the members in your care."}
                </p>
            </div>

            {visibleTabs.length > 1 && (
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit overflow-x-auto max-w-full">
                    {visibleTabs.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                                tab === t.key ? "bg-white text-rcf-navy shadow-sm" : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            <t.icon className="h-4 w-4" />
                            {t.label}
                        </button>
                    ))}
                </div>
            )}

            {tab === "admin" && data.isAdmin && (
                <div className="space-y-10">
                    <AppointPanel onSuccess={load} />
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 mb-4">All Units & Teams</h2>
                        <AdminUnitView data={data} onSuccess={load} />
                    </div>
                </div>
            )}

            {tab === "units" && hasUnits && (
                <LeaderUnitView units={data.managedUnits} tenureId={data.tenureId} onSuccess={load} />
            )}

            {tab === "levels" && hasLevels && (
                <LevelView levels={data.managedLevels} onSuccess={load} />
            )}
        </div>
    );
}

function AccessDenied() {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
            <ShieldAlert className="h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-900">Access Restricted</h3>
            <p className="text-slate-500 max-w-sm mt-2">
                You must be an appointed unit, team, or level leader — or an administrator — to access this module.
            </p>
        </div>
    );
}
