/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback } from "react";
import {
    X,
    UserPlus,
    Trash2,
    Search,
    Loader2,
    ChevronRight,
    Users,
    Shield,
    Crown,
} from "lucide-react";
import {
    getUnitDetails,
    addUnitLeaderAction,
    removeUnitLeaderAction,
    searchMemberAction,
} from "../actions";
import {
    getUnitPositionsAction,
    getAvailablePositionsAction,
    assignPositionToUnitAction,
    removePositionFromUnitAction,
} from "../../units/actions";
import FormSelect from "@/components/ui/FormSelect";

type TabType = "leaders" | "positions";

export function ManageUnitModal({ unit, positions, onClose }: any) {
    const [leaders, setLeaders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<"LIST" | "ADD">("LIST");
    const [activeTab, setActiveTab] = useState<TabType>("leaders");

    // Load leaders on mount
    const loadLeaders = useCallback(async () => {
        const res = await getUnitDetails(unit.id);
        if (res.leaders) setLeaders(res.leaders);
    }, [unit.id]);

    useEffect(() => {
        const fetchLeaders = async () => {
            setLoading(true);
            await loadLeaders();
            setLoading(false);
        };
        fetchLeaders();
    }, [loadLeaders]);

    // Delete Handler
    const handleRemove = async (id: string) => {
        if (confirm("Remove this leader?")) {
            await removeUnitLeaderAction(id);
            loadLeaders();
        }
    };

    // Add Handler
    const handleSuccess = () => {
        setView("LIST");
        loadLeaders();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className="font-bold text-slate-900 text-lg">
                                {unit.name}
                            </h3>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                                {unit.type} • {unit.memberCount} Members
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
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => {
                                setActiveTab("leaders");
                                setView("LIST");
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                activeTab === "leaders"
                                    ? "bg-white text-rcf-navy shadow-sm"
                                    : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            <Crown className="h-4 w-4" />
                            Leadership
                        </button>
                        <button
                            onClick={() => setActiveTab("positions")}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                activeTab === "positions"
                                    ? "bg-white text-rcf-navy shadow-sm"
                                    : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            <Shield className="h-4 w-4" />
                            Positions
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === "leaders" && view === "LIST" ? (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h4 className="font-bold text-slate-700">
                                    Leadership Team
                                </h4>
                                <button
                                    onClick={() => setView("ADD")}
                                    className="flex items-center gap-2 text-xs font-bold bg-rcf-navy text-white px-3 py-1.5 rounded-lg hover:bg-opacity-90 transition-all"
                                >
                                    <UserPlus className="h-3.5 w-3.5" /> Assign
                                    Leader
                                </button>
                            </div>

                            {loading ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="animate-spin text-slate-400" />
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {leaders.length === 0 && (
                                        <p className="text-sm text-slate-400 text-center py-8 border-2 border-dashed border-slate-100 rounded-xl">
                                            No leaders assigned yet.
                                        </p>
                                    )}
                                    {leaders.map((l: any) => (
                                        <div
                                            key={l.id}
                                            className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                                                    {l.profile.first_name[0]}
                                                    {l.profile.last_name[0]}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 text-sm">
                                                        {l.profile.first_name}{" "}
                                                        {l.profile.last_name}
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-blue-600 font-bold bg-blue-50 px-1.5 rounded">
                                                            {l.position
                                                                ?.title ||
                                                                l.role_name}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() =>
                                                    handleRemove(l.id)
                                                }
                                                className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : activeTab === "leaders" && view === "ADD" ? (
                        <AddLeaderForm
                            unitId={unit.id}
                            positions={positions}
                            onCancel={() => setView("LIST")}
                            onSuccess={handleSuccess}
                        />
                    ) : (
                        <UnitPositionsTab unitId={unit.id} />
                    )}
                </div>
            </div>
        </div>
    );
}

// --- SUB-COMPONENT: UNIT POSITIONS TAB ---
function UnitPositionsTab({ unitId }: { unitId: string }) {
    const [unitPositions, setUnitPositions] = useState<any[]>([]);
    const [availablePositions, setAvailablePositions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [selectedPositionId, setSelectedPositionId] = useState("");
    const [selectedRoleType, setSelectedRoleType] = useState<"leader" | "assistant">("leader");

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [positionsRes, availableRes] = await Promise.all([
                getUnitPositionsAction(unitId),
                getAvailablePositionsAction(),
            ]);

            if (positionsRes.success) {
                setUnitPositions(positionsRes.data);
            }
            if (availableRes.success) {
                setAvailablePositions(availableRes.data);
            }
        } catch (error) {
            console.error("Error loading positions:", error);
        } finally {
            setLoading(false);
        }
    }, [unitId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Get positions not yet assigned to this unit
    const unassignedPositions = availablePositions.filter(
        (ap) => !unitPositions.find((up: any) => up.position?.id === ap.id)
    );

    // Check if unit already has a leader position
    const hasLeaderPosition = unitPositions.some((up: any) => up.role_type === "leader");

    // Handle adding a position to the unit
    const handleAddPosition = async () => {
        if (!selectedPositionId) return;

        setAdding(true);
        const res = await assignPositionToUnitAction(unitId, selectedPositionId, selectedRoleType);
        setAdding(false);

        if (res.success) {
            setShowAddForm(false);
            setSelectedPositionId("");
            setSelectedRoleType("leader");
            await loadData();
        } else {
            alert(res.error || "Failed to assign position.");
        }
    };

    // Handle removing a position from the unit
    const handleRemovePosition = async (unitPositionId: string) => {
        if (confirm("Remove this position from the unit?")) {
            const res = await removePositionFromUnitAction(unitPositionId);
            if (res.success) {
                await loadData();
            } else {
                alert(res.error || "Failed to remove position.");
            }
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Leadership Positions
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                        Define which positions can lead this unit.
                    </p>
                </div>
                {!showAddForm && (
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="flex items-center gap-2 text-xs font-bold bg-rcf-navy text-white px-3 py-1.5 rounded-lg hover:bg-opacity-90 transition-all"
                    >
                        <Users className="h-3.5 w-3.5" /> Add Position
                    </button>
                )}
            </div>

            {/* Add Position Form */}
            {showAddForm && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-4 animate-in slide-in-from-top-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                Position
                            </label>
                            <select
                                value={selectedPositionId}
                                onChange={(e) => setSelectedPositionId(e.target.value)}
                                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm outline-none focus:border-rcf-navy bg-white"
                            >
                                <option value="">Select a position...</option>
                                {unassignedPositions.map((pos: any) => (
                                    <option key={pos.id} value={pos.id}>
                                        {pos.title}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                Role Type
                            </label>
                            <select
                                value={selectedRoleType}
                                onChange={(e) =>
                                    setSelectedRoleType(e.target.value as "leader" | "assistant")
                                }
                                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm outline-none focus:border-rcf-navy bg-white disabled:opacity-50"
                            >
                                <option value="leader" disabled={hasLeaderPosition}>
                                    Leader {hasLeaderPosition && "(Already assigned)"}
                                </option>
                                <option value="assistant">Assistant</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2">
                        <button
                            onClick={() => {
                                setShowAddForm(false);
                                setSelectedPositionId("");
                                setSelectedRoleType("leader");
                            }}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAddPosition}
                            disabled={adding || !selectedPositionId}
                            className="flex items-center gap-2 px-4 py-2 bg-rcf-navy text-white rounded-lg text-sm font-bold hover:bg-opacity-90 transition-colors disabled:opacity-50"
                        >
                            {adding ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                "Add Position"
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Positions List */}
            <div className="space-y-3">
                {unitPositions.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-8 border-2 border-dashed border-slate-100 rounded-xl">
                        No leadership positions assigned to this unit.
                    </p>
                ) : (
                    unitPositions.map((up: any) => (
                        <div
                            key={up.id}
                            className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className={`h-10 w-10 rounded-full flex items-center justify-center font-bold ${
                                        up.role_type === "leader"
                                            ? "bg-amber-100 text-amber-600"
                                            : "bg-blue-100 text-blue-600"
                                    }`}
                                >
                                    {up.role_type === "leader" ? (
                                        <Crown className="h-5 w-5" />
                                    ) : (
                                        <Users className="h-5 w-5" />
                                    )}
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 text-sm">
                                        {up.position?.title || "Unknown Position"}
                                    </p>
                                    <span
                                        className={`text-[10px] font-bold px-1.5 rounded uppercase ${
                                            up.role_type === "leader"
                                                ? "bg-amber-50 text-amber-600"
                                                : "bg-blue-50 text-blue-600"
                                        }`}
                                    >
                                        {up.role_type}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => handleRemovePosition(up.id)}
                                className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2"
                                title="Remove position"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Info Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600">
                <p className="font-semibold text-slate-700 mb-1">How Positions Work:</p>
                <ul className="space-y-1 list-disc list-inside">
                    <li><strong>Leader:</strong> Primary leadership position (only one per unit).</li>
                    <li><strong>Assistant:</strong> Supporting positions (multiple allowed).</li>
                    <li>After assigning positions, go to Leadership tab to appoint people.</li>
                </ul>
            </div>
        </div>
    );
}

// --- SUB-COMPONENT: ADD LEADER FORM ---
function AddLeaderForm({ unitId, positions, onCancel, onSuccess }: any) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const handleSearch = async (e: any) => {
        setQuery(e.target.value);
        if (e.target.value.length > 2) {
            const res = await searchMemberAction(e.target.value);
            setResults(res);
        }
    };

    const handleSubmit = async (formData: FormData) => {
        setLoading(true);
        formData.append("unitId", unitId);
        formData.append("profileId", selectedUser.id);

        const res = await addUnitLeaderAction(formData);
        setLoading(false);

        if (res.success) onSuccess();
        else alert(res.error);
    };

    // Filter positions to only show UNIT category
    const unitPositions = positions?.filter(
        (p: any) => p.category === "UNIT" && p.is_active
    );

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4">
            <div
                className="flex items-center gap-2 text-slate-400 mb-4 cursor-pointer hover:text-slate-600"
                onClick={onCancel}
            >
                <ChevronRight className="h-4 w-4 rotate-180" />
                <span className="text-xs font-bold uppercase">
                    Back to List
                </span>
            </div>

            {!selectedUser ? (
                <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                        Step 1: Select Member
                    </label>
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <input
                            autoFocus
                            placeholder="Search name..."
                            value={query}
                            onChange={handleSearch}
                            className="w-full h-10 pl-9 rounded-lg border border-slate-300 text-sm outline-none focus:border-rcf-navy"
                        />
                    </div>
                    <div className="space-y-1">
                        {results.map((user) => (
                            <div
                                key={user.id}
                                onClick={() => setSelectedUser(user)}
                                className="p-3 border rounded-lg hover:bg-slate-50 cursor-pointer flex justify-between items-center text-sm"
                            >
                                <span className="font-bold">
                                    {user.first_name} {user.last_name}
                                </span>
                                <span className="text-xs text-slate-500">
                                    {user.department}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <form action={handleSubmit} className="space-y-5">
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex justify-between items-center">
                        <span className="font-bold text-slate-900">
                            {selectedUser.first_name} {selectedUser.last_name}
                        </span>
                        <button
                            type="button"
                            onClick={() => setSelectedUser(null)}
                            className="text-xs text-blue-600 font-bold hover:underline"
                        >
                            Change
                        </button>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">
                            Step 2: Assign Position
                        </label>
                        <FormSelect name="positionId" className="w-full">
                            <option value="">Select Role...</option>
                            {unitPositions?.map((p: any) => (
                                <option key={p.id} value={p.id}>
                                    {p.title}
                                </option>
                            ))}
                        </FormSelect>
                        <p className="text-[10px] text-slate-400">
                                {`Don't see the role? Go to "Configure Roles" in the
                                Cabinet tab to create "Assistant Technical Head",`}
                            etc.
                        </p>
                    </div>

                    <button
                        disabled={loading}
                        className="w-full bg-rcf-navy text-white py-3 rounded-xl font-bold text-sm hover:bg-opacity-90 flex justify-center gap-2"
                    >
                        {loading && (
                            <Loader2 className="animate-spin h-4 w-4" />
                        )}{" "}
                        Confirm Appointment
                    </button>
                </form>
            )}
        </div>
    );
}
