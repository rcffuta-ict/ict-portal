"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useProfileStore } from "@/src/lib/stores/profile.store";
import { getSessionAction } from "@/src/lib/actions/session.actions";

// Check session every 5 minutes
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000;
// Re-verify with server if last check was more than 10 minutes ago
const SESSION_REFRESH_THRESHOLD = 10 * 60 * 1000;

interface StoreInitializerProps {
    /**
     * If true, redirects to /login when no valid session is found.
     * Default: true
     */
    requireAuth?: boolean;
    /**
     * Called once the session has been successfully loaded into the store.
     */
    onReady?: () => void;
    /**
     * Called when session restore fails (useful for showing error states).
     */
    onAuthFailure?: (error: string) => void;
}

/**
 * StoreInitializer
 *
 * Drop this into any client-component page (or a layout) that needs the
 * profile store hydrated from the server session.
 *
 * On mount it:
 *   1. Checks whether the Zustand store already has a fresh session.
 *   2. If not (or session is stale), calls `getSessionAction` to verify
 *      the httpOnly cookie and populate the store.
 *   3. Runs a periodic check every SESSION_CHECK_INTERVAL ms to re-verify
 *      the session if it is older than SESSION_REFRESH_THRESHOLD.
 *   4. Redirects to /login on auth failure (when requireAuth = true).
 */
export default function StoreInitializer({
    requireAuth = true,
    onReady,
    onAuthFailure,
}: StoreInitializerProps) {
    const router = useRouter();
    const session = useProfileStore((state) => state.session);
    const setSession = useProfileStore((state) => state.setSession);
    const clearSession = useProfileStore((state) => state.clearSession);
    const setLoading = useProfileStore((state) => state.setLoading);

    const hasChecked = useRef(false);
    const isCheckingRef = useRef(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        async function checkAndRefreshSession() {
            // Prevent concurrent checks
            if (isCheckingRef.current) return;

            const now = Date.now();
            const lastRefresh = session?.lastRefresh ?? null;
            const timeSinceRefresh = lastRefresh ? now - lastRefresh : Infinity;

            // ── Case 1: No session in store ──────────────────────────────────
            // We MUST verify with the server (cookie might still be valid).
            if (!session) {
                console.log(
                    "[StoreInitializer] No session in store, verifying with server…",
                );
                isCheckingRef.current = true;
                setLoading(true);
                try {
                    const result = await getSessionAction();
                    if (result.success && result.data) {
                        setSession(result.data);
                        onReady?.();
                        console.log(
                            "[StoreInitializer] Session restored from server.",
                        );
                    } else {
                        console.warn(
                            "[StoreInitializer] No valid session:",
                            result.error,
                        );
                        setLoading(false);
                        onAuthFailure?.(result.error ?? "No session");
                        if (requireAuth) {
                            router.replace("/login");
                        }
                    }
                } catch (err) {
                    console.error(
                        "[StoreInitializer] Initial check error:",
                        err,
                    );
                    setLoading(false);
                    clearSession();
                    if (requireAuth) router.replace("/login");
                } finally {
                    isCheckingRef.current = false;
                    hasChecked.current = true;
                }
                return;
            }

            // ── Case 2: Fresh session (just logged in) ───────────────────────
            // Skip verification for the first few minutes after login.
            if (!hasChecked.current && timeSinceRefresh < 5 * 60 * 1000) {
                console.log(
                    "[StoreInitializer] Fresh session detected, skipping initial verify.",
                );
                hasChecked.current = true;
                onReady?.();
                return;
            }

            // ── Case 3: Session is stale — re-verify with server ─────────────
            if (timeSinceRefresh > SESSION_REFRESH_THRESHOLD) {
                console.log(
                    "[StoreInitializer] Session is stale, re-verifying…",
                );
                isCheckingRef.current = true;
                try {
                    const result = await getSessionAction();
                    if (result.success && result.data) {
                        setSession(result.data);
                        console.log("[StoreInitializer] Session refreshed.");
                    } else {
                        console.warn(
                            "[StoreInitializer] Session verification failed:",
                            result.error,
                        );
                        clearSession();
                        onAuthFailure?.(result.error ?? "Session expired");
                        if (requireAuth) router.replace("/login");
                    }
                } catch (err) {
                    console.error("[StoreInitializer] Refresh error:", err);
                } finally {
                    isCheckingRef.current = false;
                }
            }

            hasChecked.current = true;
        }

        // Small delay to let Zustand rehydrate from localStorage first
        const timeoutId = setTimeout(() => {
            checkAndRefreshSession();
        }, 100);

        // Periodic re-verification
        intervalRef.current = setInterval(() => {
            checkAndRefreshSession();
        }, SESSION_CHECK_INTERVAL);

        return () => {
            clearTimeout(timeoutId);
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // This component renders nothing — it's purely a side-effect initializer.
    return null;
}
