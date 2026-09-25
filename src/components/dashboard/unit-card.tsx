"use client";

import Link from "next/link";
import { AlertCircle, Layers, Mars, Users, Venus } from "lucide-react";
import { MemberAvatar } from "@/components/dashboard/roster/member-avatar";

export interface UnitCardLeader {
    id?: string;
    first_name: string;
    last_name: string;
    avatar_url?: string | null;
    gender?: string | null;
    isLead?: boolean;
}

export interface UnitCardData {
    name: string;
    type: "UNIT" | "TEAM" | string;
    is_workforce?: boolean | null;
    /** Brothers'/Sisters': everyone is in it by gender. */
    isGenderCategory?: boolean;
    /** Current leaders, the lead first. */
    leaders?: UnitCardLeader[];
    stats?: { total: number; male: number; female: number };
    memberCount?: number;
}

/**
 * One unit or team at a glance: name, kind, who leads it, and how many are in it.
 * Shared by Tenure → Workforce and the Workforce module, so the two lists look the
 * same. Deliberately compact: a phone shows several per screen, not one.
 *
 * With `href` the whole card links to the unit's page; `note` adds one line under the
 * name (e.g. the viewer's own office over the unit).
 */
export function UnitCard({ unit, href, note }: { unit: UnitCardData; href?: string; note?: string | null }) {
    const isUnit = unit.type === "UNIT";
    const isGenderCategory = isUnit && !!unit.isGenderCategory;
    const isLoose = isUnit && unit.is_workforce === false && !isGenderCategory;
    const leaders = unit.leaders ?? [];
    const lead = leaders[0];
    const others = leaders.length - 1;
    const s = unit.stats ?? { total: unit.memberCount ?? 0, male: 0, female: 0 };
    const Icon = isUnit ? Layers : Users;
    const kindTint = isUnit ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600";

    const body = (
        <>
            <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    <span className={`shrink-0 rounded-lg p-1.5 ${kindTint}`}>
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-slate-900" title={unit.name}>{unit.name}</h3>
                        {note && <p className="truncate text-[11px] font-semibold text-rcf-navy/80">{note}</p>}
                    </div>
                </div>
                <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                        isGenderCategory ? "bg-violet-50 text-violet-600" : isLoose ? "bg-slate-100 text-slate-500" : kindTint
                    }`}
                    title={
                        isGenderCategory
                            ? "Everyone is in it by gender: nothing to induct, and it doesn't count toward the workforce."
                            : isLoose
                                ? "Members belong here but don't count toward the workforce."
                                : undefined
                    }
                >
                    {isGenderCategory ? "By gender" : isLoose ? "Loose" : unit.type}
                </span>
            </div>

            {lead ? (
                <div className="flex min-w-0 items-center gap-2">
                    <MemberAvatar url={lead.avatar_url} first={lead.first_name} last={lead.last_name} gender={lead.gender} size={24} />
                    <p className="min-w-0 flex-1 truncate text-xs text-slate-700">
                        <span className="font-semibold">{lead.first_name} {lead.last_name}</span>
                        {lead.isLead === false && <span className="text-slate-400"> (assistant)</span>}
                    </p>
                    {others > 0 && (
                        <span
                            className="shrink-0 rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-500"
                            title={leaders.slice(1).map((l) => `${l.first_name} ${l.last_name}`).join(", ")}
                        >
                            +{others}
                        </span>
                    )}
                </div>
            ) : (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> No leader yet
                </p>
            )}

            <div className="mt-auto flex items-center gap-3 border-t border-slate-100 pt-2 text-xs">
                <span className="inline-flex items-center gap-1 font-bold text-slate-900" title="Members">
                    <Users className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" /> {s.total}
                </span>
                <span className="inline-flex items-center gap-1 text-sky-600" title="Brothers">
                    <Mars className="h-3.5 w-3.5" aria-hidden="true" /> {s.male}
                </span>
                <span className="inline-flex items-center gap-1 text-pink-600" title="Sisters">
                    <Venus className="h-3.5 w-3.5" aria-hidden="true" /> {s.female}
                </span>
            </div>
        </>
    );

    const frame = "flex h-full flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm";
    return href ? (
        <Link
            href={href}
            className={`${frame} transition-colors hover:border-rcf-navy/30 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy`}
        >
            {body}
        </Link>
    ) : (
        <div className={frame}>{body}</div>
    );
}

/** The grid both lists use: one column on a narrow phone, then 2 → 3 → 4. */
export const UNIT_CARD_GRID = "grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
