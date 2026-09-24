"use client";

import type { LucideIcon } from "lucide-react";
import { SkeletonCard, SkeletonRegion } from "@/components/ui/skeleton";

export interface StatItem {
    label: string;
    value: number;
    icon: LucideIcon;
    /** Icon chip colours, e.g. "text-sky-600 bg-sky-50". */
    tone: string;
}

/**
 * The row of headline numbers above a roster — Levels and Workforce show different
 * figures in the same strip. Two to a row on a phone, five from `xl`.
 */
export function StatsStrip({ items }: { items: StatItem[] }) {
    return (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {items.map((s) => (
                <div key={s.label} className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3">
                    <span className={`rounded-lg p-2 ${s.tone}`}>
                        <s.icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                        <dt className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.label}</dt>
                        <dd className="text-lg font-bold leading-tight text-slate-900">{s.value}</dd>
                    </span>
                </div>
            ))}
        </dl>
    );
}

/** Same footprint as StatsStrip, so the page doesn't jump when the numbers arrive. */
export function StatsSkeleton({ count = 5 }: { count?: number }) {
    return (
        <SkeletonRegion label="statistics">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                {Array.from({ length: count }).map((_, i) => (
                    <SkeletonCard key={i} className="h-15.5 rounded-xl" />
                ))}
            </div>
        </SkeletonRegion>
    );
}
