"use client";

import { useState, useTransition, useEffect } from "react";

import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { loginAction } from "./actions";
import { useProfileStore } from "@/src/lib/stores/profile.store";
import Image from "next/image";

export default function LoginPage() {
    const router = useRouter();
    const { setSession, session } = useProfileStore();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState("");

    // If the client-side store already has a valid session, go to dashboard
    useEffect(() => {
        if (session?.raffleId) {
            router.replace("/");
        }
    }, [session, router]);

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        const formData = new FormData(e.currentTarget);

        startTransition(() => {
            (async () => {
                const toastId = toast.loading("Signing you in…");
                const result = await loginAction(formData);

                if (!result.success || !result.data) {
                    toast.error(result.error ?? "Login failed", {
                        id: toastId,
                    });
                    setError(result.error ?? "Login failed");
                    return;
                }

                console.debug("User data", result);

                toast.success("Welcome! 🎉", { id: toastId });
                setSession({
                    profile: result.data.profile,
                    raffleId: result.data.raffleId,
                    eventTitle: result.data.eventTitle,
                    eventDate: result.data.eventDate,
                });
                router.push("/");
                router.refresh();
            })();
        });
    }

    return (
        <div className="login-page">
            <div className="login-glow login-glow--purple" />
            <div className="login-glow login-glow--blue" />

            <div className="login-card">
                <div className="login-logo max-w-5xl flex justify-center">
                    <Image
                        src="/images/Logo/logo.png"
                        alt="RCF FUTA"
                        width={150}
                        height={150}
                        // className="w-20 h-20"
                    />
                </div>

                <h1 className="login-title">Combined Family Meeting</h1>
                <p className="login-subtitle">Sign in to get your Raffle ID</p>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="login-field">
                        <label htmlFor="identifier">
                            Email or Phone Number
                        </label>
                        <input
                            id="identifier"
                            name="identifier"
                            type="text"
                            autoComplete="username"
                            placeholder="e.g. you@futa.edu.ng or 08012345678"
                            required
                            disabled={isPending}
                        />
                    </div>

                    <div className="login-field">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            placeholder="Your password"
                            required
                            disabled={isPending}
                        />
                    </div>

                    {error && <p className="login-error">{error}</p>}

                    <button
                        type="submit"
                        className="login-btn"
                        disabled={isPending}
                    >
                        {isPending ? (
                            <span className="login-btn__spinner" />
                        ) : (
                            "Sign In"
                        )}
                    </button>
                </form>

                <p className="login-footer">
                    Only RCF FUTA members (100L–500L) can access this. <br />
                    Contact ICT if you have issues signing in.
                </p>
            </div>
        </div>
    );
}
