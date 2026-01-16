"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestResetAction, resetPasswordAction } from "./actions";
import {
    Loader2,
    ArrowRight,
    Mail,
    KeyRound,
    CheckCircle2,
    ArrowLeft,
    Lock,
} from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import { Logo } from "@/components/ui/logo";

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [step, setStep] = useState<"EMAIL" | "OTP" | "PASSWORD" | "SUCCESS">(
        "EMAIL"
    );

    // State
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // 1. Send OTP
    const handleRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        const res = await requestResetAction(email);
        if (res.success) setStep("OTP");
        else setError(res.error || "Failed to send code");

        setLoading(false);
    };

    // 2. Validate OTP (Client side transition only, real validation happens on submit)
    const handleVerifyOtp = (e: React.FormEvent) => {
        e.preventDefault();
        if (otp.length < 6) return setError("Enter 6-digit code");
        setError("");
        setStep("PASSWORD");
    };

    // 3. Reset Password
    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword)
            return setError("Passwords do not match");
        if (password.length < 6) return setError("Password too short");

        setLoading(true);
        setError("");

        const res = await resetPasswordAction(email, otp, password);
        if (res.success) setStep("SUCCESS");
        else setError(res.error || "Reset failed");

        setLoading(false);
    };

    return (
        <div className="w-full max-w-md mx-auto animate-fade-in">
        <div className="flex md:hidden mb-10">
                                    <Logo width={80} asLink />
                                </div>
                                <br className="md:hidden block" />
            {step !== "SUCCESS" && (
                <div className="mb-8 text-center md:text-left">
                    <button
                        onClick={() => router.push("/login")}
                        className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-rcf-navy mb-4 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to Login
                    </button>
                    <h1 className="text-3xl font-bold text-rcf-navy tracking-tight">
                        {step === "EMAIL" && "Forgot Password?"}
                        {step === "OTP" && "Check your Inbox"}
                        {step === "PASSWORD" && "Set New Password"}
                    </h1>
                    <p className="text-sm text-slate-500 mt-2">
                        {step === "EMAIL" &&
                            "Enter your email to receive a reset code."}
                        {step === "OTP" && `We sent a code to ${email}.`}
                        {step === "PASSWORD" &&
                            "Secure your account with a new credential."}
                    </p>
                </div>
            )}

            {error && (
                <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
                    {error}
                </div>
            )}

            {/* --- STEP 1: EMAIL --- */}
            {step === "EMAIL" && (
                <form onSubmit={handleRequest} className="space-y-6">
                    <FormInput
                        label="Email Address"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="brother.david@example.com"
                        leftIcon={<Mail className="h-5 w-5" />}
                    />
                    <button
                        disabled={loading}
                        className="btn-primary w-full h-12 text-base"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" />
                        ) : (
                            "Send Reset Code"
                        )}
                    </button>
                </form>
            )}

            {/* --- STEP 2: OTP --- */}
            {step === "OTP" && (
                <form onSubmit={handleVerifyOtp} className="space-y-6">
                    <div className="flex justify-center">
                        <input
                            value={otp}
                            onChange={(e) =>
                                setOtp(
                                    e.target.value
                                        .replace(/[^0-9]/g, "")
                                        .slice(0, 6)
                                )
                            }
                            className="text-center text-4xl tracking-[0.5em] font-bold w-full h-16 border-2 border-slate-200 rounded-xl outline-none focus:border-rcf-navy focus:ring-4 focus:ring-blue-50 transition-all bg-white text-rcf-navy"
                            placeholder="------"
                            autoFocus
                        />
                    </div>
                    <button
                        type="submit"
                        className="btn-primary w-full h-12 text-base"
                    >
                        Verify Code <ArrowRight className="ml-2 h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setStep("EMAIL")}
                        className="w-full text-xs text-slate-400 hover:text-rcf-navy"
                    >
                        Resend Code
                    </button>
                </form>
            )}

            {/* --- STEP 3: NEW PASSWORD --- */}
            {step === "PASSWORD" && (
                <form onSubmit={handleReset} className="space-y-6">
                    <FormInput
                        label="New Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        leftIcon={<KeyRound className="h-5 w-5" />}
                    />
                    <FormInput
                        label="Confirm Password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        leftIcon={<Lock className="h-5 w-5" />}
                    />
                    <button
                        disabled={loading}
                        className="btn-primary w-full h-12 text-base"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" />
                        ) : (
                            "Update Password"
                        )}
                    </button>
                </form>
            )}

            {/* --- STEP 4: SUCCESS --- */}
            {step === "SUCCESS" && (
                <div className="text-center space-y-6 py-10 animate-in zoom-in-95">
                    <div className="mx-auto h-20 w-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="h-10 w-10" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">
                            Password Updated!
                        </h2>
                        <p className="text-slate-500 mt-2">
                            You can now access your dashboard.
                        </p>
                    </div>
                    <button
                        onClick={() => router.push("/login")}
                        className="btn-primary w-full h-12 text-base"
                    >
                        Go to Login
                    </button>
                </div>
            )}
        </div>
    );
}
