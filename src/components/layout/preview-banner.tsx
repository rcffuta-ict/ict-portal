import { AlertTriangle } from "lucide-react";
import { getDeploymentRef, isPreviewDeployment } from "@/lib/env";

/**
 * Thin, always-visible strip telling testers this is NOT production.
 *
 * Server component with zero client JS — it renders only on a Vercel *preview*
 * deployment. Production and local dev render nothing at all, so neither pays
 * for it in markup or paint.
 *
 * Layout note: it's `fixed` rather than `sticky` because several screens
 * (dashboard, event pages) own their own scroll container or use `h-screen`,
 * so there is no single document-level flow it could stick to. The space it
 * occupies is reserved in `globals.css` via `body[data-preview-banner]`
 * (`--preview-banner-h`), which also nudges `sticky top-0` headers and
 * `h-screen`/`min-h-screen` shells down/short by the same amount.
 */
export function PreviewBanner() {
    if (!isPreviewDeployment()) return null;

    const ref = getDeploymentRef();

    return (
        <div
            role="status"
            aria-live="off"
            className="no-print safe-top fixed inset-x-0 top-0 z-[200] bg-rcf-gold text-rcf-navy shadow-sm"
        >
            <p className="flex h-7 items-center justify-center gap-1.5 px-3 text-[11px] font-semibold tracking-wide sm:text-xs">
                <AlertTriangle
                    className="h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                />
                <span className="truncate">
                    Preview build — not production. Data here may be reset.
                </span>
                {ref && (
                    <span className="hidden shrink-0 rounded bg-rcf-navy/10 px-1.5 py-0.5 font-mono text-[10px] font-medium sm:inline">
                        {ref}
                    </span>
                )}
            </p>
        </div>
    );
}
