"use client";

import { useState } from "react";
import { AlertCircle, IdCard, Loader2, ShieldCheck } from "lucide-react";
import { verifyLoMember } from "@/app/lo-app/actions";
import type { LoMember } from "@/lib/lo-member";

interface MemberGateProps {
    onVerified: (member: LoMember) => void;
    /** Shown above the form so the prompt explains why it appeared. */
    reason?: string;
}

/**
 * Lo! has no login, but testimonies are for members. This confirms someone is on
 * the fellowship roster using details they already know — no password, no account.
 *
 * The check happens entirely server-side (`verifyLoMember`); this form never sees
 * roster data, and a mismatch always comes back as the same vague message so it
 * can't be used to probe whether a matric number exists.
 */
export function MemberGate({ onVerified, reason }: MemberGateProps) {
    const [identifier, setIdentifier] = useState("");
    const [surname, setSurname] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            const result = await verifyLoMember(identifier, surname);
            if (result.ok) {
                onVerified(result.member);
            } else {
                setError(result.error);
            }
        } catch {
            setError("We couldn't check that right now. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-5">
            <div className="mx-auto max-w-md">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rcf-navy/5">
                        <ShieldCheck className="h-5 w-5 text-rcf-navy" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900">
                            Confirm you&apos;re a member
                        </h3>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                            {reason ||
                                "Testimonies are shared by fellowship members. No account needed — just your details from the members roster."}
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="mt-4 space-y-3" noValidate>
                    <div className="space-y-1.5">
                        <label
                            htmlFor="lo-member-identifier"
                            className="block text-xs font-semibold tracking-wide text-slate-500 uppercase"
                        >
                            Matric number or email
                        </label>
                        <div className="relative">
                            <IdCard className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                id="lo-member-identifier"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                autoComplete="username"
                                placeholder="CSC/20/1234"
                                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pr-4 pl-10 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-rcf-navy focus:ring-4 focus:ring-rcf-navy/10"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label
                            htmlFor="lo-member-surname"
                            className="block text-xs font-semibold tracking-wide text-slate-500 uppercase"
                        >
                            Surname
                        </label>
                        <input
                            id="lo-member-surname"
                            value={surname}
                            onChange={(e) => setSurname(e.target.value)}
                            autoComplete="family-name"
                            placeholder="As it appears on your record"
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-rcf-navy focus:ring-4 focus:ring-rcf-navy/10"
                        />
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 p-3"
                        >
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                            <p className="text-xs font-medium text-red-700">{error}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting || !identifier.trim() || !surname.trim()}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rcf-navy px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-rcf-navy-light disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Checking...
                            </>
                        ) : (
                            "Continue"
                        )}
                    </button>

                    <p className="text-center text-[11px] leading-relaxed text-slate-400">
                        This only unlocks posting testimonies — it doesn&apos;t sign you
                        into the portal.
                    </p>
                </form>
            </div>
        </div>
    );
}
