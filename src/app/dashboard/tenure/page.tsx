/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { getAdminData } from "./actions";
import {
    CalendarDays,
    Layers,
    Crown,
    Users,
    ShieldAlert,
    ArrowLeftRight,
    Network,
} from "lucide-react";
import { TenureTab } from "./components/tenure-tab";
import { StructureTab } from "./components/structure-tab";
import { CabinetTab } from "./components/cabinet-tab";
import { FamilyTab } from "./components/family-tab";
import { TransfersTab } from "./components/transfers-tab";
import { CataloguePanel } from "./components/catalogue-panel";
import { CompactPreloader } from "@/components/ui/preloader";

/**
 * Executive Console — tenure, structure, leadership, generations, transfers.
 *
 * Access is gated server-side by the `tenure` module's access config (see
 * getAdminData → requireModuleRead). The old ADMIN_EMAILS environment whitelist is
 * long gone; roles come from leadership positions and their privilege tags.
 */
export default function TenureDashboard() {
    const [activeTab, setActiveTab] = useState("tenure");
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(true);

    const refresh = async () => {
        setLoading(true);
        const res = await getAdminData();
        if (res.authorized === false) setAuthorized(false);
        else setData(res);
        setLoading(false);
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const res = await getAdminData();
            if (res.authorized === false) setAuthorized(false);
            else setData(res);
            setLoading(false);
        };
        
        loadData();
    }, []);

    if (loading)
        return (
            <div className="flex items-center justify-center min-h-96">
                <CompactPreloader 
                    title="Loading Tenure Manager" 
                    subtitle="Fetching administrative data..."
                    showUserIcon={true}
                />
            </div>
        );

    if (!authorized)
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
                <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold text-slate-900">
                    Access Denied
                </h1>
                <p className="text-slate-500 max-w-md mt-2">
                    You don&rsquo;t hold a position with access to the Tenure module.
                </p>
            </div>
        );

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="flex flex-col gap-1 border-b border-slate-200 pb-6">
                <h1 className="text-3xl font-bold text-rcf-navy">
                    Tenure Manager
                </h1>
                <p className="text-slate-500">
                    Manage tenure configuration, structure, and appointments.
                </p>
            </div>

            <nav className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                <TabButton
                    id="tenure"
                    label="Tenure Profile"
                    icon={CalendarDays}
                    active={activeTab}
                    set={setActiveTab}
                />
                <TabButton
                    id="structure"
                    label="Workforce"
                    icon={Layers}
                    active={activeTab}
                    set={setActiveTab}
                />
                <TabButton
                    id="cabinet"
                    label="Cabinet"
                    icon={Crown}
                    active={activeTab}
                    set={setActiveTab}
                />
                <TabButton
                    id="families"
                    label="Generations"
                    icon={Users}
                    active={activeTab}
                    set={setActiveTab}
                />
                <TabButton
                    id="transfers"
                    label="Transfers"
                    icon={ArrowLeftRight}
                    active={activeTab}
                    set={setActiveTab}
                />
                <TabButton
                    id="structure-map"
                    label="Hierarchy"
                    icon={Network}
                    active={activeTab}
                    set={setActiveTab}
                />
            </nav>

            <div className="min-h-100">
                {activeTab === "tenure" && (
                    <TenureTab data={data} onSuccess={refresh} />
                )}
                {activeTab === "structure" && (
                    <StructureTab data={data} onSuccess={refresh} />
                )}
                {activeTab === "cabinet" && (
                    <CabinetTab data={data} onSuccess={refresh} />
                )}
                {activeTab === "families" && (
                    <FamilyTab data={data} onSuccess={refresh} />
                )}
                {activeTab === "transfers" && (
                    <TransfersTab onSuccess={refresh} />
                )}
                {activeTab === "structure-map" && (
                    // Editing the catalogue is the VP Admin's job; everyone else reads it.
                    <CataloguePanel canEdit={!!data?.canEditCatalogue} />
                )}
            </div>
        </div>
    );
}

function TabButton({ id, label, icon: Icon, active, set }: any) {
    const isActive = active === id;
    return (
        <button
            onClick={() => set(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                isActive
                    ? "bg-rcf-navy text-white shadow-md"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
        >
            <Icon className="h-4 w-4" /> {label}
        </button>
    );
}
