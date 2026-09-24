import Link from "next/link";
import { ChevronRight, ArrowLeft } from "lucide-react";

export interface Crumb {
    label: string;
    href?: string;
}

/**
 * Breadcrumb trail with a real back button.
 *
 * On a phone the trail can wrap to two lines and its links are small tap targets, so any
 * subpage also gets an explicit 40px back control pointing at its parent crumb — the
 * quickest way out of a nested page without hunting for the browser chrome.
 */
export function Breadcrumb({ items }: { items: Crumb[] }) {
    // Nearest ancestor with a link — i.e. the parent of the page being viewed.
    const parent = [...items].reverse().find((it) => it.href);

    return (
        <div className="flex items-center gap-2">
            {parent && items.length > 1 && (
                <Link
                    href={parent.href!}
                    aria-label={`Back to ${parent.label}`}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-rcf-navy/40 hover:text-rcf-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rcf-navy"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Link>
            )}
            <nav
                aria-label="Breadcrumb"
                className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-slate-500"
            >
                {items.map((it, i) => (
                    <span key={`${it.label}-${i}`} className="flex items-center gap-1.5">
                        {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
                        {it.href ? (
                            <Link href={it.href} className="hover:text-rcf-navy transition-colors">
                                {it.label}
                            </Link>
                        ) : (
                            <span className="font-semibold text-slate-800">{it.label}</span>
                        )}
                    </span>
                ))}
            </nav>
        </div>
    );
}
