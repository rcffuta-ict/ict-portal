"use client";

import { useState } from "react";
import Link from "next/link";
import { Link2, Copy, Check, KeyRound } from "lucide-react";

/**
 * The update link for this member, built from the LEVEL'S ACTIVE TOKEN.
 *
 * Nothing is generated here — the generation has exactly one token, and every update link
 * is just that token plus `?reason=update`. The member proves who they are by entering
 * their email on the public form, which is matched only within this level. If the level
 * has no active token, the coordinator is pointed at the Tokens tab instead.
 */
export function MemberUpdateLink({
    classSetId,
    token,
    memberName,
}: {
    classSetId: string;
    token: string | null;
    memberName: string;
}) {
    const [copied, setCopied] = useState(false);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = token ? `${origin}/register?invite=${token}&reason=update` : "";

    const copy = async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    if (!token) {
        return (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <h4 className="flex items-center gap-2 font-bold text-amber-800">
                    <KeyRound className="h-4 w-4" /> No active token
                </h4>
                <p className="mt-1 text-xs text-amber-700">
                    This level has no active token, so there&apos;s no update link to share yet.
                </p>
                <Link
                    href={`/dashboard/level/${classSetId}`}
                    className="mt-3 inline-flex h-10 items-center rounded-xl bg-rcf-navy px-4 text-xs font-bold text-white hover:bg-opacity-90"
                >
                    Go to Tokens
                </Link>
            </section>
        );
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                    <h4 className="flex items-center gap-2 font-bold text-slate-700">
                        <Link2 className="h-4 w-4" /> Update link
                    </h4>
                    <p className="mt-1 text-xs text-slate-500">
                        Send {memberName} this level&apos;s update link — they confirm their email and
                        edit their own details. No login needed.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={copy}
                    className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-rcf-navy px-4 text-xs font-bold text-white hover:bg-opacity-90"
                >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy link"}
                </button>
            </div>

            <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-2">
                <code className="block truncate text-xs text-slate-600">{url}</code>
            </div>
        </section>
    );
}
