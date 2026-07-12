"use client";

import { Lock } from "lucide-react";
import { PRIVILEGE_META, scopeLabel, normalizePrivileges } from "@/lib/privileges";

/**
 * Read-only display of a position's privilege tags as colour-coded pills. The ICT
 * Coordinator (slug `ict-coord`) is the System Admin — shown as a single locked pill
 * regardless of stored rows. Accepts raw DB rows or builder-shaped privileges.
 */
export function PrivilegePills({
    privileges,
    slug,
    emptyLabel = "No privileges",
}: {
    privileges?: ({ tag?: string; privilege?: string; scope?: string | null } | null)[] | null;
    slug?: string | null;
    emptyLabel?: string;
}) {
    if (slug === "ict-coord") {
        return (
            <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                <Lock className="h-3 w-3" /> System Admin
            </span>
        );
    }

    const list = normalizePrivileges(privileges);
    if (list.length === 0) {
        return <span className="text-xs italic text-slate-400">{emptyLabel}</span>;
    }

    return (
        <div className="flex flex-wrap gap-1">
            {list.map((p, i) => (
                <span
                    key={`${p.tag}-${p.scope ?? "all"}-${i}`}
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${PRIVILEGE_META[p.tag].colorClasses}`}
                    title={PRIVILEGE_META[p.tag].description}
                >
                    {scopeLabel(p)}
                </span>
            ))}
        </div>
    );
}
