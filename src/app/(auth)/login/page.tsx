"use client";

import { useState, useEffect, useRef } from "react";
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
import FormInput from "@/components/ui/FormInput";
import { useProfileStore } from "@/lib/stores/profile.store";
import { Logo } from "@/components/ui/logo";

export default function LoginPage() {
    const router = useRouter();
    const user = useProfileStore((state) => state.user);
    const setUser = useProfileStore((state) => state.setUser); // Get setUser action

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const hasRedirected = useRef(false);

    // Redirect if already logged in
    useEffect(() => {
        // Small delay to allow Zustand persist to hydrate
        const timer = setTimeout(() => {
            if (user && !isLoading && !hasRedirected.current) {
                console.log("Already logged in, redirecting to dashboard");
                hasRedirected.current = true;
                router.replace('/dashboard');
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [user, isLoading, router]);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        const formData = new FormData(e.currentTarget);

        try {
            const res = await loginAction(formData);

            if (res.success && res.data) {

                // console.debug("Login Successful:", res.data);
                // 1. Store the profile in Zustand immediately
                setUser(res.data);

                // 2. Redirect to Dashboard
                router.push("/dashboard");
            } else {
                setError(res.error || "Invalid email or password");
                setIsLoading(false);
            }
        } catch (_err) {
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
                    Welcome Back
                </h1>
                <p className="text-sm text-slate-500 mt-2">
                    Enter your credentials to access the fellowship portal.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-100 flex items-center gap-3 text-sm text-red-600 animate-in slide-in-from-top-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <FormInput
                    label="Email Address"
                    name="email"
                    type="email"
                    placeholder="brother.david@example.com"
                    required
                    leftIcon={<Mail className="h-5 w-5" />}
                />

                <div>
                    <div className="flex items-center justify-between ml-1 mb-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                            Password
                        </label>
                        <Link
                            href="/forgot-password"
                            className="text-xs font-medium text-rcf-navy hover:underline"
                        >
                            Forgot password?
                        </Link>
                    </div>

                    <FormInput
                        hideLabel
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
                                tabIndex={-1}
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
