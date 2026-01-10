"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, Mail, Lock, ArrowRight } from "lucide-react";
import FormInput from "@/components/ui/FormInput";

export default function LoginPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        // Simulate API Call (We will connect @rcffuta/ict-lib later)
        setTimeout(() => {
            setIsLoading(false);
            // router.push('/dashboard');
        }, 2000);
    }

    return (
        <div className="animate-fade-in w-full max-w-lg mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col space-y-2 text-center">
                <h1 className="text-2xl font-bold tracking-tight text-rcf-navy">
                    Welcome Back
                </h1>
                <p className="text-sm text-gray-500">
                    Enter your credentials to access the portal.
                </p>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-100">
                    {error}
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email Field */}
                <div className="space-y-2">
                    <label
                        htmlFor="email"
                        className="text-sm font-medium text-gray-700"
                    >
                        Email Address
                    </label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                        <FormInput
                            id="email"
                            type="email"
                            placeholder="brother.david@example.com"
                            required
                            className="h-10 w-full rounded-md border border-gray-200 bg-white pl-10 pr-3 text-sm outline-none transition-all placeholder:text-gray-400 focus:border-rcf-navy focus:ring-1 focus:ring-rcf-navy"
                        />
                    </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label
                            htmlFor="password"
                            className="text-sm font-medium text-gray-700"
                        >
                            Password
                        </label>
                        <Link
                            href="/auth/forgot-password"
                            className="text-xs font-medium text-rcf-navy hover:underline"
                        >
                            Forgot password?
                        </Link>
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                        <FormInput
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            required
                            className="h-10 w-full rounded-md border border-gray-200 bg-white pl-10 pr-3 text-sm outline-none transition-all placeholder:text-gray-400 focus:border-rcf-navy focus:ring-1 focus:ring-rcf-navy"
                        />
                    </div>
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isLoading}
                    className="group relative flex h-10 w-full items-center justify-center gap-2 rounded-md bg-rcf-navy px-4 text-sm font-semibold text-white transition-all hover:bg-rcf-navy-light disabled:cursor-not-allowed disabled:opacity-70"
                >
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <>
                            Log In
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </>
                    )}
                </button>
            </form>

            {/* Footer / Switch to Register */}
            <div className="text-center text-sm text-gray-500">
                New to the fellowship?{" "}
                <Link
                    href="/auth/register"
                    className="font-semibold text-rcf-navy underline-offset-4 hover:underline"
                >
                    Create Profile
                </Link>
            </div>
        </div>
    );
}
