import { Skeleton, SkeletonCard, SkeletonRegion } from "@/components/ui/skeleton";

/** Level index placeholder: header + generation card grid. */
export default function LoadingLevels() {
    return (
        <SkeletonRegion label="levels">
            <div className="space-y-6">
                <div className="flex items-start gap-3 border-b border-slate-200 pb-6">
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-3.5 w-64" />
                    </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <SkeletonCard key={i} className="h-52" />
                    ))}
                </div>
            </div>
        </SkeletonRegion>
    );
}
