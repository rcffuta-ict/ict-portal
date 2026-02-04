"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";

interface AccessGuardProps {
  children: React.ReactNode;
  requiredLevel: 'USER' | 'MODERATOR' | 'ADMIN';
  fallbackPath?: string;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
}

/**
 * Client-side access guard component
 * Use this to protect page content based on user roles
 */
export function AccessGuard({ 
  children, 
  requiredLevel, 
  fallbackPath = "/dashboard",
  loadingComponent,
  errorComponent 
}: AccessGuardProps) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAccess() {
      try {
        // Import the access control functions dynamically
        const { checkEnhancedAdminAccess, checkModeratorAccess } = 
          await import("@/lib/access-control");

        if (requiredLevel === 'ADMIN') {
          const result = await checkEnhancedAdminAccess();
          if (result.isAdmin) {
            setHasAccess(true);
          } else {
            setError(result.error || "Admin access required");
            setTimeout(() => router.push(fallbackPath), 2000);
          }
        } else if (requiredLevel === 'MODERATOR') {
          const result = await checkModeratorAccess();
          if (result.isModerator) {
            setHasAccess(true);
          } else {
            setError(result.error || "Moderator access required");
            setTimeout(() => router.push(fallbackPath), 2000);
          }
        } else {
          // Basic USER access - assume authenticated if we reach this component
          setHasAccess(true);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Access check failed";
        setError(errorMessage);
        setTimeout(() => router.push(fallbackPath), 2000);
      } finally {
        setIsChecking(false);
      }
    }

    checkAccess();
  }, [requiredLevel, router, fallbackPath]);

  if (isChecking) {
    return loadingComponent || (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="text-sm text-gray-600">Verifying access permissions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return errorComponent || (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-4 p-6">
          <ShieldAlert className="h-12 w-12 mx-auto text-red-500" />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">Access Denied</h3>
            <p className="text-sm text-gray-600 max-w-md">{error}</p>
            <p className="text-xs text-gray-500">Redirecting you to a safe location...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-4 p-6">
          <ShieldAlert className="h-12 w-12 mx-auto text-yellow-500" />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900">Insufficient Permissions</h3>
            <p className="text-sm text-gray-600">You don&apos;t have the required permissions to view this page.</p>
            <p className="text-xs text-gray-500">Redirecting you back...</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Higher-order component for protecting entire pages
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withAccessGuard<T extends Record<string, any>>(
  Component: React.ComponentType<T>,
  requiredLevel: 'USER' | 'MODERATOR' | 'ADMIN'
) {
  return function ProtectedComponent(props: T) {
    return (
      <AccessGuard requiredLevel={requiredLevel}>
        <Component {...props} />
      </AccessGuard>
    );
  };
}