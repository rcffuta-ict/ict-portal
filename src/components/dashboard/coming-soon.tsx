import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";

interface ComingSoonProps {
    title: string;
    description?: string;
    icon?: LucideIcon;
}

/**
 * Placeholder for modules that are built but intentionally parked (Zones, Workforce).
 * Mobile-first, brand-toned, and fully static so it loads instantly on a slow
 * connection — no data fetch, no spinner.
 */
export function ComingSoon({ title, description, icon: Icon = Sparkles }: ComingSoonProps) {
    return (
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-blue-100 bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 p-8 text-center shadow-sm">
            <div className="inline-flex rounded-full bg-linear-to-br from-blue-500 to-purple-600 p-4 shadow-lg">
                <Icon className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-2">
                <h1 className="text-2xl font-bold text-rcf-navy">{title}</h1>
                <p className="text-sm text-slate-600">
                    {description ?? "This module is coming soon. The ICT team is working on it."}
                </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-1.5 text-xs font-semibold text-rcf-navy shadow-sm">
                Coming soon
            </span>
        </div>
    );
}
