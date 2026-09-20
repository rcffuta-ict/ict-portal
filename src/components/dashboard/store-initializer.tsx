"use client";

import { useEffect, useRef } from "react";
import { useProfileStore } from "../../lib/stores/profile.store";
import { verifySession, endInvalidSessionAction } from "@/app/actions/auth";
import { useLoginRedirect } from "@/lib/hooks/useLoginRedirect";

// Check session every 5 minutes
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
// Refresh if session hasn't been checked in 10 minutes
const SESSION_REFRESH_THRESHOLD = 10 * 60 * 1000; // 10 minutes


/**
 * Give up on the current session, properly.
 *
 * The cookie has to go FIRST. `src/proxy.ts` decides redirect-vs-allow on the mere
 * presence of `rcf-session` — deliberately, since it is a UX layer and not an
 * authorization boundary — so redirecting to /login while a stale cookie is still set
 * makes the proxy bounce straight back to /dashboard, which lands here again. That is
 * an infinite loop, and because this component renders nothing, all the user sees is a
 * loading screen that never finishes.
 *
 * Clearing the cookie is what ends it. The redirect only works once the proxy agrees
 * there is nothing to protect.
 */
async function abandonSession(
    clearUser: () => void,
    redirectToLogin: () => void,
) {
    try {
        await endInvalidSessionAction();
    } catch {
        // Even if the server call fails, still clear local state and try to leave —
        // being stuck on a dead dashboard is worse than a redirect that may bounce.
    }
    clearUser();
    redirectToLogin();
}

export function StoreInitializer() {
    const user = useProfileStore((state) => state.user);
    const lastRefresh = useProfileStore((state) => state.lastRefresh);
    const setUser = useProfileStore((state) => state.setUser);
    const clearUser = useProfileStore((state) => state.clearUser);

    const { redirectToLogin } = useLoginRedirect();
    const hasChecked = useRef(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const isCheckingRef = useRef(false);

    // Initial auth check and periodic session verification
    useEffect(() => {
        async function checkAndRefreshSession() {
            // Prevent concurrent checks
            if (isCheckingRef.current) return;

            const now = Date.now();
            const timeSinceRefresh = lastRefresh ? now - lastRefresh : Infinity;

            // If we have no user, we MUST verify with server
            // This happens on first load or if state was cleared but cookies remain
            if (!user) {
                console.log("No user in store, verifying session with server...");
                isCheckingRef.current = true;
                try {
                    const result = await verifySession();
                    if (result.success && result.data) {
                        setUser(result.data);
                        console.log("Session restored from server");
                        hasChecked.current = true;
                        return;
                    } else {
                        // NO VALID SESSION FOUND — the cookie outlived its session.
                        console.error("No valid session found:", result.error);
                        hasChecked.current = true;
                        await abandonSession(clearUser, redirectToLogin);
                        return;
                    }
                } catch (error) {
                    console.error("Initial session check error:", error);
                    // On hard error, also safer to clear and redirect
                    hasChecked.current = true;
                    await abandonSession(clearUser, redirectToLogin);
                } finally {
                    isCheckingRef.current = false;
                }
            }

            // If we got here, we have a user. Check if refresh is needed.

            // IMPORTANT: On first check after fresh login, skip server validation
            // The user was just set, so we trust it for a few minutes
            if (!hasChecked.current && timeSinceRefresh < 5 * 60 * 1000) {
                console.log("Fresh login detected, skipping initial verification");
                hasChecked.current = true;
                return;
            }

            // If session is old or beyond threshold, verify with server
            if (timeSinceRefresh > SESSION_REFRESH_THRESHOLD) {
                console.log("Verifying session with server...");

                isCheckingRef.current = true;

                try {
                    const result = await verifySession();

                    if (result.success && result.data) {
                        // Update user data with fresh profile
                        setUser(result.data);
                        console.log("Session verified and refreshed");
                    } else {
                        // Session invalid, logout
                        console.error("Session verification failed:", result.error);
                        await abandonSession(clearUser, redirectToLogin);
                    }
                } catch (error) {
                    console.error("Session check error:", error);
                } finally {
                    isCheckingRef.current = false;
                }
            }

            hasChecked.current = true;
        }

        // Initial check with small delay for hydration
        const timeoutId = setTimeout(() => {
            checkAndRefreshSession();
        }, 100);

        // Set up periodic session verification
        intervalRef.current = setInterval(() => {
            checkAndRefreshSession();
        }, SESSION_CHECK_INTERVAL);

        return () => {
            clearTimeout(timeoutId);
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [user, lastRefresh, redirectToLogin, setUser, clearUser]);

    return null; // This component renders nothing visually
}
