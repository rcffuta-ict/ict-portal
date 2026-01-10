"use client";

import { useState } from "react";
import { searchMemberAction, assignLeaderAction } from "../actions";
import { Search, UserCheck, Shield, Users } from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import FormSelect from "@/components/ui/FormSelect";

export function CabinetTab({ data, onSuccess }: any) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [scope, setScope] = useState("CENTRAL"); // CENTRAL, UNIT, LEVEL

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
        formData.append("scopeType", scope); // Pass the scope type logic to server

        const res = await assignLeaderAction(formData);
        if (res.success) {
            alert("Leader appointed successfully!");
            setSelectedUser(null);
            setQuery("");
            onSuccess();
        } else {
            alert(res.error);
        }
    };

    return (
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
            <div className="mb-8">
                <h3 className="text-xl font-bold text-slate-900">
                    Appoint Leadership
                </h3>
                <p className="text-slate-500 text-sm">
                    Assign Executive Council, Unit Heads, or Level Coordinators.
                </p>
            </div>

            {/* SEARCH AREA */}
            {!selectedUser ? (
                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                        <FormInput
                            type="text"
                            placeholder="Search by Name, Email or Phone..."
                            value={query}
                            onChange={handleSearch}
                            className="w-full h-12 pl-10 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-rcf-navy outline-none"
                        />
                    </div>
                    <div className="space-y-2">
                        {results.map((user) => (
                            <div
                                key={user.id}
                                onClick={() => setSelectedUser(user)}
                                className="p-4 border border-slate-100 rounded-xl hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors"
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
                        {query.length > 2 && results.length === 0 && (
                            <p className="text-center text-sm text-slate-400 py-4">
                                No members found.
                            </p>
                        )}
                    </div>
                </div>
            ) : (
                /* APPOINTMENT FORM */
                <form
                    action={handleAssign}
                    className="space-y-6 animate-in fade-in slide-in-from-bottom-4"
                >
                    {/* Selected User Card */}
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-blue-200 rounded-full flex items-center justify-center text-blue-700 font-bold">
                                {selectedUser.first_name[0]}
                                {selectedUser.last_name[0]}
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
                        <button
                            onClick={() => setSelectedUser(null)}
                            type="button"
                            className="text-xs font-bold text-slate-500 hover:text-slate-800"
                        >
                            Change
                        </button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">
                                Role Title
                            </label>
                            <FormInput
                                name="roleName"
                                required
                                placeholder="e.g. General Secretary"
                                className="input-field"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">
                                Leadership Scope
                            </label>
                            <FormSelect
                                value={scope}
                                onChange={(e) => setScope(e.target.value)}
                                className="input-field bg-white"
                                label="Leadership Scope"
                            >
                                <option value="CENTRAL">
                                    Central Executive (No Unit)
                                </option>
                                <option value="UNIT">Unit / Team Head</option>
                                <option value="LEVEL">Level Coordinator</option>
                            </FormSelect>
                        </div>
                    </div>

                    {/* Dynamic Scope Selector */}
                    {scope === "UNIT" && (
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                <Shield className="h-3 w-3" /> Select Unit to
                                Manage
                            </label>
                            <FormSelect name="scopeId" required className="input-field bg-white">
                                <option value="">-- Select Unit --</option>
                                {data?.units?.map((u: any) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name} ({u.type})
                                    </option>
                                ))}
                            </FormSelect>
                        </div>
                    )}

                    {scope === "LEVEL" && (
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                <Users className="h-3 w-3" /> Select Generation
                                to Lead
                            </label>
                            <FormSelect name="scopeId" required className="input-field bg-white">
                                <option value="">-- Select Generation --</option>
                                {data?.families?.map((f: any) => (
                                    <option key={f.id} value={f.id}>
                                        {f.entry_year} Set ({f.family_name})
                                    </option>
                                ))}
                            </FormSelect>
                        </div>
                    )}

                    <button className="w-full bg-rcf-navy text-white py-3 rounded-xl font-bold text-sm hover:bg-opacity-90 transition-all flex justify-center gap-2">
                        <UserCheck className="h-4 w-4" /> Confirm Appointment
                    </button>
                </form>
            )}
        </div>
    );
}
