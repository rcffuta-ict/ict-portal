/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useState } from "react";
import {
    KeyRound,
    Copy,
    Check,
    Loader2,
    Trash2,
    UserPlus,
    PencilLine,
    AlertCircle,
    Ban,
} from "lucide-react";
import {
    listLevelInvitesAction,
    generateLevelTokenAction,
    revokeLevelTokenAction,
} from "../actions";
import { useAlertModal, AlertModal } from "@/components/ui/alert-modal";

/**
 * Level tokens.
 *
 * A token is NOT a link — it's a plain string owned by the generation. The two links are
 * derived from it at share time (`?reason=register` / `?reason=update`), so a coordinator
 * can copy the bare token for use elsewhere, or either ready-made link for WhatsApp.
 * Revoking the token kills both links at once.
 */
export function TokenManager({ classSetId }: { classSetId: string }) {
    const [tokens, setTokens] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [label, setLabel] = useState("");
    const [error, setError] = useState<string | null>(null);
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();

    const refresh = useCallback(async () => {
        const res = await listLevelInvitesAction(classSetId);
        if (!res.success) setError(res.error || "Could not load tokens.");
        setTokens(res.data || []);
        setLoading(false);
    }, [classSetId]);

    useEffect(() => {
        let active = true;
        (async () => {
            const res = await listLevelInvitesAction(classSetId);
            if (!active) return;
            if (!res.success) setError(res.error || "Could not load tokens.");
            setTokens(res.data || []);
            setLoading(false);
        })();
        return () => {
            active = false;
        };
    }, [classSetId]);

    const generate = async () => {
        setCreating(true);
        setError(null);
        const res = await generateLevelTokenAction(classSetId, label);
        setCreating(false);
        if (res.success) {
            setLabel("");
            refresh();
        } else {
            setError(res.error || "Could not generate a token.");
        }
    };

    const revoke = (t: any) => {
        showAlert({
            type: "warning",
            title: "Revoke this token?",
            message:
                "Both the registration link and the update link built from it stop working immediately. This can't be undone — generate a new token instead.",
            confirmText: "Revoke",
            onConfirm: async () => {
                const res = await revokeLevelTokenAction(t.id);
                if (res.success) refresh();
                else showAlert({ type: "error", message: res.error });
            },
        });
    };

    const active = tokens.filter((t) => t.is_active);
    const revoked = tokens.filter((t) => !t.is_active);

    return (
        <div className="space-y-5">
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />

            {/* Generate */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <h4 className="flex items-center gap-2 font-bold text-slate-700">
                    <KeyRound className="h-4 w-4" /> Generate a token
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                    One token, two links: people can <strong>register</strong> into this generation,
                    or <strong>update</strong> their own details by confirming their email. Revoke it
                    to kill both at once.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        maxLength={40}
                        placeholder="Label (optional) — e.g. Freshers drive"
                        aria-label="Token label"
                        className="h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rcf-navy focus:outline-none"
                    />
                    <button
                        type="button"
                        onClick={generate}
                        disabled={creating}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rcf-navy px-5 text-sm font-bold text-white hover:bg-opacity-90 disabled:opacity-60"
                    >
                        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                        Generate
                    </button>
                </div>
                {error && (
                    <p className="mt-3 flex items-start gap-1.5 text-xs text-red-600">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
                    </p>
                )}
            </section>

            {loading ? (
                <div className="space-y-3">
                    {[0, 1].map((i) => (
                        <div key={i} className="h-40 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />
                    ))}
                </div>
            ) : (
                <>
                    <div className="space-y-3">
                        <h5 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                            Active ({active.length})
                        </h5>
                        {active.length === 0 ? (
                            <p className="rounded-xl border-2 border-dashed border-slate-100 py-8 text-center text-sm text-slate-400">
                                No active token. Generate one to start collecting members.
                            </p>
                        ) : (
                            active.map((t) => <TokenCard key={t.id} token={t} onRevoke={() => revoke(t)} />)
                        )}
                    </div>

                    {revoked.length > 0 && (
                        <div className="space-y-3">
                            <h5 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                                Revoked ({revoked.length})
                            </h5>
                            {revoked.map((t) => (
                                <TokenCard key={t.id} token={t} />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function TokenCard({ token, onRevoke }: { token: any; onRevoke?: () => void }) {
    const [copied, setCopied] = useState<string | null>(null);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const registerUrl = `${origin}/register?invite=${token.token}&reason=register`;
    const updateUrl = `${origin}/register?invite=${token.token}&reason=update`;
    const dead = !token.is_active;

    const copy = async (key: string, value: string) => {
        await navigator.clipboard.writeText(value);
        setCopied(key);
        setTimeout(() => setCopied(null), 1500);
    };

    return (
        <article
            className={`rounded-2xl border p-4 shadow-sm ${
                dead ? "border-slate-200 bg-slate-50 opacity-75" : "border-slate-200 bg-white"
            }`}
        >
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <h5 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        {dead ? <Ban className="h-4 w-4 text-slate-400" /> : <KeyRound className="h-4 w-4 text-rcf-navy" />}
                        {token.label || "Level token"}
                    </h5>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                        {token.use_count} use{token.use_count === 1 ? "" : "s"}
                        {token.created_by_name ? ` · by ${token.created_by_name}` : ""}
                        {token.created_at ? ` · ${new Date(token.created_at).toLocaleDateString()}` : ""}
                        {dead && token.revoked_at
                            ? ` · revoked ${new Date(token.revoked_at).toLocaleDateString()}`
                            : ""}
                    </p>
                </div>
                {onRevoke && (
                    <button
                        type="button"
                        onClick={onRevoke}
                        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-red-100 px-3 text-xs font-bold text-red-500 hover:bg-red-50"
                    >
                        <Trash2 className="h-3.5 w-3.5" /> Revoke
                    </button>
                )}
            </div>

            {/* The token itself — copyable on its own, because it's used outside links too. */}
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700">
                    {token.token}
                </code>
                <button
                    type="button"
                    onClick={() => copy("token", token.token)}
                    aria-label="Copy token"
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-white px-2.5 text-[11px] font-bold text-slate-600 shadow-sm hover:text-rcf-navy"
                >
                    {copied === "token" ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                        <Copy className="h-3.5 w-3.5" />
                    )}
                    Token
                </button>
            </div>

            {!dead && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <CopyLinkButton
                        icon={UserPlus}
                        label="Copy register link"
                        hint="For new members"
                        copied={copied === "register"}
                        onCopy={() => copy("register", registerUrl)}
                    />
                    <CopyLinkButton
                        icon={PencilLine}
                        label="Copy update link"
                        hint="Existing members edit their own details"
                        copied={copied === "update"}
                        onCopy={() => copy("update", updateUrl)}
                    />
                </div>
            )}
        </article>
    );
}

function CopyLinkButton({
    icon: Icon,
    label,
    hint,
    copied,
    onCopy,
}: {
    icon: any;
    label: string;
    hint: string;
    copied: boolean;
    onCopy: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onCopy}
            className="flex items-center gap-2.5 rounded-xl border border-slate-200 p-3 text-left transition-colors hover:border-rcf-navy/40 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rcf-navy"
        >
            <span className="rounded-lg bg-rcf-navy/5 p-2 text-rcf-navy">
                <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-slate-800">{label}</span>
                <span className="block truncate text-[10px] text-slate-400">{hint}</span>
            </span>
            {copied ? (
                <Check className="h-4 w-4 shrink-0 text-green-500" />
            ) : (
                <Copy className="h-4 w-4 shrink-0 text-slate-300" />
            )}
        </button>
    );
}
