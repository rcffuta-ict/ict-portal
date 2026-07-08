/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Users, X, Link2, Copy, Check, Trash2, Loader2, Mail, Phone } from "lucide-react";
import { getLevelMembersAction } from "../actions";
import {
    createMemberInviteAction,
    listMyInvitesAction,
    revokeInviteAction,
} from "../../invites/actions";
import { useAlertModal, AlertModal } from "@/components/ui/alert-modal";

/**
 * Level-coordinator view: see the members in your generation and manage the
 * revocable registration/update links that let people self-index into it.
 */
export function LevelView({ levels }: { levels: any[]; onSuccess?: () => void }) {
    const [selected, setSelected] = useState<any>(null);

    return (
        <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {levels.map((lvl) => (
                    <button
                        key={lvl.classSetId}
                        onClick={() => setSelected(lvl)}
                        className="group text-left bg-white p-6 rounded-2xl border border-slate-200 hover:border-rcf-navy/30 hover:shadow-lg transition-all relative overflow-hidden"
                    >
                        <div className="absolute -right-4 -top-4 text-slate-50 group-hover:text-emerald-50 transition-colors">
                            <GraduationCap className="h-24 w-24" />
                        </div>
                        <div className="relative z-10">
                            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 w-fit mb-4">
                                <GraduationCap className="h-6 w-6" />
                            </div>
                            <h3 className="font-bold text-xl text-slate-900">{lvl.familyName || "Unnamed Generation"}</h3>
                            <p className="text-xs font-bold text-rcf-navy uppercase tracking-wide opacity-80 mt-1">
                                {lvl.level || "—"} · {lvl.entryYear} Set
                            </p>
                            <div className="mt-6 flex items-center text-sm font-bold text-slate-400 group-hover:text-rcf-navy transition-colors">
                                Manage members & links
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {selected && <LevelModal level={selected} onClose={() => setSelected(null)} />}
        </>
    );
}

function LevelModal({ level, onClose }: { level: any; onClose: () => void }) {
    const [members, setMembers] = useState<any[]>([]);
    const [invites, setInvites] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();

    const origin = typeof window !== "undefined" ? window.location.origin : "";

    const refresh = async () => {
        setLoading(true);
        const [m, inv] = await Promise.all([getLevelMembersAction(level.classSetId), listMyInvitesAction()]);
        setMembers(m.data || []);
        setInvites((inv.data || []).filter((i: any) => i.class_set_id === level.classSetId && i.purpose !== "reset"));
        setLoading(false);
    };

    useEffect(() => {
        let active = true;
        (async () => {
            const [m, inv] = await Promise.all([getLevelMembersAction(level.classSetId), listMyInvitesAction()]);
            if (!active) return;
            setMembers(m.data || []);
            setInvites((inv.data || []).filter((i: any) => i.class_set_id === level.classSetId && i.purpose !== "reset"));
            setLoading(false);
        })();
        return () => {
            active = false;
        };
    }, [level.classSetId]);

    const generate = async () => {
        setCreating(true);
        const res = await createMemberInviteAction("create", level.classSetId);
        setCreating(false);
        if (res.success) refresh();
        else showAlert({ type: "error", message: res.error });
    };

    const copy = async (token: string) => {
        await navigator.clipboard.writeText(`${origin}/register?invite=${token}`);
        setCopied(token);
        setTimeout(() => setCopied(null), 1500);
    };

    const revoke = (id: string) => {
        showAlert({
            type: "warning",
            title: "Revoke link?",
            message: "Anyone holding this link will no longer be able to use it.",
            confirmText: "Revoke",
            onConfirm: async () => {
                const res = await revokeInviteAction(id);
                if (res.success) refresh();
                else showAlert({ type: "error", message: res.error });
            },
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-slate-900">{level.familyName || "Generation"}</h3>
                        <p className="text-xs text-slate-500">{level.level} · {level.entryYear} Set</p>
                    </div>
                    <button onClick={onClose} aria-label="Close">
                        <X className="h-6 w-6 text-slate-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Invite links */}
                    <section>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="font-bold text-slate-700 flex items-center gap-2">
                                <Link2 className="h-4 w-4" /> Registration links
                            </h4>
                            <button
                                onClick={generate}
                                disabled={creating}
                                className="h-9 bg-rcf-navy text-white px-4 rounded-lg font-bold text-xs hover:bg-opacity-90 flex items-center gap-2 disabled:opacity-60"
                            >
                                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                                Generate link
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mb-3">
                            Share a link so someone can create a profile in this generation. Revoke it anytime.
                        </p>
                        <div className="space-y-2">
                            {invites.map((i) => (
                                <div key={i.id} className="flex items-center gap-2 p-2 border border-slate-100 rounded-lg bg-slate-50">
                                    <code className="flex-1 text-xs text-slate-600 truncate">{origin}/register?invite={i.token}</code>
                                    <span className="text-[10px] text-slate-400">{i.use_count} used</span>
                                    <button onClick={() => copy(i.token)} className="p-2 text-slate-400 hover:text-rcf-navy" aria-label="Copy link">
                                        {copied === i.token ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                    </button>
                                    <button onClick={() => revoke(i.id)} className="p-2 text-slate-300 hover:text-red-500" aria-label="Revoke link">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                            {!loading && invites.length === 0 && (
                                <p className="text-xs text-slate-400 py-2">No active links yet.</p>
                            )}
                        </div>
                    </section>

                    {/* Members */}
                    <section>
                        <h4 className="font-bold text-slate-700 flex items-center gap-2 mb-3">
                            <Users className="h-4 w-4" /> Members ({members.length})
                        </h4>
                        {loading ? (
                            <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-rcf-navy" /></div>
                        ) : (
                            <div className="space-y-2">
                                {members.map((m) => (
                                    <div key={m.id} className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl">
                                        <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center font-bold text-emerald-700 text-xs">
                                            {m.first_name?.[0]}{m.last_name?.[0]}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-sm text-slate-900 truncate">{m.first_name} {m.last_name}</p>
                                            <div className="flex items-center gap-3 text-[10px] text-slate-500">
                                                {m.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" /> {m.email}</span>}
                                                {m.phone_number && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {m.phone_number}</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {members.length === 0 && (
                                    <p className="text-sm text-slate-400 py-8 text-center border-2 border-dashed border-slate-100 rounded-xl">
                                        No members yet. Share a registration link to add them.
                                    </p>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
