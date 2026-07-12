/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Users,
    Link2,
    Copy,
    Check,
    Trash2,
    Loader2,
    Mail,
    Phone,
    Lock,
    ChevronRight,
} from "lucide-react";
import { getLevelMembersAction } from "../actions";
import {
    createMemberInviteAction,
    listMyInvitesAction,
    revokeInviteAction,
} from "../../invites/actions";
import { useAlertModal, AlertModal } from "@/components/ui/alert-modal";

export function GenerationDetail({ generation }: { generation: any }) {
    const [members, setMembers] = useState<any[]>([]);
    const [invites, setInvites] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const canWrite = generation.canWrite;

    const refresh = async () => {
        setLoading(true);
        const [m, inv] = await Promise.all([
            getLevelMembersAction(generation.classSetId),
            canWrite ? listMyInvitesAction() : Promise.resolve({ data: [] }),
        ]);
        setMembers(m.data || []);
        setInvites(
            (inv.data || []).filter(
                (i: any) => i.class_set_id === generation.classSetId && i.purpose !== "reset",
            ),
        );
        setLoading(false);
    };

    useEffect(() => {
        let active = true;
        (async () => {
            const [m, inv] = await Promise.all([
                getLevelMembersAction(generation.classSetId),
                canWrite ? listMyInvitesAction() : Promise.resolve({ data: [] }),
            ]);
            if (!active) return;
            setMembers(m.data || []);
            setInvites(
                (inv.data || []).filter(
                    (i: any) => i.class_set_id === generation.classSetId && i.purpose !== "reset",
                ),
            );
            setLoading(false);
        })();
        return () => {
            active = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [generation.classSetId]);

    const generate = async () => {
        setCreating(true);
        const res = await createMemberInviteAction("create", generation.classSetId);
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
        <div className="space-y-8">
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />

            {/* Invite links (coordinators only) */}
            {canWrite ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
                        Share a link so someone can create a profile in this generation. Their level is
                        set automatically. Revoke anytime.
                    </p>
                    <div className="space-y-2">
                        {invites.map((i) => (
                            <div key={i.id} className="flex items-center gap-2 p-2 border border-slate-100 rounded-lg bg-slate-50">
                                <code className="flex-1 text-xs text-slate-600 truncate">
                                    {origin}/register?invite={i.token}
                                </code>
                                <span className="text-[10px] text-slate-400 shrink-0">{i.use_count} used</span>
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
            ) : (
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5">
                    <Lock className="h-3.5 w-3.5" /> View-only access — only this level&apos;s coordinator can add members.
                </div>
            )}

            {/* Members */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="font-bold text-slate-700 flex items-center gap-2 mb-3">
                    <Users className="h-4 w-4" /> Members ({members.length})
                </h4>
                {loading ? (
                    <div className="py-8 flex justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-rcf-navy" />
                    </div>
                ) : (
                    <div className="space-y-2">
                        {members.map((m) => (
                            <Link
                                key={m.id}
                                href={`/dashboard/level/${generation.classSetId}/member/${m.id}`}
                                className="w-full text-left flex items-center gap-3 p-3 border border-slate-100 rounded-xl hover:border-rcf-navy/30 hover:bg-slate-50 transition-colors"
                            >
                                <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center font-bold text-emerald-700 text-xs shrink-0">
                                    {m.first_name?.[0]}{m.last_name?.[0]}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-bold text-sm text-slate-900 truncate">
                                        {m.first_name} {m.last_name}
                                    </p>
                                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
                                        {m.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" /> {m.email}</span>}
                                        {m.phone_number && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {m.phone_number}</span>}
                                    </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                            </Link>
                        ))}
                        {members.length === 0 && (
                            <p className="text-sm text-slate-400 py-8 text-center border-2 border-dashed border-slate-100 rounded-xl">
                                No members yet.
                            </p>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
}
