"use client";

import Link from "next/link";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/ui/logo";

/**
 * Password resets are admin-issued. Only leaders have logins, and only the VP
 * Admin / ICT Coordinator can issue a reset link (a single-use invite) from the
 * dashboard. So there is no self-serve reset form here — this page explains the
 * process.
 */
export default function ForgotPasswordPage() {
    return (
        <div className="w-full max-w-md mx-auto animate-fade-in">
            <div className="flex md:hidden mb-8">
                <Logo width={80} asLink />
            </div>

            <Link
                href="/login"
                className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-rcf-navy mb-6 transition-colors"
            >
                <ArrowLeft className="h-4 w-4" /> Back to Login
            </Link>

            <div className="flex justify-center mb-4">
                <div className="h-14 w-14 bg-blue-50 rounded-full flex items-center justify-center text-rcf-navy">
                    <KeyRound className="h-7 w-7" />
                </div>
            </div>

            <div className="text-center">
                <h1 className="text-3xl font-bold text-rcf-navy tracking-tight">
                    Forgot your password?
                </h1>
                <p className="text-sm text-slate-500 mt-3">
                    Only fellowship leaders have portal logins, and resets are issued by the
                    administration for security.
                </p>
            </div>

            <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 text-rcf-navy shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-600">
                        Contact the <span className="font-semibold text-rcf-navy">VP Admin</span> or the{" "}
                        <span className="font-semibold text-rcf-navy">ICT Coordinator</span>. They can send you
                        a secure, single-use reset link from their dashboard.
                    </p>
                </div>
                <p className="text-xs text-slate-400">
                    Once you receive the link, open it to set a new password, then return here to log in.
                </p>
            </div>

            <div className="mt-8 text-center">
                <Link href="/login" className="font-semibold text-rcf-navy hover:underline">
                    Return to login
                </Link>
            </div>
        </div>
    );
}
