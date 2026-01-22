/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { getUnitModuleData } from "./actions";
import { Loader2, ShieldAlert } from "lucide-react";
import { AdminUnitView } from "./components/admin-view";
import { UnitManager } from "./components/unit-manager";
import { useProfileStore } from "@/lib/stores/profile.store";
import { useTenureStore } from "@/lib/stores/tenure.store";
import { LeaderUnitView } from "./components/leader-view";

export default function UnitsPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const profile = useProfileStore((state) => state.user?.profile);
    const tenureId = useTenureStore((state) => state.activeTenure?.id);

    const load = async () => {
        if (!profile) {
            throw new Error("Profile not loaded yet");
        }
        if (!tenureId) {
            throw new Error("Tenure not loaded yet");
        }
        setLoading(true);
        const res = await getUnitModuleData({
            email: profile.email || "",
            tenureId: tenureId,
            userId: profile.id,
        });
        setData(res);
        setLoading(false);
    };

    useEffect(() => {
        const loadData = async () => {
            if (!profile) {
                throw new Error("Profile not loaded yet");
            }
            if (!tenureId) {
                throw new Error("Tenure not loaded yet");
            }
            setLoading(true);
            const res = await getUnitModuleData({
                email: profile.email || "",
                tenureId: tenureId,
                userId: profile.id,
            });
            setData(res);
            setLoading(false);
        };

        loadData();
    }, [profile, tenureId]);

    if (loading)
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="animate-spin text-rcf-navy" />
            </div>
        );

    if (data?.role === "NONE" || !data?.authorized) {
        return <AccessDenied />;
    }

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex flex-col gap-1 border-b border-slate-200 pb-6">
                <h1 className="text-3xl font-bold text-rcf-navy">
                    Workforce Management
                </h1>
                <p className="text-slate-500">
                    {data.role === "ADMIN"
                        ? "Oversee all units and workforce members."
                        : `Manage the ${data.unit?.name} workforce.`}
                </p>
            </div>

            {/* View Switching */}
            {data.role === "ADMIN" ? (
                <AdminUnitView data={data} onSuccess={load} />
            ) : (
                // Reusable Manager Component used by Leaders directly
                <LeaderUnitView
                    unit={data.unit}
                    initialMembers={data.members}
                    tenureId={data.tenureId}
                    onSuccess={load} // Refresh logic
                />
            )}
        </div>
    );
}

function AccessDenied() {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
            <ShieldAlert className="h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-900">
                Access Restricted
            </h3>
            <p className="text-slate-500 max-w-sm mt-2">
                You must be an appointed Unit Coordinator or Administrator to
                access this module.
            </p>
        </div>
    );
}