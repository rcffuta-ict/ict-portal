/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
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
    RefreshCw,
} from "lucide-react";
import {
    listLevelInvitesAction,
    generateLevelTokenAction,
    revokeLevelTokenAction,
} from "../actions";
import { useAlertModal, AlertModal } from "@/components/ui/alert-modal";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

/**
 * The level's token.
 *
 * A generation has exactly ONE active token, and it is not a link — it's a plain string
 * the coordinator shares, from which both links are derived at copy time
 * (`?reason=register` / `?reason=update`). Rotating replaces it: the old token is revoked
 * in the same call, so every link built from it dies at once. Past tokens stay listed
 * (revoked) so the activity trail still makes sense.
 */
export function TokenManager({
    classSetId,
    initialTokens,
}: {
    classSetId: string;
    /** Server-rendered first load, so the tab has no spinner on open. */
    initialTokens?: any[];
}) {
    const [tokens, setTokens] = useState<any[]>(initialTokens ?? []);
    const [loading, setLoading] = useState(!initialTokens);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();

    useEffect(() => {
        if (initialTokens) return;
        let active = true;
        (async () => {
            const res = await listLevelInvitesAction(classSetId);
            if (!active) return;
            if (!res.success) setError(res.error || "Could not load the token.");
            setTokens(res.data || []);
            setLoading(false);
        })();
        return () => {
            active = false;
        };
    }, [classSetId, initialTokens]);

    const reload = async () => {
        const res = await listLevelInvitesAction(classSetId);
        if (!res.success) setError(res.error || "Could not load the token.");
        setTokens(res.data || []);
    };

    const active = tokens.find((t) => t.is_active) || null;
    const past = tokens.filter((t) => !t.is_active);

    const doGenerate = async () => {
        setBusy(true);
        setError(null);
        const res = await generateLevelTokenAction(classSetId);
        if (!res.success) setError(res.error || "Could not generate a token.");
        await reload();
        setBusy(false);
    };

    const generate = () => {
        if (!active) return doGenerate();
        showAlert({
            type: "warning",
            title: "Replace the current token?",
            message:
                "This level can only have one token. The current one is revoked immediately — anyone still holding the old registration or update link will be turned away, and you'll need to reshare the new one.",
            confirmText: "Replace token",
            onConfirm: doGenerate,
        });
    };

    const revoke = () => {
        if (!active) return;
        showAlert({
            type: "warning",
            title: "Revoke this token?",
            message:
                "Registration and updates for this level stop working until you generate a new token.",
            confirmText: "Revoke",
            onConfirm: async () => {
                setBusy(true);
                const res = await revokeLevelTokenAction(active.id);
                if (!res.success) showAlert({ type: "error", message: res.error });
                await reload();
                setBusy(false);
            },
        });
    };

    if (loading) return <TokenSkeleton />;

    return (
        <div className="space-y-5">
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />

            {error && (
                <p className="flex items-start gap-1.5 text-xs text-red-600">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
                </p>
            )}

            {active ? (
                <ActiveToken token={active} busy={busy} onRotate={generate} onRevoke={revoke} />
            ) : (
                <section className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
                    <span className="mb-3 rounded-xl bg-rcf-navy/5 p-3 text-rcf-navy">
                        <KeyRound className="h-6 w-6" />
                    </span>
                    <h4 className="font-bold text-slate-800">No active token</h4>
                    <p className="mt-1 max-w-sm text-sm text-slate-500">
                        Generate this level&apos;s token to let people register into the generation
                        and update their own details. One token covers both.
                    </p>
                    <button
                        type="button"
                        onClick={generate}
                        disabled={busy}
                        className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-rcf-navy px-5 text-sm font-bold text-white hover:bg-opacity-90 disabled:opacity-60"
                    >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                        Generate token
                    </button>
                </section>
            )}

            {past.length > 0 && (
                <section className="space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Previously used ({past.length})
                    </h5>
                    {past.map((t) => (
                        <div
                            key={t.id}
                            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
                        >
                            <Ban className="h-4 w-4 shrink-0 text-slate-400" />
                            <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-500">
                                {t.token}
                            </code>
                            <span className="shrink-0 text-[10px] text-slate-400">
                                {t.use_count} use{t.use_count === 1 ? "" : "s"}
                                {t.revoked_at
                                    ? ` · revoked ${new Date(t.revoked_at).toLocaleDateString()}`
                                    : ""}
                            </span>
                        </div>
                    ))}
                </section>
            )}
        </div>
    );
}

function ActiveToken({
    token,
    busy,
    onRotate,
    onRevoke,
}: {
    token: any;
    busy: boolean;
    onRotate: () => void;
    onRevoke: () => void;
}) {
    const [copied, setCopied] = useState<string | null>(null);
    const origin = typeof window !== "undefined" ? window.location.origin : "";

    const copy = async (key: string, value: string) => {
        await navigator.clipboard.writeText(value);
        setCopied(key);
        setTimeout(() => setCopied(null), 1500);
    };

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h4 className="flex items-center gap-2 font-bold text-slate-800">
                        <span className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600">
                            <KeyRound className="h-4 w-4" />
                        </span>
                        Active token
                    </h4>
                    <p className="mt-1 text-[11px] text-slate-500">
                        {token.use_count} use{token.use_count === 1 ? "" : "s"}
                        {token.created_by_name ? ` · by ${token.created_by_name}` : ""}
                        {token.created_at
                            ? ` · since ${new Date(token.created_at).toLocaleDateString()}`
                            : ""}
                    </p>
                </div>
                <div className="flex shrink-0 gap-2">
                    <button
                        type="button"
                        onClick={onRotate}
                        disabled={busy}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:border-rcf-navy/40 hover:text-rcf-navy disabled:opacity-60"
                    >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        Replace
                    </button>
                    <button
                        type="button"
                        onClick={onRevoke}
                        disabled={busy}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-100 px-3 text-xs font-bold text-red-500 hover:bg-red-50 disabled:opacity-60"
                    >
                        <Trash2 className="h-3.5 w-3.5" /> Revoke
                    </button>
                </div>
            </div>

            {/* The token on its own — it's used outside these two links too. */}
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700">
                    {token.token}
                </code>
                <button
                    type="button"
                    onClick={() => copy("token", token.token)}
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

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <CopyLinkButton
                    icon={UserPlus}
                    label="Copy register link"
                    hint="For new members"
                    copied={copied === "register"}
                    onCopy={() => copy("register", `${origin}/register?invite=${token.token}&reason=register`)}
                />
                <CopyLinkButton
                    icon={PencilLine}
                    label="Copy update link"
                    hint="Members edit their own details"
                    copied={copied === "update"}
                    onCopy={() => copy("update", `${origin}/register?invite=${token.token}&reason=update`)}
                />
            </div>
        </section>
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

/** Mirrors the active-token card so the tab doesn't reflow once the token arrives. */
function TokenSkeleton() {
    return (
        <SkeletonRegion label="token">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-2.5 w-44" />
                    </div>
                    <div className="flex gap-2">
                        <Skeleton className="h-9 w-24 rounded-lg" />
                        <Skeleton className="h-9 w-20 rounded-lg" />
                    </div>
                </div>
                <Skeleton className="mt-4 h-12 w-full rounded-xl" />
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Skeleton className="h-16 rounded-xl" />
                    <Skeleton className="h-16 rounded-xl" />
                </div>
            </section>
        </SkeletonRegion>
    );
}
