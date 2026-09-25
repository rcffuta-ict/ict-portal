import { Skeleton, SkeletonCard, SkeletonRegion } from "@/components/ui/skeleton";

/** Academics placeholder: header, tab strip, stats and two panels. */
export default function LoadingAcademics() {
    return (
        <SkeletonRegion label="academics">
            <div className="space-y-6">
                <div className="flex items-start gap-3 border-b border-slate-200 pb-6">
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-3.5 w-64" />
                    </div>
                </div>
                <div className="flex gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-24 rounded-xl" />
                    ))}
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                    <SkeletonCard className="h-64" />
                    <SkeletonCard className="h-64" />
                </div>
            </div>
        </SkeletonRegion>
    );
}
