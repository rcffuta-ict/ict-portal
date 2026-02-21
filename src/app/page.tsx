"use client";

import { useEffect, useState } from "react";
import { useProfileStore } from "@/src/lib/stores/profile.store";
import StoreInitializer from "@/src/components/common/StoreInitializer";
import UserDashboard from "@/src/components/UserDashboard";

export default function HomePage() {
    const [mounted, setMounted] = useState(false);
    const session = useProfileStore((state) => state.session);
    const isLoading = useProfileStore((state) => state.isLoading);

    // Wait for Zustand to rehydrate from localStorage before first render
    useEffect(() => {
        setMounted(true);
    }, []);

    // Always mount StoreInitializer so it can verify / redirect
    return (
        <>
            <StoreInitializer />

            {!mounted || isLoading || !session ? (
                <div className="preloader">
                    <div className="preloader__glow preloader__glow--purple" />
                    <div className="preloader__glow preloader__glow--blue" />
                    <div className="preloader__content">
                        <img
                            src="/images/Logo/logo.png"
                            alt="RCF FUTA"
                            className="preloader__logo"
                        />
                        <p className="preloader__text">
                            Loading your dashboard…
                        </p>
                        <div className="preloader__spinner" />
                    </div>
                </div>
            ) : (
                <UserDashboard />
            )}
        </>
    );
}
