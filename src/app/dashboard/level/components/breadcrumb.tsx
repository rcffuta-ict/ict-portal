import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
    label: string;
    href?: string;
}

/** Simple, wrapping breadcrumb trail. The last item (no href) is the current page. */
export function Breadcrumb({ items }: { items: Crumb[] }) {
    return (
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
            {items.map((it, i) => (
                <span key={`${it.label}-${i}`} className="flex items-center gap-1.5">
                    {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300" />}
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
    );
}
