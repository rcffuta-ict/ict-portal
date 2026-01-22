/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { addWorkerAction, removeWorkerAction } from "../actions";
import { Search, UserPlus, Trash2, Mail, Phone, User } from "lucide-react";
import { useAlertModal, AlertModal } from "@/components/ui/alert-modal";

export function UnitManager({
    unit,
    initialMembers,
    tenureId,
    onSuccess,
}: any) {
    const [members, setMembers] = useState<any[]>(initialMembers);
    const [search, setSearch] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();

    const filtered = members.filter(
        (m: any) =>
            m.first_name.toLowerCase().includes(search.toLowerCase()) ||
            m.last_name.toLowerCase().includes(search.toLowerCase()),
    );

    // Handler: Add Worker
    const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsAdding(true);
        const formData = new FormData(e.currentTarget);
        formData.append("unitId", unit.id);
        formData.append("tenureId", tenureId);

        const res = await addWorkerAction(formData);
        setIsAdding(false);

        if (res.success) {
            showAlert({
                type: "success",
                message: "Worker added successfully!",
            });
            (e.target as HTMLFormElement).reset();
            onSuccess(); // Triggers parent refresh (which re-fetches initialMembers)
        } else {
            showAlert({ type: "error", message: res.error });
        }
    };

    // Handler: Remove Worker
    const handleRemove = (id: string) => {
        showAlert({
            type: "warning",
            title: "Remove Worker?",
            message:
                "Are you sure you want to remove this member from the unit?",
            confirmText: "Remove",
            onConfirm: async () => {
                const res = await removeWorkerAction(id);
                if (res.success) onSuccess();
                else showAlert({ type: "error", message: res.error });
            },
        });
    };

    return (
        <div className="space-y-6">
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />

            {/* Add Form */}
            <form
                onSubmit={handleAdd}
                className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex gap-3 items-end"
            >
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                        Add New Worker
                    </label>
                    <input
                        name="email"
                        type="email"
                        required
                        placeholder="Enter member email..."
                        className="w-full h-10 mt-1 px-3 rounded-lg border border-slate-300 text-sm outline-none focus:border-rcf-navy"
                    />
                </div>
                <button
                    disabled={isAdding}
                    className="h-10 bg-rcf-navy text-white px-5 rounded-lg font-bold text-xs hover:bg-opacity-90 flex items-center gap-2"
                >
                    <UserPlus className="h-4 w-4" />{" "}
                    {isAdding ? "Adding..." : "Add"}
                </button>
            </form>

            {/* List Header */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-700">Workforce List</h3>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Filter list..."
                        className="w-full pl-8 h-8 rounded-lg bg-slate-50 text-xs outline-none focus:ring-1 ring-rcf-navy"
                    />
                </div>
            </div>

            {/* List */}
            <div className="space-y-2">
                {filtered.map((m: any) => (
                    <div
                        key={m.membershipId}
                        className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600 text-xs">
                                {m.avatar_url ? (
                                    <img
                                        src={m.avatar_url}
                                        className="h-full w-full rounded-full object-cover"
                                    />
                                ) : (
                                    `${m.first_name[0]}${m.last_name[0]}`
                                )}
                            </div>
                            <div>
                                <p className="font-bold text-sm text-slate-900">
                                    {m.first_name} {m.last_name}
                                </p>
                                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                                    <span className="flex items-center gap-1">
                                        <Mail className="h-3 w-3" /> {m.email}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Phone className="h-3 w-3" />{" "}
                                        {m.phone_number}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">
                                {m.role}
                            </span>
                            <button
                                onClick={() => handleRemove(m.membershipId)}
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ))}

                {filtered.length === 0 && (
                    <div className="py-12 text-center text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-xl">
                        <User className="h-8 w-8 mx-auto mb-2 opacity-20" />
                        No members found in this unit.
                    </div>
                )}
            </div>
        </div>
    );
}
