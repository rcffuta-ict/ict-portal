/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { Search, Phone, User, MapPin } from "lucide-react";
import { useState } from "react";

export function PastorView({ data }: any) {
    const [search, setSearch] = useState("");

    const members = data.myZoneMembers.filter(
        (m: any) =>
            m.first_name.toLowerCase().includes(search.toLowerCase()) ||
            m.last_name.toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row justify-between gap-4 items-center bg-slate-50/50">
                <div>
                    <h3 className="font-bold text-slate-900 text-lg">
                        My Zone Members
                    </h3>
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" /> Managing {members.length}{" "}
                        Brethren
                    </p>
                </div>
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name..."
                        className="pl-9 h-10 w-full rounded-xl bg-white border border-slate-200 text-sm focus:ring-2 ring-rcf-navy outline-none shadow-sm"
                    />
                </div>
            </div>

            {/* List */}
            <div className="divide-y divide-slate-100">
                {members.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <User className="h-10 w-10 mb-2 opacity-20" />
                        <p>No members found in your zone.</p>
                    </div>
                ) : (
                    members.map((m: any) => (
                        <div
                            key={m.id}
                            className="p-4 flex items-center justify-between hover:bg-blue-50/30 transition-colors group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold overflow-hidden border border-slate-200">
                                    {m.avatar_url ? (
                                        <img
                                            src={m.avatar_url}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <span>
                                            {m.first_name[0]}
                                            {m.last_name[0]}
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <p className="font-bold text-sm text-slate-900">
                                        {m.first_name} {m.last_name}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <span>{m.department}</span>
                                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                        <span className="truncate max-w-[150px]">
                                            {m.school_address || "No Address"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <a
                                href={`tel:${m.phone_number}`}
                                className="flex items-center gap-2 text-xs font-bold text-rcf-navy bg-white border border-slate-200 px-4 py-2 rounded-lg hover:bg-rcf-navy hover:text-white transition-all shadow-sm"
                            >
                                <Phone className="h-3.5 w-3.5" />{" "}
                                <span className="hidden sm:inline">Call</span>
                            </a>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
