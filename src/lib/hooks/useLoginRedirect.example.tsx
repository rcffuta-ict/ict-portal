/**
 * Example: How to use useLoginRedirect in a protected component
 * 
 * This demonstrates how to redirect unauthenticated users to login
 * while preserving their intended destination.
 */

"use client";

import { useEffect } from "react";
import { useProfileStore } from "@/lib/stores/profile.store";
import { useLoginRedirect } from "@/lib/hooks/useLoginRedirect";
import { Loader2 } from "lucide-react";

export function ProtectedPageExample() {
    const user = useProfileStore((state) => state.user);
    const { redirectToLogin } = useLoginRedirect();

    useEffect(() => {
        if (!user) {
            console.log("User not authenticated, redirecting to login...");
            // This will redirect to /login?returnTo=/current-page
            redirectToLogin();
        }
    }, [user, redirectToLogin]);

    // Show loading state while checking auth
    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="animate-spin h-8 w-8 text-rcf-navy mx-auto mb-4" />
                    <p className="text-slate-600">Checking authentication...</p>
                </div>
            </div>
        );
    }

    // User is authenticated, show protected content
    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold text-rcf-navy mb-4">
                Protected Content
            </h1>
            <p className="text-slate-600 mb-4">
                Welcome back! You are authenticated.
            </p>
            <p className="text-sm text-slate-500">
                This content is only visible to authenticated users.
            </p>
        </div>
    );
}

/**
 * Alternative Pattern: Using the hook in a layout
 * 
 * If you want to protect multiple pages, you can use this in a layout component
 */
export function ProtectedLayout({ children }: { children: React.ReactNode }) {
    const user = useProfileStore((state) => state.user);
    const { redirectToLogin } = useLoginRedirect();

    useEffect(() => {
        if (!user) {
            redirectToLogin();
        }
    }, [user, redirectToLogin]);

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="animate-spin h-8 w-8 text-rcf-navy" />
            </div>
        );
    }

    return <>{children}</>;
}

/**
 * Alternative Pattern: Redirect with custom return path
 * 
 * Useful when you want to redirect to a specific page after login
 */
export function CustomRedirectExample() {
    const user = useProfileStore((state) => state.user);
    const { redirectToLogin } = useLoginRedirect();

    const handleProtectedAction = () => {
        if (!user) {
            // Redirect to login, but after login go to /dashboard/profile
            redirectToLogin('/dashboard/profile');
        } else {
            // Perform protected action
            console.log("Performing action...");
        }
    };

    return (
        <button onClick={handleProtectedAction} className="btn-primary">
            View Profile (Protected)
        </button>
    );
}
