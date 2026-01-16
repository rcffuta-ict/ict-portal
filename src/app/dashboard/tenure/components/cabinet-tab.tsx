/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import {
    searchMemberAction,
    assignLeaderAction,
    createPositionAction,
    togglePositionAction,
    removeUnitLeaderAction,
} from "../actions";
import {
    Search,
    UserCheck,
    Shield,
    Users,
    Settings,
    Plus,
    Power,
    CheckCircle,
    List,
    Trash2,
} from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import FormSelect from "@/components/ui/FormSelect";

export function CabinetTab({ data, onSuccess }: any) {
    const [mode, setMode] = useState<"LIST" | "APPOINT" | "CONFIGURE">("LIST");

    return (
        <div className="mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-125">
            {/* Header / Mode Switcher */}
            <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h3 className="font-bold text-slate-900">
                        Leadership Management
                    </h3>
                    <p className="text-xs text-slate-500">
                        Active Tenure: {data?.activeTenure?.name}
                    </p>
                </div>

                <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                    <button
                        onClick={() => setMode("LIST")}
                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
                            mode === "LIST"
                                ? "bg-rcf-navy text-white shadow-sm"
                                : "text-slate-500 hover:bg-slate-50"
                        }`}
                    >
                        <List className="h-3 w-3" /> Roster
                    </button>
                    <button
                        onClick={() => setMode("APPOINT")}
                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
                            mode === "APPOINT"
                                ? "bg-rcf-navy text-white shadow-sm"
                                : "text-slate-500 hover:bg-slate-50"
                        }`}
                    >
                        <UserCheck className="h-3 w-3" /> Appoint
                    </button>
                    <button
                        onClick={() => setMode("CONFIGURE")}
                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
                            mode === "CONFIGURE"
                                ? "bg-rcf-navy text-white shadow-sm"
                                : "text-slate-500 hover:bg-slate-50"
                        }`}
                    >
                        <Settings className="h-3 w-3" /> Roles
                    </button>
                </div>
            </div>

            <div className="p-0 sm:p-8">
                {mode === "LIST" && (
                    <RosterView data={data} onSuccess={onSuccess} />
                )}
                {mode === "APPOINT" && (
                    <AppointmentView
                        data={data}
                        onSuccess={() => {
                            onSuccess();
                            setMode("LIST"); // Go back to list after success
                        }}
                    />
                )}
                {mode === "CONFIGURE" && (
                    <ConfigurationView data={data} onSuccess={onSuccess} />
                )}
            </div>
        </div>
    );
}

// --- SUB-COMPONENT 1: ROSTER VIEW (THE LIST) ---
function RosterView({ data, onSuccess }: any) {
    const leaders = data?.activeTenure ? data.leadership : []; // Leaders passed from getAdminData
    const [search, setSearch] = useState("");

    const filtered = leaders?.filter(
        (l: any) =>
            l.profile.first_name.toLowerCase().includes(search.toLowerCase()) ||
            l.profile.last_name.toLowerCase().includes(search.toLowerCase()) ||
            l.position.title.toLowerCase().includes(search.toLowerCase())
    );

    const handleRevoke = async (id: string) => {
        if (
            confirm(
                "Are you sure you want to remove this leader from their role?"
            )
        ) {
            const res = await removeUnitLeaderAction(id);
            if (res.success) {
                onSuccess();
            } else {
                alert("Failed to remove leader: " + res.error);
            }
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center px-4 sm:px-0">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search leaders..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-9 pl-9 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-rcf-navy"
                    />
                </div>
                <div className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    Total: {filtered?.length || 0}
                </div>
            </div>

            <div className="border-t border-slate-100">
                {filtered?.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-sm">
                        No leaders found matching your search.
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-3">Name</th>
                                <th className="px-6 py-3">Role / Position</th>
                                <th className="px-6 py-3">Scope / Context</th>
                                <th className="px-6 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map((l: any) => (
                                <tr
                                    key={l.id}
                                    className="hover:bg-slate-50 group"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                {l.profile.first_name[0]}
                                                {l.profile.last_name[0]}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">
                                                    {l.profile.first_name}{" "}
                                                    {l.profile.last_name}
                                                </p>
                                                <p className="text-[10px] text-slate-500">
                                                    {l.profile.phone_number}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-medium text-slate-700">
                                            {l.position.title}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {/* Logic to show Unit Name, Level Name, or Central */}
                                        {l.position.category === "CENTRAL" && (
                                            <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-100">
                                                CENTRAL EXCO
                                            </span>
                                        )}
                                        {l.position.category === "UNIT" && (
                                            <div className="flex items-center gap-1.5">
                                                <Shield className="h-3 w-3 text-blue-500" />
                                                <span className="text-xs font-bold text-blue-700">
                                                    {l.units?.name ||
                                                        "Unknown Unit"}
                                                </span>
                                            </div>
                                        )}
                                        {l.position.category === "LEVEL" && (
                                            <div className="flex items-center gap-1.5">
                                                <Users className="h-3 w-3 text-orange-500" />
                                                <span className="text-xs font-bold text-orange-700">
                                                    {l.class_sets?.entry_year}{" "}
                                                    Set
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleRevoke(l.id)}
                                            className="text-slate-300 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
                                            title="Revoke Role"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

// --- SUB-COMPONENT 2: APPOINTMENT FORM (Existing) ---
function AppointmentView({ data, onSuccess }: any) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [selectedPosId, setSelectedPosId] = useState("");

    const selectedPosition = data?.positions?.find(
        (p: any) => p.id === selectedPosId
    );

    const handleSearch = async (e: any) => {
        const val = e.target.value;
        setQuery(val);
        if (val.length > 2) {
            const res = await searchMemberAction(val);
            setResults(res);
        }
    };

    const handleAssign = async (formData: FormData) => {
        if (!selectedUser || !data?.activeTenure) return;

        formData.append("profileId", selectedUser.id);
        formData.append("tenureId", data.activeTenure.id);

        const res = await assignLeaderAction(formData);
        if (res.success) {
            alert("Leader appointed successfully!");
            onSuccess(); // This will trigger parent to switch back to LIST
        } else {
            alert(res.error);
        }
    };

    const activePositions = data?.positions?.filter((p: any) => p.is_active);

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in">
            {!selectedUser ? (
                <div className="space-y-4">
                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                        Step 1: Select Member
                    </label>
                    <FormInput
                        type="text"
                        placeholder="Search by Name, Email or Phone..."
                        value={query}
                        onChange={handleSearch}
                        leftIcon={<Search className="h-5 w-5" />}
                        hideLabel
                    />
                    <div className="space-y-2">
                        {results.map((user) => (
                            <div
                                key={user.id}
                                onClick={() => setSelectedUser(user)}
                                className="p-4 border border-slate-100 rounded-xl hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors shadow-sm"
                            >
                                <div>
                                    <p className="font-bold text-slate-900">
                                        {user.first_name} {user.last_name}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {user.email}
                                    </p>
                                </div>
                                <div className="text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-600">
                                    {user.department}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <form action={handleAssign} className="space-y-6">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                        <h3 className="font-bold text-slate-900">
                            Step 2: Assign Role
                        </h3>
                        <button
                            onClick={() => setSelectedUser(null)}
                            type="button"
                            className="text-xs font-bold text-red-500 hover:underline"
                        >
                            Change Member
                        </button>
                    </div>

                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-4">
                        <div className="h-10 w-10 bg-blue-200 rounded-full flex items-center justify-center text-blue-700 font-bold">
                            {selectedUser.first_name[0]}
                        </div>
                        <div>
                            <p className="text-xs text-blue-600 font-bold uppercase">
                                Appointing
                            </p>
                            <p className="font-bold text-slate-900">
                                {selectedUser.first_name}{" "}
                                {selectedUser.last_name}
                            </p>
                        </div>
                    </div>

                    <FormSelect
                        label="Position Title"
                        name="positionId"
                        required
                        value={selectedPosId}
                        onChange={(e) => setSelectedPosId(e.target.value)}
                    >
                        <option value="">-- Select Position --</option>
                        {activePositions?.map((p: any) => (
                            <option key={p.id} value={p.id}>
                                {p.title} ({p.category})
                            </option>
                        ))}
                    </FormSelect>

                    {selectedPosition?.category === "UNIT" && (
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 animate-in fade-in">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">
                                <Shield className="h-3 w-3" /> Select Unit to
                                Manage
                            </label>
                            <FormSelect name="unitId" required hideLabel>
                                <option value="">-- Select Unit --</option>
                                {data?.units?.map((u: any) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name} ({u.type})
                                    </option>
                                ))}
                            </FormSelect>
                        </div>
                    )}

                    {selectedPosition?.category === "LEVEL" && (
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 animate-in fade-in">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">
                                <Users className="h-3 w-3" /> Select Generation
                                to Lead
                            </label>
                            <FormSelect name="classSetId" required hideLabel>
                                <option value="">
                                    -- Select Generation --
                                </option>
                                {data?.families?.map((f: any) => (
                                    <option key={f.id} value={f.id}>
                                        {f.entry_year} Set ({f.family_name})
                                    </option>
                                ))}
                            </FormSelect>
                        </div>
                    )}

                    <button className="w-full bg-rcf-navy text-white py-3 rounded-xl font-bold text-sm hover:bg-opacity-90 transition-all flex justify-center gap-2 shadow-lg">
                        <CheckCircle className="h-4 w-4" /> Confirm Appointment
                    </button>
                </form>
            )}
        </div>
    );
}

// --- SUB-COMPONENT 3: CONFIGURATION VIEW (Existing) ---
function ConfigurationView({ data, onSuccess }: any) {
    async function handleCreate(formData: FormData) {
        const res = await createPositionAction(formData);
        if (res.success) onSuccess();
        else alert(res.error);
    }

    async function toggleStatus(
        id: string,
        currentStatus: boolean,
        posData: any
    ) {
        if (
            confirm(
                `Are you sure you want to ${
                    currentStatus ? "deactivate" : "activate"
                } this role?`
            )
        ) {
            await togglePositionAction(id, currentStatus, posData);
            onSuccess();
        }
    }

    return (
        <div className="grid gap-8 lg:grid-cols-3 animate-in slide-in-from-right-4">
            <div className="lg:col-span-1">
                <form
                    action={handleCreate}
                    className="bg-slate-50 p-6 rounded-xl border border-slate-200 sticky top-6 space-y-4"
                >
                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                        <Plus className="h-4 w-4" /> Create New Role
                    </h4>

                    <FormInput
                        name="title"
                        label="Role Title"
                        required
                        placeholder="e.g. Media Head"
                    />

                    <div className="space-y-1">
                        <FormSelect name="category" label="Category">
                            <option value="CENTRAL">Central Executive</option>
                            <option value="UNIT">Unit Head</option>
                            <option value="LEVEL">Level Coordinator</option>
                        </FormSelect>
                        <p className="text-[10px] text-slate-400">
                            Determines if they manage a Unit, a Level, or the
                            whole Fellowship.
                        </p>
                    </div>

                    <FormInput
                        name="description"
                        label="Description"
                        placeholder="Role description..."
                    />

                    <button className="btn-primary w-full text-xs">
                        Add to Master List
                    </button>
                </form>
            </div>

            <div className="lg:col-span-2 border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-500 font-bold text-xs uppercase">
                        <tr>
                            <th className="px-4 py-3">Title</th>
                            <th className="px-4 py-3">Category</th>
                            <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data?.positions?.map((pos: any) => (
                            <tr key={pos.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 font-medium text-slate-900">
                                    {pos.title}
                                </td>
                                <td className="px-4 py-3">
                                    <span
                                        className={`px-2 py-1 rounded text-[10px] font-bold ${
                                            pos.category === "CENTRAL"
                                                ? "bg-purple-100 text-purple-700"
                                                : pos.category === "UNIT"
                                                ? "bg-blue-100 text-blue-700"
                                                : "bg-orange-100 text-orange-700"
                                        }`}
                                    >
                                        {pos.category}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <button
                                        onClick={() =>
                                            toggleStatus(
                                                pos.id,
                                                pos.is_active,
                                                pos
                                            )
                                        }
                                        className={`text-xs font-bold flex items-center justify-end gap-1 w-full ${
                                            pos.is_active
                                                ? "text-green-600 hover:text-green-800"
                                                : "text-slate-400 hover:text-slate-600"
                                        }`}
                                    >
                                        <Power className="h-3 w-3" />
                                        {pos.is_active ? "Active" : "Inactive"}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
