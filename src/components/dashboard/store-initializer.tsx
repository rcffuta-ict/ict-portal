"use client";

import { useEffect, useRef } from "react";
import { useProfileStore } from "../../lib/stores/profile.store";
import { verifySession } from "@/app/actions/auth";
import { useLoginRedirect } from "@/lib/hooks/useLoginRedirect";

// Check session every 5 minutes
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
// Refresh if session hasn't been checked in 10 minutes
const SESSION_REFRESH_THRESHOLD = 10 * 60 * 1000; // 10 minutes

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
                        // NO VALID SESSION FOUND
                        console.error("No valid session found:", result.error);

                        // User Request: "if there is No valid session found,clear all states and then take me to login"
                        clearUser();
                        redirectToLogin();
                        return;
                    }
                } catch (error) {
                    console.error("Initial session check error:", error);
                    // On hard error, also safer to clear and redirect
                    clearUser();
                    redirectToLogin();
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
                        clearUser();
                        redirectToLogin();
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
