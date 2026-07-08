/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import {
    UserPlus, Search, Loader2, Crown, Copy, Check, Shield, Plus, ToggleLeft, ToggleRight,
} from "lucide-react";
import {
    searchMembersAction,
    listRolesAction,
    createRoleAction,
    setRoleActiveAction,
    appointLeaderAction,
    getAppointmentOptionsAction,
} from "../actions";
import { createResetInviteAction } from "../../invites/actions";
import { useAlertModal, AlertModal } from "@/components/ui/alert-modal";

const CATEGORIES = ["PRESIDENT", "CENTRAL", "UNIT", "TEAM", "LEVEL", "ZONE"] as const;

export function AppointPanel({ onSuccess }: { onSuccess?: () => void }) {
    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <AppointLeader onSuccess={onSuccess} />
            <RoleManager />
        </div>
    );
}

function AppointLeader({ onSuccess }: { onSuccess?: () => void }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [member, setMember] = useState<any>(null);
    const [roles, setRoles] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);
    const [classSets, setClassSets] = useState<any[]>([]);
    const [roleId, setRoleId] = useState("");
    const [unitId, setUnitId] = useState("");
    const [classSetId, setClassSetId] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [resetLink, setResetLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();

    const origin = typeof window !== "undefined" ? window.location.origin : "";

    useEffect(() => {
        listRolesAction().then((r) => setRoles((r.data || []).filter((p: any) => p.is_active)));
        getAppointmentOptionsAction().then((r) => {
            setUnits(r.units || []);
            setClassSets(r.classSets || []);
        });
    }, []);

    useEffect(() => {
        const q = query.trim();
        const t = setTimeout(async () => {
            if (q.length < 2) {
                setResults([]);
                return;
            }
            setSearching(true);
            const res = await searchMembersAction(q);
            setResults(res.data || []);
            setSearching(false);
        }, 300);
        return () => clearTimeout(t);
    }, [query]);

    const selectedRole = roles.find((r) => r.id === roleId);
    const needsUnit = selectedRole && (selectedRole.category === "UNIT" || selectedRole.category === "TEAM");
    const needsLevel = selectedRole && selectedRole.category === "LEVEL";

    const appoint = async () => {
        if (!member || !roleId) return;
        setSubmitting(true);
        setResetLink(null);
        const res = await appointLeaderAction({
            profileId: member.id,
            positionId: roleId,
            unitId: needsUnit ? unitId : undefined,
            classSetId: needsLevel ? classSetId : undefined,
        });
        setSubmitting(false);
        if (!res.success) {
            showAlert({ type: "error", message: res.error });
            return;
        }
        // Offer a login link so they can set their password.
        const linkRes = await createResetInviteAction(member.id);
        if (linkRes.success && linkRes.token) {
            setResetLink(`${origin}/register?invite=${linkRes.token}`);
        }
        showAlert({ type: "success", message: `${member.first_name} appointed. Share the login link below so they can set a password.` });
        onSuccess?.();
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                <UserPlus className="h-5 w-5 text-rcf-navy" /> Appoint a leader
            </h3>

            {!member ? (
                <>
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search member by name or email…"
                            className="w-full pl-9 h-11 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:border-rcf-navy"
                        />
                        {searching && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-slate-400" />}
                    </div>
                    <div className="mt-2 space-y-1 max-h-56 overflow-y-auto">
                        {results.map((r) => (
                            <button
                                key={r.id}
                                onClick={() => { setMember(r); setResults([]); setQuery(""); }}
                                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 text-left"
                            >
                                <div className="h-9 w-9 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600 text-xs">
                                    {r.first_name?.[0]}{r.last_name?.[0]}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 truncate">{r.first_name} {r.last_name}</p>
                                    <p className="text-[11px] text-slate-500 truncate">{r.email}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600 text-xs">
                                {member.first_name?.[0]}{member.last_name?.[0]}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800">{member.first_name} {member.last_name}</p>
                                <p className="text-[11px] text-slate-500">{member.email}</p>
                            </div>
                        </div>
                        <button onClick={() => { setMember(null); setResetLink(null); }} className="text-xs text-slate-400 hover:text-rcf-navy underline">
                            Change
                        </button>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-slate-600">Leadership role</label>
                        <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="w-full h-11 mt-1 rounded-xl bg-white border border-slate-200 text-sm px-3 outline-none focus:border-rcf-navy">
                            <option value="">Select a role</option>
                            {roles.map((r) => (
                                <option key={r.id} value={r.id}>{r.alias ? `${r.title} (${r.alias})` : r.title} · {r.category}</option>
                            ))}
                        </select>
                    </div>

                    {needsUnit && (
                        <div>
                            <label className="text-xs font-medium text-slate-600">Unit / Team</label>
                            <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="w-full h-11 mt-1 rounded-xl bg-white border border-slate-200 text-sm px-3 outline-none focus:border-rcf-navy">
                                <option value="">Select unit/team</option>
                                {units.filter((u) => u.type === selectedRole.category).map((u) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {needsLevel && (
                        <div>
                            <label className="text-xs font-medium text-slate-600">Generation (level)</label>
                            <select value={classSetId} onChange={(e) => setClassSetId(e.target.value)} className="w-full h-11 mt-1 rounded-xl bg-white border border-slate-200 text-sm px-3 outline-none focus:border-rcf-navy">
                                <option value="">Select generation</option>
                                {classSets.map((c) => (
                                    <option key={c.id} value={c.id}>{c.family_name || "Unnamed"} ({c.entry_year} Set)</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button
                        onClick={appoint}
                        disabled={submitting || !roleId || (needsUnit && !unitId) || (needsLevel && !classSetId)}
                        className="w-full h-11 bg-rcf-navy text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
                        Appoint & provision login
                    </button>

                    {resetLink && (
                        <div className="p-3 rounded-xl bg-green-50 border border-green-100">
                            <p className="text-[11px] font-bold text-green-700 mb-1">Login link (share privately)</p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 text-[11px] text-slate-600 truncate">{resetLink}</code>
                                <button
                                    onClick={async () => { await navigator.clipboard.writeText(resetLink); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                                    className="p-2 text-slate-500 hover:text-rcf-navy"
                                    aria-label="Copy login link"
                                >
                                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function RoleManager() {
    const [roles, setRoles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ title: "", alias: "", category: "CENTRAL" as (typeof CATEGORIES)[number], description: "" });
    const [saving, setSaving] = useState(false);
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();

    const load = async () => {
        setLoading(true);
        const res = await listRolesAction();
        setRoles(res.data || []);
        setLoading(false);
    };
    useEffect(() => {
        let active = true;
        (async () => {
            const res = await listRolesAction();
            if (active) {
                setRoles(res.data || []);
                setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, []);

    const create = async () => {
        if (!form.title.trim()) return;
        setSaving(true);
        const res = await createRoleAction(form);
        setSaving(false);
        if (res.success) {
            setForm({ title: "", alias: "", category: "CENTRAL", description: "" });
            setShowForm(false);
            load();
        } else showAlert({ type: "error", message: res.error });
    };

    const toggle = async (r: any) => {
        const res = await setRoleActiveAction(r.id, !r.is_active);
        if (res.success) load();
        else showAlert({ type: "error", message: res.error });
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-rcf-navy" /> Leadership roles
                </h3>
                <button onClick={() => setShowForm((s) => !s)} className="text-xs font-bold text-rcf-navy flex items-center gap-1 hover:underline">
                    <Plus className="h-4 w-4" /> New role
                </button>
            </div>

            {showForm && (
                <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title (e.g. Welfare Head)" className="h-10 rounded-lg border border-slate-200 text-sm px-3 outline-none focus:border-rcf-navy" />
                        <input value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} placeholder="Alias (e.g. Welfare)" className="h-10 rounded-lg border border-slate-200 text-sm px-3 outline-none focus:border-rcf-navy" />
                    </div>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as any })} className="w-full h-10 rounded-lg border border-slate-200 text-sm px-3 bg-white outline-none focus:border-rcf-navy">
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button onClick={create} disabled={saving} className="w-full h-10 bg-rcf-navy text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create role"}
                    </button>
                </div>
            )}

            {loading ? (
                <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-rcf-navy" /></div>
            ) : (
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                    {roles.map((r) => (
                        <div key={r.id} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">
                                    {r.title}{r.alias ? <span className="text-slate-400 font-normal"> · {r.alias}</span> : null}
                                </p>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wide">{r.category}{r.is_default ? " · protected" : ""}</p>
                            </div>
                            <button
                                onClick={() => toggle(r)}
                                disabled={r.is_default}
                                className={`p-1 ${r.is_default ? "opacity-30 cursor-not-allowed" : "hover:opacity-80"}`}
                                aria-label={r.is_active ? "Disable role" : "Enable role"}
                                title={r.is_default ? "Protected role" : r.is_active ? "Disable" : "Enable"}
                            >
                                {r.is_active ? <ToggleRight className="h-6 w-6 text-green-500" /> : <ToggleLeft className="h-6 w-6 text-slate-300" />}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
