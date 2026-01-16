/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback, useRef } from "react";
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
    Mail,
    Phone,
    GraduationCap,
    Loader2,
} from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import FormSelect from "@/components/ui/FormSelect";
import { AlertModal, useAlertModal } from "@/components/ui/alert-modal";

export function CabinetTab({ data, onSuccess }: any) {
    const [mode, setMode] = useState<"LIST" | "APPOINT" | "CONFIGURE">("LIST");
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();

    return (
        <>
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />

            <div className="mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
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
                        <RosterView
                            data={data}
                            onSuccess={onSuccess}
                            showAlert={showAlert}
                        />
                    )}
                    {mode === "APPOINT" && (
                        <AppointmentView
                            data={data}
                            onSuccess={() => {
                                onSuccess();
                                setMode("LIST");
                            }}
                            showAlert={showAlert}
                        />
                    )}
                    {mode === "CONFIGURE" && (
                        <ConfigurationView
                            data={data}
                            onSuccess={onSuccess}
                            showAlert={showAlert}
                        />
                    )}
                </div>
            </div>
        </>
    );
}

function RosterView({ data, onSuccess, showAlert }: any) {
    // FIX: Ensure we fallback to empty array if leadership is undefined
    const leaders = data?.leadership || [];
    const [search, setSearch] = useState("");

    const filtered = leaders.filter(
        (l: any) =>
            l.profile.first_name.toLowerCase().includes(search.toLowerCase()) ||
            l.profile.last_name.toLowerCase().includes(search.toLowerCase()) ||
            l.position.title.toLowerCase().includes(search.toLowerCase()) ||
            (l.units?.name || "").toLowerCase().includes(search.toLowerCase())
    );

    const handleRevoke = async (id: string) => {
        showAlert({
            type: "warning",
            title: "Revoke Leadership?",
            message: "Are you sure? This cannot be undone.",
            confirmText: "Revoke",
            onConfirm: async () => {
                const res = await removeUnitLeaderAction(id);
                if (res.success) onSuccess();
                else showAlert({ type: "error", message: res.error });
            },
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center px-4 sm:px-0">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search roster..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-9 pl-9 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-rcf-navy"
                    />
                </div>
                <div className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    Total: {filtered.length}
                </div>
            </div>

            <div className="border-t border-slate-100 overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[600px]">
                    <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-3">Name</th>
                            <th className="px-6 py-3">Role</th>
                            <th className="px-6 py-3">Context</th>
                            <th className="px-6 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filtered.length === 0 && (
                            <tr>
                                <td
                                    colSpan={4}
                                    className="p-8 text-center text-slate-400"
                                >
                                    No leaders found.
                                </td>
                            </tr>
                        )}
                        {filtered.map((l: any) => (
                            <tr
                                key={l.id}
                                className="hover:bg-slate-50 transition-colors"
                            >
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                            {l.profile.first_name[0]}
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
                                    {l.position.category === "CENTRAL" && (
                                        <span className="badge-purple">
                                            Central Exco
                                        </span>
                                    )}
                                    {l.position.category === "UNIT" && (
                                        <div className="flex items-center gap-1.5">
                                            <Shield className="h-3 w-3 text-blue-500" />
                                            <span className="text-xs font-bold text-blue-700">
                                                {l.units?.name}
                                            </span>
                                        </div>
                                    )}
                                    {l.position.category === "LEVEL" && (
                                        <div className="flex items-center gap-1.5">
                                            <Users className="h-3 w-3 text-orange-500" />
                                            <span className="text-xs font-bold text-orange-700">
                                                {l.class_sets?.entry_year} Set
                                            </span>
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => handleRevoke(l.id)}
                                        className="text-slate-300 hover:text-red-500 transition-colors p-2"
                                    >
                                        <Trash2 className="h-4 w-4" />
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
// --- SUB-COMPONENT 2: APPOINTMENT FORM (Existing) ---
function AppointmentView({ data, onSuccess, showAlert }: any) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [selectedPosId, setSelectedPosId] = useState("");
    const [isSearching, setIsSearching] = useState(false);

    // Debounce Ref (from previous step)
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const selectedPosition = data?.positions?.find(
        (p: any) => p.id === selectedPosId
    );
    const activePositions = data?.positions?.filter((p: any) => p.is_active);

    const handleSearch = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value;
            setQuery(value);

            if (searchTimeoutRef.current)
                clearTimeout(searchTimeoutRef.current);

            if (value.length > 2) {
                setIsSearching(true);
                searchTimeoutRef.current = setTimeout(async () => {
                    try {
                        const res = await searchMemberAction(value);
                        setResults(res);
                    } finally {
                        setIsSearching(false);
                    }
                }, 500);
            } else {
                setResults([]);
                setIsSearching(false);
            }
        },
        []
    );

    const handleAssign = async (formData: FormData) => {
        if (!selectedUser || !data?.activeTenure) return;
        formData.append("profileId", selectedUser.id);
        formData.append("tenureId", data.activeTenure.id);

        const res = await assignLeaderAction(formData);
        if (res.success) {
            showAlert({
                type: "success",
                message: "Leader appointed successfully!",
            });
            onSuccess();
            setSelectedUser(null);
            setQuery("");
            setSelectedPosId("");
        } else {
            showAlert({
                type: "error",
                message: res.error,
            });
        }
    };

    // console.debug("selectedUser",selectedUser)

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in">
            {!selectedUser ? (
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-xs">
                                1
                            </span>
                            Find Member
                        </label>
                        <div className="relative">
                            <FormInput
                                type="text"
                                placeholder="Search by name, email, or phone..."
                                value={query}
                                onChange={handleSearch}
                                leftIcon={
                                    isSearching ? (
                                        <Loader2 className="h-5 w-5 animate-spin text-rcf-navy" />
                                    ) : (
                                        <Search className="h-5 w-5" />
                                    )
                                }
                                hideLabel
                                className="h-14 text-lg"
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        {results.length > 0 && (
                            <p className="text-xs font-bold text-slate-400 uppercase">
                                Search Results
                            </p>
                        )}

                        {results.map((user) => (
                            <div
                                key={user.id}
                                onClick={() => setSelectedUser(user)}
                                className="group p-4 border border-slate-200 rounded-xl hover:border-rcf-navy hover:bg-slate-50 cursor-pointer flex items-center gap-4 transition-all shadow-sm hover:shadow-md"
                            >
                                {/* Avatar */}
                                <div className="h-12 w-12 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                                    {user.avatar_url ? (
                                        <img
                                            src={user.avatar_url}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-sm font-bold text-slate-500">
                                            {user.first_name[0]}
                                            {user.last_name[0]}
                                        </span>
                                    )}
                                </div>

                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-slate-900 text-lg leading-tight group-hover:text-rcf-navy transition-colors">
                                                {user.first_name}{" "}
                                                {user.last_name}
                                            </p>
                                            <p className="text-sm text-slate-500 flex items-center gap-2 mt-0.5">
                                                <Mail className="h-3 w-3" />{" "}
                                                {user.email}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-600">
                                                {user.level}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Existing Roles Badge */}
                                    {(user.units || user.teams) && (
                                        <div className="flex gap-2 mt-2 pt-2 border-t border-slate-100">
                                            {user.units && (
                                                <span className="text-[10px] text-blue-600 font-medium">
                                                    In: {user.units}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {query.length > 2 &&
                            results.length === 0 &&
                            !isSearching && (
                                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                                    {`No member found matching "${query}"`}
                                </div>
                            )}
                    </div>
                </div>
            ) : (
                <form
                    action={handleAssign}
                    className="space-y-8 animate-in slide-in-from-right-8"
                >
                    {/* SELECTED USER CARD */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs">
                                    ✓
                                </span>
                                Selected Member
                            </label>
                            <button
                                type="button"
                                onClick={() => setSelectedUser(null)}
                                className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1 rounded-md transition-colors"
                            >
                                Change
                            </button>
                        </div>

                        <div className="p-6 bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center sm:items-start gap-6 shadow-sm">
                            <div className="h-20 w-20 rounded-full bg-blue-100 border-4 border-white shadow-md flex items-center justify-center text-2xl font-bold text-blue-700 overflow-hidden">
                                {selectedUser.avatar_url ? (
                                    <img
                                        src={selectedUser.avatar_url}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    `${selectedUser.first_name[0]}${selectedUser.last_name[0]}`
                                )}
                            </div>

                            <div className="flex-1 text-center sm:text-left space-y-3 w-full">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">
                                        {selectedUser.first_name}{" "}
                                        {selectedUser.last_name}
                                    </h2>
                                    <div className="flex flex-wrap justify-center sm:justify-start gap-3 mt-1">
                                        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                                            <Mail className="h-3 w-3" />{" "}
                                            {selectedUser.email}
                                        </span>
                                        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                                            <Phone className="h-3 w-3" />{" "}
                                            {selectedUser.phone_number}
                                        </span>
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-slate-200 flex items-center gap-2 text-sm text-slate-600 justify-center sm:justify-start">
                                    <GraduationCap className="h-4 w-4 text-slate-400" />
                                    <span className="font-semibold">
                                        {selectedUser.level}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* APPOINTMENT FORM */}
                    <div className="space-y-5 pt-4 border-t border-slate-100">
                        <label className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-xs">
                                2
                            </span>
                            Assign Role
                        </label>

                        <div className="grid md:grid-cols-1 gap-6">
                            <FormSelect
                                label="Position Title"
                                name="positionId"
                                required
                                value={selectedPosId}
                                onChange={(e) =>
                                    setSelectedPosId(e.target.value)
                                }
                            >
                                <option value="">-- Select Position --</option>
                                {activePositions?.map((p: any) => (
                                    <option key={p.id} value={p.id}>
                                        {p.title} ({p.category})
                                    </option>
                                ))}
                            </FormSelect>

                            {selectedPosition?.category === "UNIT" && (
                                <div className="p-5 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2 animate-in fade-in">
                                    <label className="text-xs font-bold text-blue-700 uppercase flex items-center gap-2 mb-1">
                                        <Shield className="h-4 w-4" /> Select
                                        Unit Scope
                                    </label>
                                    <FormSelect
                                        name="unitId"
                                        required
                                        hideLabel
                                        className="bg-white border-blue-200 focus:border-blue-500"
                                    >
                                        <option value="">
                                            -- Select Unit --
                                        </option>
                                        {data?.units?.map((u: any) => (
                                            <option key={u.id} value={u.id}>
                                                {u.name} ({u.type})
                                            </option>
                                        ))}
                                    </FormSelect>
                                    <p className="text-[10px] text-blue-600/70 ml-1">
                                        They will gain admin access to this
                                        unit.
                                    </p>
                                </div>
                            )}

                            {selectedPosition?.category === "LEVEL" && (
                                <div className="p-5 bg-purple-50/50 rounded-xl border border-purple-100 space-y-2 animate-in fade-in">
                                    <label className="text-xs font-bold text-purple-700 uppercase flex items-center gap-2 mb-1">
                                        <Users className="h-4 w-4" /> Select
                                        Generation Scope
                                    </label>
                                    <FormSelect
                                        name="classSetId"
                                        required
                                        hideLabel
                                        className="bg-white border-purple-200 focus:border-purple-500"
                                    >
                                        <option value="">
                                            -- Select Generation --
                                        </option>
                                        {data?.families?.map((f: any) => (
                                            <option key={f.id} value={f.id}>
                                                {f.entry_year} Set (
                                                {f.family_name})
                                            </option>
                                        ))}
                                    </FormSelect>
                                </div>
                            )}
                        </div>

                        <button className="w-full h-14 bg-rcf-navy text-white text-base rounded-xl font-bold shadow-xl shadow-rcf-navy/20 hover:bg-opacity-90 hover:-translate-y-0.5 transition-all flex justify-center items-center gap-3 mt-4">
                            <CheckCircle className="h-5 w-5" /> Confirm
                            Appointment
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

// --- SUB-COMPONENT 3: CONFIGURATION VIEW (Existing) ---
function ConfigurationView({ data, onSuccess, showAlert }: any) {
    async function handleCreate(formData: FormData) {
        const res = await createPositionAction(formData);
        if (res.success) onSuccess();
        else showAlert({ type: "error", message: res.error });
    }

    async function toggleStatus(
        id: string,
        currentStatus: boolean,
        posData: any
    ) {
        showAlert({
            type: "warning",
            title: `${currentStatus ? "Deactivate" : "Activate"} Role?`,
            message: `Are you sure you want to ${
                currentStatus ? "deactivate" : "activate"
            } this role?`,
            confirmText: currentStatus ? "Deactivate" : "Activate",
            onConfirm: async () => {
                await togglePositionAction(id, currentStatus, posData);
                onSuccess();
            },
        });
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
