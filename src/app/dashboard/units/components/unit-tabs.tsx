"use client";

import type { LucideIcon } from "lucide-react";

export interface UnitTab<T extends string> {
    id: T;
    label: string;
    icon: LucideIcon;
}

/** The tab bar inside a unit dialog. Scrolls sideways on a narrow phone rather than wrapping. */
export function UnitTabs<T extends string>({
    tabs,
    active,
    onChange,
}: {
    tabs: UnitTab<T>[];
    active: T;
    onChange: (id: T) => void;
}) {
    return (
        <div role="tablist" className="-mx-1 mb-5 flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1">
            {tabs.map(({ id, label, icon: Icon }) => (
                <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active === id}
                    onClick={() => onChange(id)}
                    className={`flex shrink-0 items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy ${
                        active === id ? "bg-white text-rcf-navy shadow-sm" : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {label}
                </button>
            ))}
        </div>
    );
}
