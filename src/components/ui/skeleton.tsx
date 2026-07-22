/** Local class joiner — this repo has no `cx()` helper in @/lib/utils. */
function cx(...parts: (string | false | null | undefined)[]): string {
    return parts.filter(Boolean).join(" ");
}

/**
 * Component-level loading placeholders.
 *
 * The full-screen `Preloader` is for a whole route; these are for a section that is still
 * fetching while the rest of the page is already usable (a tab, a list, a stats strip).
 * They reserve the real height of what's coming, so content never jumps in — which on a
 * slow phone connection is the difference between "loading" and "broken".
 *
 * The pulse is `motion-safe:` only, so it disappears under `prefers-reduced-motion`.
 */
export function Skeleton({ className }: { className?: string }) {
    return (
        <div
            aria-hidden
            className={cx(
                "motion-safe:animate-pulse rounded-lg bg-slate-100",
                className,
            )}
        />
    );
}

/** A card-shaped block, matching the app's rounded-2xl surfaces. */
export function SkeletonCard({ className }: { className?: string }) {
    return (
        <div
            aria-hidden
            className={cx(
                "motion-safe:animate-pulse rounded-2xl border border-slate-100 bg-slate-50",
                className,
            )}
        />
    );
}

/** `lines` stacked text bars; the last one is short, like real text. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
    return (
        <div aria-hidden className={cx("space-y-2", className)}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    className={cx("h-3", i === lines - 1 ? "w-2/3" : "w-full")}
                />
            ))}
        </div>
    );
}

/**
 * Wrap a loading region so screen readers announce it instead of reading a wall of empty
 * boxes. Pass the same label you'd use for the finished content ("Members").
 */
export function SkeletonRegion({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div role="status" aria-busy="true" aria-label={`Loading ${label}`}>
            <span className="sr-only">Loading {label}…</span>
            {children}
        </div>
    );
}
