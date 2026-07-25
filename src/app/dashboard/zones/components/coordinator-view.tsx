/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import {
    createZoneAction,
    assignPastorAction,
    removePastorAction,
    getZoneDetailsAction,
} from "../actions";
import {
    Plus,
    MapPin,
    Users,
    Search,
    X,
    Loader2,
    UserPlus,
    Trash2,
    Phone,
} from "lucide-react";
import FormInput from "@/components/ui/FormInput";

export function CoordinatorView({ data, onSuccess }: any) {
    const [search, setSearch] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedZone, setSelectedZone] = useState<any>(null);

    const filtered = data.zones.filter((z: any) =>
        z.name.toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search zones..."
                        className="w-full pl-9 h-9 rounded-xl bg-slate-50 border-none text-sm focus:ring-2 focus:ring-rcf-navy outline-none"
                    />
                </div>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="flex items-center gap-2 bg-rcf-navy text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:bg-opacity-90 active:scale-95 w-full md:w-auto justify-center"
                >
                    <Plus className="h-4 w-4" /> Add Zone
                </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((z: any, idx: number) => (
                    <div
                        key={idx}
                        onClick={() => setSelectedZone(z)}
                        className="group bg-white p-6 rounded-2xl border border-slate-200 hover:shadow-md cursor-pointer transition-all hover:-translate-y-1 relative overflow-hidden"
                    >
                        <div className="flex justify-between mb-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                                <MapPin className="h-6 w-6" />
                            </div>
                            <span className="text-[10px] font-bold bg-slate-100 px-2 py-1 rounded text-slate-600 uppercase tracking-wide h-fit">
                                {z.memberCount} Members
                            </span>
                        </div>

                        <h3 className="font-bold text-lg text-slate-900 mb-1">
                            {z.name}
                        </h3>
                        <p className="text-xs text-slate-500 line-clamp-2">
                            {z.description || "Residential Zone"}
                        </p>

                        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-medium text-slate-500">
                            <Users className="h-3.5 w-3.5" />
                            {z.pastorCount === 0
                                ? "No Pastors Assigned"
                                : `${z.pastorCount} Hall Pastors`}
                        </div>
                    </div>
                ))}
            </div>

            {/* Create Modal */}
            {isCreateOpen && (
                <CreateZoneModal
                    onClose={() => setIsCreateOpen(false)}
                    onSuccess={onSuccess}
                />
            )}

            {/* Manage Modal */}
            {selectedZone && (
                <ManageZoneModal
                    zone={selectedZone}
                    tenureId={data.tenureId}
                    onClose={() => setSelectedZone(null)}
                    onSuccess={onSuccess} // Pass refresh trigger
                />
            )}
        </div>
    );
}

// --- SUB-COMPONENTS ---

function CreateZoneModal({ onClose, onSuccess }: any) {
    const [loading, setLoading] = useState(false);

    async function handleSubmit(formData: FormData) {
        setLoading(true);
        const res = await createZoneAction(formData);
        setLoading(false);
        if (res.success) {
            onSuccess();
            onClose();
        } else alert(res.error);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900">
                        Create Residential Zone
                    </h3>
                    <button onClick={onClose}>
                        <X className="h-5 w-5 text-slate-500" />
                    </button>
                </div>
                <form action={handleSubmit} className="p-6 space-y-5">
                    <FormInput
                        label="Zone Name"
                        name="name"
                        required
                        placeholder="e.g. South Gate"
                    />
                    <FormInput
                        label="Description"
                        name="description"
                        placeholder="e.g. Covers Success Lodge to Titanic"
                    />
                    <button
                        disabled={loading}
                        className="w-full py-3 rounded-xl bg-rcf-navy text-white font-bold text-sm hover:bg-opacity-90 flex justify-center"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin h-5 w-5" />
                        ) : (
                            "Create Zone"
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

function ManageZoneModal({ zone, tenureId, onClose, onSuccess }: any) {
    const [view, setView] = useState<"MEMBERS" | "PASTORS">("PASTORS");
    const [details, setDetails] = useState<{ members: any[]; pastors: any[] }>({
        members: [],
        pastors: [],
    });
    const [loading, setLoading] = useState(true);

    // Load Data
    const refreshData = async () => {
        setLoading(true);
        const res = await getZoneDetailsAction(zone.id, tenureId);
        setDetails(res);
        setLoading(false);
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const res = await getZoneDetailsAction(zone.id, tenureId);
            setDetails(res);
            setLoading(false);
        };
        loadData();
    }, [zone.id, tenureId]);

    // Handle Assign Pastor
    const handleAssign = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.append("tenureId", tenureId);
        formData.append("zoneId", zone.id);

        const res = await assignPastorAction(formData);
        if (res.success) {
            (e.target as HTMLFormElement).reset();
            refreshData(); // Refresh local list
            onSuccess(); // Refresh parent stats
        } else {
            alert(res.error);
        }
    };

    // Handle Remove Pastor
    const handleRemove = async (id: string) => {
        if (confirm("Revoke this pastor's assignment?")) {
            await removePastorAction(id);
            refreshData();
            onSuccess();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[600px] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-slate-900 text-xl">
                            {zone.name}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">
                            Zone Management
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200">
                    <button
                        onClick={() => setView("PASTORS")}
                        className={`flex-1 py-3 text-sm font-bold transition-colors ${view === "PASTORS" ? "text-rcf-navy border-b-2 border-rcf-navy bg-blue-50/50" : "text-slate-500 hover:bg-slate-50"}`}
                    >
                        Hall Pastors ({details.pastors.length})
                    </button>
                    <button
                        onClick={() => setView("MEMBERS")}
                        className={`flex-1 py-3 text-sm font-bold transition-colors ${view === "MEMBERS" ? "text-rcf-navy border-b-2 border-rcf-navy bg-blue-50/50" : "text-slate-500 hover:bg-slate-50"}`}
                    >
                        Members ({details.members.length})
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-white">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="animate-spin text-slate-300 h-8 w-8" />
                        </div>
                    ) : view === "PASTORS" ? (
                        <div className="space-y-8">
                            {/* Add Form */}
                            <form
                                onSubmit={handleAssign}
                                className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex gap-2 items-end"
                            >
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                                        Assign New Delegate
                                    </label>
                                    <input
                                        name="email"
                                        type="email"
                                        required
                                        placeholder="Enter worker email..."
                                        className="w-full h-10 mt-1 px-3 rounded-lg border border-slate-300 text-sm outline-none focus:border-rcf-navy"
                                    />
                                </div>
                                <button className="h-10 bg-rcf-navy text-white px-4 rounded-lg font-bold text-xs hover:bg-opacity-90 flex items-center gap-2">
                                    <UserPlus className="h-3.5 w-3.5" /> Assign
                                </button>
                            </form>

                            {/* List */}
                            <div className="space-y-2">
                                {details.pastors.map((p: any, idx:number) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600">
                                                {p.first_name[0]}
                                                {p.last_name[0]}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-slate-900">
                                                    {p.first_name} {p.last_name}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {p.phone_number}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() =>
                                                handleRemove(p.leadershipId)
                                            }
                                            className="text-slate-300 hover:text-red-500 p-2"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                                {details.pastors.length === 0 && (
                                    <p className="text-center text-sm text-slate-400 py-4">
                                        No pastors assigned.
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
                        // MEMBERS LIST
                        <div className="space-y-2">
                            {details.members.map((m: any, idx:number) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between p-3 border-b border-slate-50 last:border-0 hover:bg-slate-50"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 text-xs">
                                            {m.first_name[0]}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-900">
                                                {m.first_name} {m.last_name}
                                            </p>
                                            <p className="text-[10px] text-slate-400">
                                                {m.school_address ||
                                                    "No address"}
                                            </p>
                                        </div>
                                    </div>
                                    <a
                                        href={`tel:${m.phone_number}`}
                                        className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100"
                                    >
                                        <Phone className="h-3 w-3" />
                                    </a>
                                </div>
                            ))}
                            {details.members.length === 0 && (
                                <p className="text-center text-sm text-slate-400 py-10">
                                    No members registered in this zone yet.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
