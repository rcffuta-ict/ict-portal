/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback, useRef } from "react";
import {
    searchMemberAction,
    assignLeaderAction,
    createPositionAction,
    togglePositionAction,
    setPositionPrivilegesAction,
    removeUnitLeaderAction,
} from "../actions";
import {
    Search,
    UserCheck,
    Settings,
    Plus,
    Power,
    CheckCircle,
    List,
    Trash2,
    Phone,
    GraduationCap,
    Loader2,
    ShieldCheck,
    Pencil,
    X,
    Users,
} from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import FormSelect from "@/components/ui/FormSelect";
import { AlertModal, useAlertModal } from "@/components/ui/alert-modal";
import { PrivilegeBuilder } from "./privilege-builder";
import { PrivilegePills } from "./privilege-pills";
import { normalizePrivileges } from "@/lib/privileges";
import type { Privilege } from "@/lib/modules";

export function CabinetTab({ data, onSuccess }: any) {
    const [mode, setMode] = useState<"LIST" | "APPOINT" | "CONFIGURE">("LIST");
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();

    return (
        <>
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />

            <div className="mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
                <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                        <h3 className="font-bold text-slate-900">Leadership Management</h3>
                        <p className="text-xs text-slate-500">
                            Active Tenure: {data?.activeTenure?.name}
                        </p>
                    </div>

                    <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                        {(
                            [
                                ["LIST", List, "Roster"],
                                ["APPOINT", UserCheck, "Appoint"],
                                ["CONFIGURE", Settings, "Roles"],
                            ] as const
                        ).map(([m, Icon, label]) => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
                                    mode === m
                                        ? "bg-rcf-navy text-white shadow-sm"
                                        : "text-slate-500 hover:bg-slate-50"
                                }`}
                            >
                                <Icon className="h-3 w-3" /> {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-0 sm:p-8">
                    {mode === "LIST" && (
                        <RosterView data={data} onSuccess={onSuccess} showAlert={showAlert} />
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
                        <ConfigurationView data={data} onSuccess={onSuccess} showAlert={showAlert} />
                    )}
                </div>
            </div>
        </>
    );
}

// --- SUB-COMPONENT 1: ROSTER ---
function RosterView({ data, onSuccess, showAlert }: any) {
    const leaders = data?.leadership || [];
    const [search, setSearch] = useState("");

    const filtered = leaders.filter(
        (l: any) =>
            l.profile.first_name.toLowerCase().includes(search.toLowerCase()) ||
            l.profile.last_name.toLowerCase().includes(search.toLowerCase()) ||
            l.position.title.toLowerCase().includes(search.toLowerCase()),
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
                            <th className="px-6 py-3">Priviledges</th>
                            <th className="px-6 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-slate-400">
                                    No leaders found.
                                </td>
                            </tr>
                        )}
                        {filtered.map((l: any) => (
                            <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                            {l.profile.first_name[0]}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900">
                                                {l.profile.first_name} {l.profile.last_name}
                                            </p>
                                            <p className="text-[10px] text-slate-500">
                                                {l.profile.phone_number}
                                            </p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-medium text-slate-700">
                                            {l.position.title}
                                        </span>
                                        {l.is_lead === false && (
                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200">
                                                Assistant
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <PrivilegePills
                                        privileges={l.position?.position_privileges}
                                        slug={l.position?.slug}
                                        emptyLabel="—"
                                    />
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => handleRevoke(l.id)}
                                        className="text-slate-300 hover:text-red-500 transition-colors p-2"
                                        aria-label="Revoke leadership"
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

// --- SUB-COMPONENT 2: APPOINT ---
function AppointmentView({ data, onSuccess, showAlert }: any) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [selectedPosId, setSelectedPosId] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const selectedPosition = data?.positions?.find((p: any) => p.id === selectedPosId);
    const activePositions = data?.positions?.filter((p: any) => p.is_active);

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
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
    }, []);

    const handleAssign = async (formData: FormData) => {
        if (!selectedUser || !data?.activeTenure) return;
        setSubmitting(true);
        formData.append("profileId", selectedUser.id);
        formData.append("tenureId", data.activeTenure.id);
        const res = await assignLeaderAction(formData);
        setSubmitting(false);
        if (res.success) {
            // Appointment also grants portal access, so say so — otherwise nobody knows
            // to tell the appointee they can now sign in and set a password.
            if (res.warning) {
                showAlert({ type: "error", message: res.warning });
            } else {
                showAlert({
                    type: "success",
                    message: res.loginCreated
                        ? "Leader appointed. They can now sign in and set their password."
                        : "Leader appointed successfully!",
                });
            }
            onSuccess();
            setSelectedUser(null);
            setQuery("");
            setSelectedPosId("");
        } else {
            showAlert({ type: "error", message: res.error });
        }
    };

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-0 space-y-8 animate-in fade-in">
            {!selectedUser ? (
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-xs">
                                1
                            </span>
                            Find Member
                        </label>
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

                    <div className="space-y-2">
                        {results.length > 0 && (
                            <p className="text-xs font-bold text-slate-400 uppercase">
                                {results.length} result{results.length === 1 ? "" : "s"}
                            </p>
                        )}

                        {results.map((user) => (
                            <button
                                type="button"
                                key={user.id}
                                onClick={() => setSelectedUser(user)}
                                className="group w-full text-left p-3 border border-slate-200 rounded-xl hover:border-rcf-navy hover:bg-slate-50 flex items-center gap-3 transition-all"
                            >
                                <div className="h-11 w-11 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                                    {user.avatar_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        <span className="text-xs font-bold text-slate-500">
                                            {user.first_name?.[0]}
                                            {user.last_name?.[0]}
                                        </span>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-bold text-slate-900 leading-tight truncate group-hover:text-rcf-navy">
                                        {user.first_name} {user.last_name}
                                    </p>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                                        <span className="inline-flex items-center gap-1">
                                            <GraduationCap className="h-3 w-3" /> {user.level || "—"}
                                        </span>
                                        {user.units && (
                                            <span className="inline-flex items-center gap-1 text-blue-600">
                                                <Users className="h-3 w-3" /> {user.units}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}

                        {query.length > 2 && results.length === 0 && !isSearching && (
                            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                                {`No member found matching "${query}"`}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <form action={handleAssign} className="space-y-8 animate-in slide-in-from-right-8">
                    {/* Selected member */}
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

                        <div className="p-5 bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-2xl flex items-center gap-4 shadow-sm">
                            <div className="h-16 w-16 rounded-full bg-blue-100 border-4 border-white shadow-md flex items-center justify-center text-xl font-bold text-blue-700 overflow-hidden shrink-0">
                                {selectedUser.avatar_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={selectedUser.avatar_url} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    `${selectedUser.first_name[0]}${selectedUser.last_name[0]}`
                                )}
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-xl font-bold text-slate-900 truncate">
                                    {selectedUser.first_name} {selectedUser.last_name}
                                </h2>
                                <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-medium text-slate-500">
                                    <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200">
                                        <GraduationCap className="h-3 w-3" /> {selectedUser.level || "—"}
                                    </span>
                                    {selectedUser.phone_number && (
                                        <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200">
                                            <Phone className="h-3 w-3" /> {selectedUser.phone_number}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Role */}
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                        <label className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-xs">
                                2
                            </span>
                            Assign Role
                        </label>

                        <FormSelect
                            label="Position"
                            name="positionId"
                            required
                            value={selectedPosId}
                            onChange={(e) => setSelectedPosId(e.target.value)}
                        >
                            <option value="">-- Select Position --</option>
                            {activePositions?.map((p: any) => (
                                <option key={p.id} value={p.id}>
                                    {p.title}
                                </option>
                            ))}
                        </FormSelect>

                        {selectedPosition && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                    This role grants
                                </p>
                                <PrivilegePills
                                    privileges={selectedPosition.position_privileges}
                                    slug={selectedPosition.slug}
                                    emptyLabel="No module access"
                                />
                            </div>
                        )}

                        <label className="flex items-start gap-2 text-sm text-slate-600 p-4 rounded-xl bg-slate-50 border border-slate-100">
                            <input type="checkbox" name="isLead" value="false" className="mt-0.5" />
                            <span>
                                Appoint as <b>assistant / sub-leader</b> — shares the coordinator&apos;s
                                privileges, but only the lead is recognised on the roster.
                            </span>
                        </label>

                        <button
                            disabled={submitting}
                            className="w-full h-14 bg-rcf-navy text-white text-base rounded-xl font-bold shadow-xl shadow-rcf-navy/20 hover:bg-opacity-90 hover:-translate-y-0.5 transition-all flex justify-center items-center gap-3 disabled:opacity-60 disabled:hover:translate-y-0"
                        >
                            {submitting ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <CheckCircle className="h-5 w-5" />
                            )}
                            {submitting ? "Appointing…" : "Confirm Appointment"}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

// --- SUB-COMPONENT 3: ROLES / CONFIGURE ---
function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function ConfigurationView({ data, onSuccess, showAlert }: any) {
    const units = (data?.units ?? []).map((u: any) => ({
        id: u.id,
        name: u.name,
        type: u.type,
        slug: u.slug,
    }));

    // Create-role form state.
    const [alias, setAlias] = useState("");
    const [slug, setSlug] = useState("");
    const [slugTouched, setSlugTouched] = useState(false);
    const [privileges, setPrivileges] = useState<Privilege[]>([]);
    const [creating, setCreating] = useState(false);

    // Edit-privileges modal state.
    const [editing, setEditing] = useState<any | null>(null);

    function onAliasChange(value: string) {
        setAlias(value);
        if (!slugTouched) setSlug(slugify(value));
    }

    async function handleCreate(formData: FormData) {
        setCreating(true);
        formData.set("privileges", JSON.stringify(privileges));
        const res = await createPositionAction(formData);
        setCreating(false);
        if (res.success) {
            setAlias("");
            setSlug("");
            setSlugTouched(false);
            setPrivileges([]);
            onSuccess();
        } else showAlert({ type: "error", message: res.error });
    }

    async function toggleStatus(id: string, currentStatus: boolean, posData: any) {
        showAlert({
            type: "warning",
            title: `${currentStatus ? "Deactivate" : "Activate"} Role?`,
            message: `Are you sure you want to ${currentStatus ? "deactivate" : "activate"} this role?`,
            confirmText: currentStatus ? "Deactivate" : "Activate",
            onConfirm: async () => {
                await togglePositionAction(id, currentStatus, posData);
                onSuccess();
            },
        });
    }

    return (
        <div className="grid gap-8 lg:grid-cols-3 animate-in slide-in-from-right-4 px-4 sm:px-0">
            {/* Create role */}
            <div className="lg:col-span-1">
                <form
                    action={handleCreate}
                    className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4"
                >
                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                        <Plus className="h-4 w-4" /> Create New Role
                    </h4>

                    <FormInput name="title" label="Role Title" required placeholder="e.g. Media Head" />
                    <FormInput
                        name="alias"
                        label="Alias (short name)"
                        value={alias}
                        onChange={(e) => onAliasChange(e.target.value)}
                        placeholder="e.g. Media"
                    />
                    <div className="space-y-1">
                        <FormInput
                            name="slug"
                            label="Slug (permanent)"
                            value={slug}
                            onChange={(e) => {
                                setSlugTouched(true);
                                setSlug(slugify(e.target.value));
                            }}
                            placeholder="e.g. media-head"
                        />
                        <p className="text-[10px] text-slate-400">
                            Auto-filled from the alias. Stable handle used by access settings; can&apos;t
                            change once created.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <span className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                            <ShieldCheck className="h-4 w-4 text-rcf-navy" /> Privileges &amp; scope
                        </span>
                        <PrivilegeBuilder value={privileges} onChange={setPrivileges} units={units} />
                    </div>

                    <FormInput name="description" label="Description" placeholder="Role description..." />

                    <button
                        disabled={creating}
                        className="btn-primary w-full text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                        {creating ? "Creating…" : "Add to Master List"}
                    </button>
                </form>
            </div>

            {/* Positions table */}
            <div className="lg:col-span-2 border border-slate-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left min-w-[520px]">
                        <thead className="bg-slate-100 text-slate-500 font-bold text-xs uppercase">
                            <tr>
                                <th className="px-4 py-3">Title</th>
                                <th className="px-4 py-3">Priviledges</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data?.positions?.map((pos: any) => {
                                const isSysAdmin = pos.slug === "ict-coord";
                                return (
                                    <tr key={pos.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium text-slate-900 align-top">
                                            {pos.title}
                                            {pos.slug && (
                                                <span className="block font-mono text-[10px] font-normal text-slate-400">
                                                    {pos.slug}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <PrivilegePills
                                                privileges={pos.position_privileges}
                                                slug={pos.slug}
                                                emptyLabel="None"
                                            />
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <div className="flex items-center justify-end gap-3">
                                                {!isSysAdmin && (
                                                    <button
                                                        onClick={() =>
                                                            setEditing({
                                                                ...pos,
                                                                _privileges: normalizePrivileges(
                                                                    pos.position_privileges,
                                                                ),
                                                            })
                                                        }
                                                        title="Edit privileges"
                                                        className="text-xs font-bold text-rcf-navy hover:text-rcf-navy-light flex items-center gap-1"
                                                    >
                                                        <Pencil className="h-3 w-3" /> Edit
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => toggleStatus(pos.id, pos.is_active, pos)}
                                                    className={`text-xs font-bold flex items-center gap-1 ${
                                                        pos.is_active
                                                            ? "text-green-600 hover:text-green-800"
                                                            : "text-slate-400 hover:text-slate-600"
                                                    }`}
                                                >
                                                    <Power className="h-3 w-3" />
                                                    {pos.is_active ? "Active" : "Inactive"}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {editing && (
                <EditPrivilegesModal
                    position={editing}
                    units={units}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        onSuccess();
                    }}
                    showAlert={showAlert}
                />
            )}
        </div>
    );
}

function EditPrivilegesModal({ position, units, onClose, onSaved, showAlert }: any) {
    const [privileges, setPrivileges] = useState<Privilege[]>(position._privileges ?? []);
    const [saving, setSaving] = useState(false);

    async function save() {
        setSaving(true);
        const res = await setPositionPrivilegesAction(position.id, privileges);
        setSaving(false);
        if (res.success) onSaved();
        else showAlert({ type: "error", message: res.error });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="font-bold text-slate-900">Edit Privileges</h3>
                        <p className="text-xs text-slate-500">{position.title}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5 text-slate-500" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto">
                    <PrivilegeBuilder value={privileges} onChange={setPrivileges} units={units} />
                </div>
                <div className="flex gap-3 border-t border-slate-100 bg-slate-50 p-4 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-white"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={save}
                        disabled={saving}
                        className="flex-1 py-2.5 bg-rcf-navy text-white rounded-xl text-sm font-bold hover:bg-opacity-90 flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        {saving ? "Saving…" : "Save Privileges"}
                    </button>
                </div>
            </div>
        </div>
    );
}
