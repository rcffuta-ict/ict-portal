"use client";

import type { LucideIcon } from "lucide-react";

export interface WorkspaceTab<T extends string> {
    id: T;
    label: string;
    icon: LucideIcon;
    /** A short tag after the label, e.g. "Soon" on a tab whose feature isn't built yet. */
    badge?: string;
}

/**
 * The tab strip of a roster workspace — a generation (Levels) or a unit (Workforce).
 * Same look in both, so moving between the two modules feels like one tool.
 *
 * Scrolls sideways on a narrow phone rather than wrapping, and hides itself when there
 * is only one tab: a strip with a single button is a label pretending to be a control.
 */
export function WorkspaceTabs<T extends string>({
    tabs,
    active,
    onChange,
    label,
}: {
    tabs: WorkspaceTab<T>[];
    active: T;
    onChange: (id: T) => void;
    /** Names the strip for screen readers, e.g. "Unit sections". */
    label: string;
}) {
    if (tabs.length < 2) return null;
    return (
        <div role="tablist" aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            {tabs.map((t) => {
                const on = active === t.id;
                return (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        onClick={() => onChange(t.id)}
                        className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rcf-navy ${
                            on
                                ? "bg-rcf-navy text-white shadow-sm"
                                : "border border-slate-200 bg-white text-slate-600 hover:text-rcf-navy"
                        }`}
                    >
                        <t.icon className="h-4 w-4" aria-hidden="true" />
                        {t.label}
                        {t.badge && (
                            <span
                                className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                                    on ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"
                                }`}
                            >
                                {t.badge}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
