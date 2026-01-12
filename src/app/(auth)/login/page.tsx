"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginAction } from "./actions";
import {
    Loader2,
    Mail,
    Lock,
    Eye,
    EyeOff,
    ArrowRight,
    AlertCircle,
} from "lucide-react";
import FormInput from "@/components/ui/FormInput"; // Import your component

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        const formData = new FormData(e.currentTarget);
        const res = await loginAction(formData);

        if (res.success) {
            router.refresh();
            router.push("/dashboard");
        } else {
            setError(res.error || "Invalid email or password");
            setIsLoading(false);
        }
    }

    return (
        <div className=" max-w-xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-8 text-center md:text-left">
                <h1 className="text-3xl font-bold text-rcf-navy tracking-tight">
                    Welcome Back
                </h1>
                <p className="text-sm text-slate-500 mt-2">
                    Enter your credentials to access the fellowship portal.
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Error Alert */}
                {error && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-100 flex items-center gap-3 text-sm text-red-600 animate-in slide-in-from-top-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Email Field using FormInput */}
                <FormInput
                    label="Email Address"
                    name="email"
                    type="email"
                    placeholder="brother.david@example.com"
                    required
                    leftIcon={<Mail className="h-5 w-5" />}
                />

                {/* Password Field using FormInput */}
                <div>
                    <div className="flex items-center justify-between ml-1 mb-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                            Password <span className="text-pink-500">*</span>
                        </label>
                        <Link
                            href="/forgot-password"
                            className="text-xs font-medium text-rcf-navy hover:underline"
                        >
                            Forgot password?
                        </Link>
                    </div>

                    <FormInput
                        hideLabel // We rendered a custom label/link above
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        required
                        leftIcon={<Lock className="h-5 w-5" />}
                        rightIcon={
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="focus:outline-none hover:text-slate-600"
                                tabIndex={-1} // Prevent tab focus stopping on the eye
                            >
                                {showPassword ? (
                                    <EyeOff className="h-5 w-5" />
                                ) : (
                                    <Eye className="h-5 w-5" />
                                )}
                            </button>
                        }
                    />
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isLoading}
                    className="group relative w-full overflow-hidden rounded-xl bg-rcf-navy p-3.5 text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-[#2a2257] hover:shadow-blue-900/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                >
                    <div className="relative z-10 flex items-center justify-center gap-2 font-bold text-sm">
                        {isLoading ? (
                            <Loader2 className="animate-spin h-5 w-5" />
                        ) : (
                            <>
                                <span>Access Dashboard</span>
                                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </>
                        )}
                    </div>
                </button>
            </form>

            {/* Footer */}
            <div className="mt-8 text-center">
                <p className="text-sm text-slate-500">
                    New to the fellowship?{" "}
                    <Link
                        href="/register"
                        className="font-bold text-rcf-navy hover:underline underline-offset-4"
                    >
                        Get Indexed
                    </Link>
                </p>
            </div>
        </div>
    );
}
