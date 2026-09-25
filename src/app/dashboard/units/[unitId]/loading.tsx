import { Skeleton, SkeletonCard, SkeletonRegion } from "@/components/ui/skeleton";

/**
 * Shown the instant a unit card is tapped, while the server checks access. Mirrors the
 * page (breadcrumb → header → tabs → roster) so the layout settles once.
 */
export default function LoadingUnit() {
    return (
        <SkeletonRegion label="unit">
            <div className="space-y-6">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <Skeleton className="h-4 w-40" />
                </div>
                <div className="space-y-2 border-b border-slate-200 pb-5">
                    <Skeleton className="h-7 w-56" />
                    <Skeleton className="h-3.5 w-32" />
                </div>
                <Skeleton className="h-11 w-full max-w-md rounded-lg" />
                <SkeletonCard className="h-96" />
            </div>
        </SkeletonRegion>
    );
}
