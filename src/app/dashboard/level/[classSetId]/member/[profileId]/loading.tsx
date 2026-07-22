import { Skeleton, SkeletonCard, SkeletonRegion } from "@/components/ui/skeleton";

/** Member page placeholder: breadcrumb + back button, identity header, detail sections. */
export default function LoadingMember() {
    return (
        <SkeletonRegion label="member">
            <div className="space-y-6">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <Skeleton className="h-4 w-64" />
                </div>

                <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                    <Skeleton className="h-16 w-16 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-44" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <SkeletonCard key={i} className="h-44 rounded-xl" />
                    ))}
                </div>
            </div>
        </SkeletonRegion>
    );
}
