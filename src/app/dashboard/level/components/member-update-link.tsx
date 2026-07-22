"use client";

import { useState } from "react";
import { Link2, Copy, Check, Loader2, AlertCircle } from "lucide-react";
import { createMemberInviteAction } from "../../invites/actions";

/**
 * Generate a one-off link that lets THIS member update their own record without a login.
 * Shown only to the level's coordinator; the action itself re-checks `canManageLevel`.
 */
export function MemberUpdateLink({
    classSetId,
    profileId,
    memberName,
}: {
    classSetId: string;
    profileId: string;
    memberName: string;
}) {
    const [token, setToken] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = token ? `${origin}/register?invite=${token}` : "";

    const generate = async () => {
        setBusy(true);
        setError(null);
        const res = await createMemberInviteAction("update", classSetId, profileId);
        setBusy(false);
        if (res.success && res.token) setToken(res.token);
        else setError(res.error || "Could not create the link.");
    };

    const copy = async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="flex items-center gap-2 font-bold text-slate-700">
                        <Link2 className="h-4 w-4" /> Update link
                    </h4>
                    <p className="mt-1 text-xs text-slate-500">
                        Send {memberName} a link to correct their own details — no login needed.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={generate}
                    disabled={busy}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-rcf-navy px-4 text-xs font-bold text-white hover:bg-opacity-90 disabled:opacity-60"
                >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    {token ? "Generate new" : "Generate link"}
                </button>
            </div>

            {error && (
                <p className="mt-3 flex items-start gap-1.5 text-xs text-red-600">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
                </p>
            )}

            {token && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
                    <code className="flex-1 truncate text-xs text-slate-600">{url}</code>
                    <button
                        type="button"
                        onClick={copy}
                        aria-label="Copy update link"
                        className="p-2 text-slate-400 hover:text-rcf-navy"
                    >
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                </div>
            )}
        </section>
    );
}
