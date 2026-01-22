/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { getZoneModuleData } from "./actions";
import { Loader2, MapPin } from "lucide-react";
import { CoordinatorView } from "./components/coordinator-view";
import { PastorView } from "./components/pastor-view";
import { useProfileStore } from "@/lib/stores/profile.store";
import { useTenureStore } from "@/lib/stores/tenure.store";

export default function ZonesPage() {
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
        const res = await getZoneModuleData({
            email: profile.email || "",
            tenureId: tenureId,
            userId: profile.id,
        });
        setData(res);
        setLoading(false);
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!profile) {
                setLoading(false);
                throw new Error("Profile not loaded yet");
            }
            if (!tenureId) {
                setLoading(false);
                throw new Error("Tenure not loaded yet");
            }
            const res = await getZoneModuleData({
                email: profile.email || "",
                tenureId: tenureId,
                userId: profile.id,
            });
            setData(res);
            setLoading(false);
        };
        
        fetchData();
    }, []);

    if (loading)
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="animate-spin text-rcf-navy" />
            </div>
        );

    if (data.role === "NONE") {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <div className="bg-slate-100 p-4 rounded-full mb-4">
                    <MapPin className="h-10 w-10 text-slate-400" />
                </div>
                <h3 className="font-bold text-slate-800">Restricted Access</h3>
                <p className="text-slate-500">
                    You are not assigned to any zone leadership role.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col gap-1 border-b border-slate-200 pb-6">
                <h1 className="text-3xl font-bold text-rcf-navy">
                    Zone Management
                </h1>
                <p className="text-slate-500">
                    {data.role === "COORDINATOR"
                        ? "Oversee all residential zones and delegates."
                        : "Manage members in your assigned zone."}
                </p>
            </div>

            {data.role === "COORDINATOR" ? (
                <CoordinatorView data={data} onSuccess={load} />
            ) : (
                <PastorView data={data} />
            )}
        </div>
    );
}
