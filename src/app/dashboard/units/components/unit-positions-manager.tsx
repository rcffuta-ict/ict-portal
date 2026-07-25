"use client";

import { useState, useEffect, useCallback } from "react";
import {
    getUnitPositionsAction,
    getAvailablePositionsAction,
    assignPositionToUnitAction,
    removePositionFromUnitAction,
    getUnitLeadershipAction,
} from "../actions";
import {
    Shield,
    UserCheck,
    Plus,
    Trash2,
    Crown,
    Users,
    Loader2,
    AlertCircle,
    User,
    Mail,
    Phone,
} from "lucide-react";
import { useAlertModal, AlertModal } from "@/components/ui/alert-modal";

interface UnitPosition {
    id: string;
    role_type: "leader" | "assistant";
    position: {
        id: string;
        title: string;
        category: string;
        description?: string;
    };
}

interface LeadershipEntry {
    unitPositionId: string;
    leadershipId: string;
    roleType: "leader" | "assistant";
    positionId: string;
    positionTitle: string;
    profile: {
        id: string;
        first_name: string;
        last_name: string;
        email: string;
        phone_number?: string;
        avatar_url?: string;
    };
}

interface AvailablePosition {
    id: string;
    title: string;
    category: string;
    description?: string;
}

interface Props {
    unit: { id: string; name: string; type: string };
    tenureId: string;
    onSuccess?: () => void;
}

export function UnitPositionsManager({ unit, tenureId, onSuccess }: Props) {
    const [unitPositions, setUnitPositions] = useState<UnitPosition[]>([]);
    const [leadership, setLeadership] = useState<LeadershipEntry[]>([]);
    const [availablePositions, setAvailablePositions] = useState<AvailablePosition[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [selectedPositionId, setSelectedPositionId] = useState("");
    const [selectedRoleType, setSelectedRoleType] = useState<"leader" | "assistant">("leader");
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [positionsRes, leadershipRes, availableRes] = await Promise.all([
                getUnitPositionsAction(unit.id),
                getUnitLeadershipAction(unit.id, tenureId),
                getAvailablePositionsAction(),
            ]);

            if (positionsRes.success) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setUnitPositions(positionsRes.data as any);
            }
            if (leadershipRes.success) {
                setLeadership(leadershipRes.data);
            }
            if (availableRes.success) {
                setAvailablePositions(availableRes.data);
            }
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    }, [unit.id, tenureId]);

    // Fetch data on mount
    useEffect(() => {
        loadData();
    }, [loadData]);

    // Get positions not yet assigned to this unit
    const unassignedPositions = availablePositions.filter(
        (ap) => !unitPositions.find((up) => up.position.id === ap.id)
    );

    // Check if unit already has a leader position
    const hasLeaderPosition = unitPositions.some((up) => up.role_type === "leader");

    // Handle adding a position to the unit
    const handleAddPosition = async () => {
        if (!selectedPositionId) {
            showAlert({ type: "error", message: "Please select a position." });
            return;
        }

        setAdding(true);
        const res = await assignPositionToUnitAction(unit.id, selectedPositionId, selectedRoleType);
        setAdding(false);

        if (res.success) {
            showAlert({ type: "success", message: "Position assigned successfully!" });
            setShowAddForm(false);
            setSelectedPositionId("");
            setSelectedRoleType("leader");
            await loadData();
            onSuccess?.();
        } else {
            showAlert({ type: "error", message: res.error || "Failed to assign position." });
        }
    };

    // Handle removing a position from the unit
    const handleRemovePosition = (unitPositionId: string, positionTitle: string) => {
        showAlert({
            type: "warning",
            title: "Remove Position?",
            message: `Are you sure you want to remove "${positionTitle}" from this unit? This will also affect any leadership assignments.`,
            confirmText: "Remove",
            onConfirm: async () => {
                const res = await removePositionFromUnitAction(unitPositionId);
                if (res.success) {
                    showAlert({ type: "success", message: "Position removed successfully!" });
                    await loadData();
                    onSuccess?.();
                } else {
                    showAlert({ type: "error", message: res.error || "Failed to remove position." });
                }
            },
        });
    };

    // Find leadership for a position
    const getLeaderForPosition = (positionId: string) => {
        return leadership.find((l) => l.positionId === positionId);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-rcf-navy" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />

            {/* Header Section */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <Shield className="h-5 w-5 text-rcf-navy" />
                        Leadership Positions
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Manage which leadership positions can manage this {unit.type.toLowerCase()}.
                    </p>
                </div>
                {!showAddForm && (
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-rcf-navy text-white rounded-lg text-sm font-bold hover:bg-opacity-90 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        Add Position
                    </button>
                )}
            </div>

            {/* Add Position Form */}
            {showAddForm && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-4">
                    <div className="flex items-center gap-2 text-blue-700 text-sm font-semibold">
                        <Plus className="h-4 w-4" />
                        Assign Leadership Position
                    </div>

                    {unassignedPositions.length === 0 ? (
                        <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 p-3 rounded-lg">
                            <AlertCircle className="h-4 w-4" />
                            All available positions are already assigned to this unit.
                        </div>
                    ) : (
                        <>
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
                                        {unassignedPositions.map((pos) => (
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
                                        disabled={hasLeaderPosition && selectedRoleType === "leader"}
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
                                            Assigning...
                                        </>
                                    ) : (
                                        <>
                                            <UserCheck className="h-4 w-4" />
                                            Assign Position
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Assigned Positions List */}
            <div className="space-y-3">
                {unitPositions.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                        <Shield className="h-10 w-10 mx-auto mb-3 opacity-20" />
                        <p className="font-medium">No leadership positions assigned</p>
                        <p className="text-xs mt-1">
                            Add positions to define who can lead this {unit.type.toLowerCase()}.
                        </p>
                    </div>
                ) : (
                    unitPositions.map((up) => {
                        const leader = getLeaderForPosition(up.position.id);
                        return (
                            <div
                                key={up.id}
                                className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-shadow"
                            >
                                <div className="flex items-start justify-between">
                                    {/* Position Info */}
                                    <div className="flex items-start gap-3">
                                        <div
                                            className={`p-2.5 rounded-xl ${
                                                up.role_type === "leader"
                                                    ? "bg-amber-50 text-amber-600"
                                                    : "bg-blue-50 text-blue-600"
                                            }`}
                                        >
                                            {up.role_type === "leader" ? (
                                                <Crown className="h-5 w-5" />
                                            ) : (
                                                <Users className="h-5 w-5" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-slate-900">
                                                    {up.position.title}
                                                </h4>
                                                <span
                                                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                                        up.role_type === "leader"
                                                            ? "bg-amber-100 text-amber-700"
                                                            : "bg-blue-100 text-blue-700"
                                                    }`}
                                                >
                                                    {up.role_type}
                                                </span>
                                            </div>
                                            {up.position.description && (
                                                <p className="text-xs text-slate-500 mt-1">
                                                    {up.position.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Remove Button */}
                                    <button
                                        onClick={() => handleRemovePosition(up.id, up.position.title)}
                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                        title="Remove position from unit"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>

                                {/* Current Leader/Assistant */}
                                <div className="mt-4 pt-4 border-t border-slate-100">
                                    {leader ? (
                                        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
                                            <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center font-bold text-green-700 text-xs overflow-hidden">
                                                {leader.profile.avatar_url ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={leader.profile.avatar_url}
                                                        className="h-full w-full object-cover"
                                                        alt=""
                                                    />
                                                ) : (
                                                    `${leader.profile.first_name[0]}${leader.profile.last_name[0]}`
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-bold text-sm text-green-800">
                                                    {leader.profile.first_name} {leader.profile.last_name}
                                                </p>
                                                <div className="flex items-center gap-3 text-[10px] text-green-600">
                                                    <span className="flex items-center gap-1">
                                                        <Mail className="h-3 w-3" />
                                                        {leader.profile.email}
                                                    </span>
                                                    {leader.profile.phone_number && (
                                                        <span className="flex items-center gap-1">
                                                            <Phone className="h-3 w-3" />
                                                            {leader.profile.phone_number}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-bold bg-green-200 text-green-700 px-2 py-1 rounded">
                                                ASSIGNED
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-slate-400 text-sm bg-slate-50 rounded-lg p-3">
                                            <User className="h-4 w-4" />
                                            <span>No one assigned to this position yet</span>
                                            <span className="text-[10px] ml-auto">
                                                (Assign in Tenure → Leadership)
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Info Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-700 mb-1">How Leadership Works:</p>
                <ul className="space-y-1 text-xs list-disc list-inside">
                    <li>
                        <strong>Leader:</strong> Primary leadership position for the {unit.type.toLowerCase()}.
                        Only one leader position allowed.
                    </li>
                    <li>
                        <strong>Assistant:</strong> Supporting leadership positions. Multiple assistants
                        allowed.
                    </li>
                    <li>
                        Actual people are assigned to these positions in the{" "}
                        <strong>Tenure → Leadership</strong> section.
                    </li>
                </ul>
            </div>
        </div>
    );
}
