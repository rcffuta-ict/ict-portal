import { Skeleton, SkeletonCard, SkeletonRegion } from "@/components/ui/skeleton";

/**
 * Shown the instant a generation card is tapped, while the server fetches. It mirrors the
 * real page's shape (breadcrumb → header → stats → member cards) so the layout settles
 * once, not twice.
 */
export default function LoadingGeneration() {
    return (
        <SkeletonRegion label="generation">
            <div className="space-y-6">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <Skeleton className="h-4 w-48" />
                </div>

                <div className="space-y-2 border-b border-slate-200 pb-5">
                    <Skeleton className="h-7 w-56" />
                    <Skeleton className="h-3.5 w-40" />
                </div>

                <div className="flex gap-2">
                    <Skeleton className="h-10 w-28 rounded-xl" />
                    <Skeleton className="h-10 w-24 rounded-xl" />
                    <Skeleton className="h-10 w-24 rounded-xl" />
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <SkeletonCard key={i} className="h-15.5 rounded-xl" />
                    ))}
                </div>

                <SkeletonCard className="h-105" />
            </div>
        </SkeletonRegion>
    );
}
