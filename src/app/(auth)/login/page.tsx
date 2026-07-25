"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkLeaderAction, loginAction, setInitialPasswordAction } from "./actions";

import { Loader2, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, ArrowLeft } from "lucide-react";
import type { FullUserProfile } from "@rcffuta/ict-lib";
import FormInput from "@/components/ui/FormInput";
import { useProfileStore } from "@/lib/stores/profile.store";
import { Logo } from "@/components/ui/logo";
import { useLoginRedirect } from "@/lib/hooks/useLoginRedirect";

type Step = "email" | "password" | "set";

export default function LoginPage() {
    const router = useRouter();
    const user = useProfileStore((state) => state.user);
    const setUser = useProfileStore((state) => state.setUser);
    const { handleSuccessfulLogin, getReturnUrl } = useLoginRedirect();

    const [step, setStep] = useState<Step>("email");
    const [email, setEmail] = useState("");
    const [firstName, setFirstName] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const hasRedirected = useRef(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (user && user.profile && !isLoading && !hasRedirected.current) {
                hasRedirected.current = true;
                router.replace(getReturnUrl());
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [user, isLoading, router, getReturnUrl]);

    // Step 1: email → decide set vs. verify.
    async function onEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsLoading(true);
        setError("");
        const fd = new FormData(e.currentTarget);
        const value = String(fd.get("email") || "").trim().toLowerCase();
        try {
            const res = await checkLeaderAction(value);
            if (!res.ok) {
                setError(res.error || "That email doesn't have portal access.");
            } else {
                setEmail(value);
                setFirstName(res.firstName);
                setStep(res.passwordSet ? "password" : "set");
            }
        } catch {
            setError("Something went wrong. Please try again.");
        }
        setIsLoading(false);
    }

    // Step 2a: verify password.
    async function onPasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsLoading(true);
        setError("");
        const fd = new FormData(e.currentTarget);
        fd.set("email", email);
        try {
            const res = await loginAction(fd);
            if (res.success && res.data) {
                setUser(res.data as FullUserProfile);
                handleSuccessfulLogin();
            } else {
                setError(res.error || "Invalid password");
                setIsLoading(false);
            }
        } catch {
            setError("Something went wrong. Please try again.");
            setIsLoading(false);
        }
    }

    // Step 2b: set password on first login.
    async function onSetSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        const fd = new FormData(e.currentTarget);
        const pw = String(fd.get("password") || "");
        const confirm = String(fd.get("confirm") || "");
        if (pw !== confirm) return setError("Passwords do not match.");
        if (pw.length < 8) return setError("Password must be at least 8 characters.");
        setIsLoading(true);
        try {
            const res = await setInitialPasswordAction(email, pw);
            if (res.success && res.data) {
                setUser(res.data as FullUserProfile);
                handleSuccessfulLogin();
            } else {
                setError(res.error || "Could not set password");
                setIsLoading(false);
            }
        } catch {
            setError("Something went wrong. Please try again.");
            setIsLoading(false);
        }
    }

    return (
        <div className="w-full max-w-md mx-auto animate-fade-in">
            <div className="flex justify-center md:hidden mb-10">
                <Logo width={80} asLink />
            </div>
            <br className="md:hidden block" />

            <div className="mb-8 text-center md:text-left">
                <h1 className="text-3xl font-bold text-rcf-navy tracking-tight">
                    {step === "email" && "Leader Login"}
                    {step === "password" && `Welcome back${firstName ? `, ${firstName}` : ""}`}
                    {step === "set" && `Hi${firstName ? ` ${firstName}` : ""}, set your password`}
                </h1>
                <p className="text-sm text-slate-500 mt-2">
                    {step === "email" && "Enter your email to access the fellowship portal."}
                    {step === "password" && "Enter your password to continue."}
                    {step === "set" && "This is your first login — choose a password to secure your account."}
                </p>
            </div>

            {error && (
                <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-100 flex items-center gap-3 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {step !== "email" && (
                <button
                    onClick={() => { setStep("email"); setError(""); }}
                    className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-rcf-navy mb-4"
                >
                    <ArrowLeft className="h-4 w-4" /> Use a different email
                </button>
            )}

            {step === "email" && (
                <form onSubmit={onEmailSubmit} className="space-y-6">
                    <FormInput
                        label="Email Address"
                        name="email"
                        type="email"
                        placeholder="brother.david@example.com"
                        required
                        leftIcon={<Mail className="h-5 w-5" />}
                    />
                    <SubmitButton loading={isLoading} label="Continue" />
                </form>
            )}

            {step === "password" && (
                <form onSubmit={onPasswordSubmit} className="space-y-6">
                    <div className="flex items-center justify-between ml-1 mb-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Password</label>
                        <Link href="/forgot-password" className="relative z-10 text-xs font-medium text-rcf-navy hover:underline">
                            Forgot password?
                        </Link>
                    </div>
                    <FormInput
                        hideLabel
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        required
                        autoFocus
                        leftIcon={<Lock className="h-5 w-5" />}
                        rightIcon={
                            <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1} className="focus:outline-none hover:text-slate-600">
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        }
                    />
                    <SubmitButton loading={isLoading} label="Access Dashboard" />
                </form>
            )}

            {step === "set" && (
                <form onSubmit={onSetSubmit} className="space-y-5">
                    <FormInput label="New Password" name="password" type="password" placeholder="••••••••" required autoFocus leftIcon={<Lock className="h-5 w-5" />} />
                    <FormInput label="Confirm Password" name="confirm" type="password" placeholder="••••••••" required leftIcon={<Lock className="h-5 w-5" />} />
                    <SubmitButton loading={isLoading} label="Set password & continue" />
                </form>
            )}

            {step === "email" && (
                <div className="mt-8 text-center">
                    <p className="text-sm text-slate-500">
                        Not a leader? Members are added via a{" "}
                        <span className="font-semibold text-rcf-navy">coordinator&apos;s link</span>.
                    </p>
                </div>
            )}
        </div>
    );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
    return (
        <button
            type="submit"
            disabled={loading}
            className="group relative w-full overflow-hidden rounded-xl bg-rcf-navy p-3.5 text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-rcf-navy-light active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
        >
            <div className="relative z-10 flex items-center justify-center gap-2 font-bold text-sm">
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : (
                    <>
                        <span>{label}</span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                )}
            </div>
        </button>
    );
}
