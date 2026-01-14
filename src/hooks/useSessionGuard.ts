"use client";

import { useCallback, useRef } from 'react';
import { useProfileStore } from '@/lib/stores/profile.store';
import { verifySession } from '@/app/actions/auth';
import { useRouter } from 'next/navigation';

/**
 * Hook to ensure session is valid before performing actions
 * Auto-refreshes tokens if needed
 */
export function useSessionGuard() {
    const setUser = useProfileStore((state) => state.setUser);
    const clearUser = useProfileStore((state) => state.clearUser);
    const lastRefresh = useProfileStore((state) => state.lastRefresh);
    const router = useRouter();
    const isRefreshing = useRef(false);

    const ensureValidSession = useCallback(async () => {
        // Prevent concurrent refresh attempts
        if (isRefreshing.current) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return { valid: true };
        }

        // Check if we need to refresh (if last refresh was more than 5 minutes ago)
        const now = Date.now();
        const timeSinceRefresh = lastRefresh ? now - lastRefresh : Infinity;
        
        if (timeSinceRefresh < 5 * 60 * 1000) {
            // Session was recently verified, assume valid
            return { valid: true };
        }

        // Verify session with server
        isRefreshing.current = true;
        
        try {
            const result = await verifySession();
            
            if (result.success && result.data) {
                setUser(result.data);
                return { valid: true };
            } else {
                clearUser();
                router.replace('/login');
                return { valid: false, error: result.error };
            }
        } catch (error) {
            console.error('Session verification failed:', error);
            clearUser();
            router.replace('/login');
            return { valid: false, error: 'Session verification failed' };
        } finally {
            isRefreshing.current = false;
        }
    }, [lastRefresh, setUser, clearUser, router]);

    return { ensureValidSession };
}
