import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

/**
 * Hook for handling login redirects with returnTo parameter
 * 
 * Usage:
 * - When redirecting to login: redirectToLogin()
 * - After successful login: handleSuccessfulLogin()
 * - Get return URL: getReturnUrl()
 */
export function useLoginRedirect() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    /**
     * Redirects to login page with current path as returnTo parameter
     * @param customReturnTo - Optional custom return path (defaults to current path)
     */
    const redirectToLogin = useCallback((customReturnTo?: string) => {
        const returnTo = customReturnTo || pathname;
        
        // Don't include login/register pages as returnTo
        if (returnTo.includes('/login') || returnTo.includes('/register')) {
            router.replace('/login');
            return;
        }

        // Encode the return URL
        const encodedReturnTo = encodeURIComponent(returnTo);
        router.replace(`/login?returnTo=${encodedReturnTo}`);
    }, [pathname, router]);

    /**
     * Gets the returnTo URL from search params, or returns default
     * @param defaultPath - Default path if no returnTo is specified (defaults to /dashboard)
     */
    const getReturnUrl = useCallback((defaultPath: string = '/dashboard'): string => {
        const returnTo = searchParams.get('returnTo');
        
        if (!returnTo) return defaultPath;

        // Validate returnTo is a safe internal path
        const decodedPath = decodeURIComponent(returnTo);
        
        // Prevent open redirect - ensure it's a relative path
        if (decodedPath.startsWith('/') && !decodedPath.startsWith('//')) {
            return decodedPath;
        }

        return defaultPath;
    }, [searchParams]);

    /**
     * Handles successful login by redirecting to returnTo URL or dashboard
     */
    const handleSuccessfulLogin = useCallback(() => {
        const returnUrl = getReturnUrl();
        console.log(`Login successful, redirecting to: ${returnUrl}`);
        router.push(returnUrl);
    }, [getReturnUrl, router]);

    return {
        redirectToLogin,
        getReturnUrl,
        handleSuccessfulLogin,
    };
}
