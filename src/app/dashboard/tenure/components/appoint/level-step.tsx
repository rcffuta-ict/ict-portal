/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo } from "react";
import { Users, Sparkles, Info } from "lucide-react";
import { computeLevel } from "@/lib/levels";
import { normalizePrivileges } from "@/lib/privileges";
import { expectedLevelForOffice, levelScopeOf } from "./appoint-shared";

/**
 * Step 2 — which generation to draw the appointee from.
 *
 * This exists because the fellowship is several hundred people and a bare search box
 * over all of them is not a way to find anybody. A level is twenty or thirty members,
 * which is a list you can actually read.
 *
 * The expected level is pre-selected for a level-scoped office but nothing is locked —
 * see `expectedLevelForOffice` for why the 100 Level Coordinator makes a lock wrong.
 */
export function LevelStep({
    office,
    families,
    session,
    onPick,
}: {
    office: any;
    families: any[];
    session: string | null;
    onPick: (generation: any) => void;
}) {
    const privileges = useMemo(
        () => normalizePrivileges(office?.position_privileges),
        [office],
    );
    const expected = expectedLevelForOffice(privileges);
    const scope = levelScopeOf(privileges);

    const generations = useMemo(() => {
        return (families ?? [])
            .map((family: any) => ({
                ...family,
                levelLabel:
                    computeLevel(family.entry_year, family.is_foundation, session) ??
                    family.family_name ??
                    `${family.entry_year ?? "?"} Set`,
            }))
            // Seniors first: an appointment is more often a senior than a fresher, and
            // the ordering should put the likely answer under the thumb on a phone.
            .sort((a: any, b: any) => (a.entry_year ?? 0) - (b.entry_year ?? 0));
    }, [families, session]);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-bold text-slate-900">Which generation?</h3>
                <p className="mt-1 text-sm text-slate-500">
                    Narrow down to one level, then pick the member. You can choose any
                    level — this only decides whose names you search through.
                </p>
            </div>

            {expected && (
                <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <p className="text-xs leading-relaxed text-blue-900">
                        <span className="font-bold">{expected} is the usual choice</span> for{" "}
                        {office.alias || office.title}, so it is highlighted below. It is not a
                        restriction — a junior level is normally coordinated by a senior, so
                        pick whichever generation the appointee is actually in.
                    </p>
                </div>
            )}

            {scope === "all" && (
                <div className="flex items-start gap-3 rounded-xl border border-violet-100 bg-violet-50 p-4">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                    <p className="text-xs leading-relaxed text-violet-900">
                        This office carries authority over <span className="font-bold">every
                        generation</span>, so no level is assumed.
                    </p>
                </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {generations.map((generation: any) => {
                    const isExpected = expected != null && generation.levelLabel === expected;
                    const stats = generation.stats ?? { male: 0, female: 0 };
                    return (
                        <button
                            key={generation.id}
                            type="button"
                            onClick={() => onPick(generation)}
                            className={`flex min-h-11 flex-col gap-2 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rcf-navy ${
                                isExpected
                                    ? "border-rcf-navy bg-rcf-navy/5 hover:bg-rcf-navy/10"
                                    : "border-slate-200 bg-white hover:border-rcf-navy/40 hover:bg-slate-50"
                            }`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="truncate text-base font-bold text-slate-900">
                                        {generation.levelLabel}
                                    </p>
                                    <p className="truncate text-[11px] text-slate-400">
                                        {generation.family_name || `${generation.entry_year} Set`}
                                    </p>
                                </div>
                                {isExpected && (
                                    <span className="shrink-0 rounded border border-rcf-navy/20 bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rcf-navy">
                                        Expected
                                    </span>
                                )}
                            </div>

                            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                <Users className="h-3.5 w-3.5 text-slate-400" />
                                {generation.memberCount ?? 0}{" "}
                                {generation.memberCount === 1 ? "member" : "members"}
                                <span className="text-slate-300">·</span>
                                <span className="text-slate-400">
                                    {stats.male} brothers, {stats.female} sisters
                                </span>
                            </p>
                        </button>
                    );
                })}
            </div>

            {generations.length === 0 && (
                <p className="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
                    No generations exist yet. Create them on the Generations tab first.
                </p>
            )}
        </div>
    );
}
