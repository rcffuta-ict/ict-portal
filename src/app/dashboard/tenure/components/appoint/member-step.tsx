/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, GraduationCap, Phone, BadgeCheck, KeyRound, AlertTriangle } from "lucide-react";
import FormInput from "@/components/ui/FormInput";
import { getGenerationRosterAction } from "../../actions";
import { fellowshipTitle } from "@/lib/gender";

/**
 * Step 3 — who.
 *
 * The whole generation is fetched once and filtered in the browser. A level is twenty
 * or thirty members, so the payload is small, and filtering locally is what makes the
 * search feel instant: the old flow debounced 500ms and hit the server on every
 * keystroke, which on mid-range Android over mobile data is a visible stall between
 * typing a name and seeing it.
 */
export function MemberStep({
    office,
    generation,
    sittingLead,
    onConfirm,
    submitting,
}: {
    office: any;
    generation: any;
    sittingLead?: any;
    onConfirm: (member: any, isLead: boolean) => void;
    submitting: boolean;
}) {
    const [roster, setRoster] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<any>(null);
    // Defaults to Assistant when the office is already led, because Lead is the one
    // choice the server will refuse -- the default should be the thing that works.
    const [isLead, setIsLead] = useState(!sittingLead);

    const holderName = sittingLead?.profile
        ? `${sittingLead.profile.first_name} ${sittingLead.profile.last_name}`
        : null;

    // No synchronous setState here: the parent gives this component `key={generation.id}`,
    // so switching generations REMOUNTS it and the initial state is already "loading".
    // Resetting the flags at the top of the effect instead would be a state write during
    // render-commit, which the React Compiler rightly objects to.
    useEffect(() => {
        let cancelled = false;
        getGenerationRosterAction(generation.id)
            .then((res) => {
                if (cancelled) return;
                if (res.success) setRoster(res.data);
                else setError(res.error || "Could not load this generation.");
            })
            .catch(() => {
                if (!cancelled) setError("Could not load this generation.");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [generation.id]);

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return roster;
        return roster.filter((m) =>
            `${m.first_name} ${m.middle_name ?? ""} ${m.last_name} ${m.matric_number ?? ""} ${m.department ?? ""} ${m.email ?? ""}`
                .toLowerCase()
                .includes(needle),
        );
    }, [roster, query]);

    if (loading) {
        return (
            <p className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                Loading {generation.levelLabel}…
            </p>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                {error}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-bold text-slate-900">Who is being appointed?</h3>
                <p className="mt-1 text-sm text-slate-500">
                    {roster.length} {roster.length === 1 ? "member" : "members"} in{" "}
                    {generation.levelLabel}.
                </p>
            </div>

            {holderName && (
                // Said here, before the choice, rather than as an error after it. The
                // reassuring half matters as much as the warning: appointing an
                // assistant takes nothing away from the person already serving, and
                // assistants hold the office's privileges too, because privileges come
                // from the POSITION.
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <div className="text-xs leading-relaxed text-amber-900">
                        <p className="font-bold">
                            {holderName} already leads {office.alias || office.title}.
                        </p>
                        <p className="mt-1">
                            An office has one lead at a time, so whoever you pick will be added
                            as an <span className="font-bold">assistant</span> — which carries
                            the same privileges and takes nothing away from {holderName}.
                        </p>
                        <p className="mt-1">
                            To hand the office over instead, remove {holderName} from it on the
                            Roster first. Their service is kept on record.
                        </p>
                    </div>
                </div>
            )}

            <FormInput
                type="search"
                placeholder="Search this level by name, matric or department…"
                value={query}
                onChange={(e: any) => setQuery(e.target.value)}
                leftIcon={<Search className="h-5 w-5" />}
                aria-label={`Search ${generation.levelLabel}`}
            />

            {filtered.length === 0 && (
                <p className="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
                    {roster.length === 0
                        ? "Nobody is recorded in this generation yet."
                        : `Nobody in ${generation.levelLabel} matches “${query}”.`}
                </p>
            )}

            <div className="space-y-2">
                {filtered.map((member) => {
                    const isSelected = selected?.id === member.id;
                    return (
                        <button
                            key={member.id}
                            type="button"
                            onClick={() => setSelected(isSelected ? null : member)}
                            className={`flex w-full min-h-11 items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rcf-navy ${
                                isSelected
                                    ? "border-rcf-navy bg-rcf-navy/5"
                                    : "border-slate-200 bg-white hover:border-rcf-navy/40 hover:bg-slate-50"
                            }`}
                        >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                                {member.first_name?.[0]}
                                {member.last_name?.[0]}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                    <span className="truncate text-sm font-bold text-slate-900">
                                        {member.first_name} {member.last_name}
                                    </span>
                                    <span className="shrink-0 text-[10px] font-medium text-slate-400">
                                        {fellowshipTitle(member.gender)}
                                    </span>
                                </span>
                                <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                                    {member.matric_number && (
                                        <span className="font-mono">{member.matric_number}</span>
                                    )}
                                    {member.department && (
                                        <span className="flex items-center gap-1">
                                            <GraduationCap className="h-3 w-3" />
                                            {member.department}
                                        </span>
                                    )}
                                    {member.phone_number && (
                                        <span className="flex items-center gap-1">
                                            <Phone className="h-3 w-3" />
                                            {member.phone_number}
                                        </span>
                                    )}
                                </span>
                                {member.offices?.length > 0 && (
                                    // Shown BEFORE appointing, not after: giving somebody a
                                    // second office is sometimes right and sometimes an
                                    // accident, and only the appointer can tell which.
                                    <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-700">
                                        <BadgeCheck className="h-3 w-3 shrink-0" />
                                        Already holds: {member.offices.join(", ")}
                                    </span>
                                )}
                            </span>
                        </button>
                    );
                })}
            </div>

            {selected && (
                <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
                    <p className="text-sm text-slate-700">
                        Appoint{" "}
                        <span className="font-bold">
                            {selected.first_name} {selected.last_name}
                        </span>{" "}
                        as <span className="font-bold">{office.alias || office.title}</span>.
                    </p>

                    <div className="mt-3 flex gap-2">
                        {([
                            [true, "Lead", "Holds the office."],
                            [false, "Assistant", "Serves under the lead."],
                        ] as const).map(([value, label, hint]) => {
                            const blocked = value === true && !!holderName;
                            return (
                                <button
                                    key={label}
                                    type="button"
                                    disabled={blocked}
                                    onClick={() => setIsLead(value)}
                                    title={blocked ? `${holderName} already leads this office.` : hint}
                                    className={`min-h-11 flex-1 rounded-lg border px-3 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                        isLead === value && !blocked
                                            ? "border-rcf-navy bg-rcf-navy text-white"
                                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>

                    {office.grants_login && (
                        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-amber-700">
                            <KeyRound className="mt-0.5 h-3 w-3 shrink-0" />
                            This office grants portal access — they will be able to sign in with{" "}
                            {selected.email || "their email"} and set a password on first login.
                        </p>
                    )}

                    <button
                        type="button"
                        disabled={submitting}
                        onClick={() => onConfirm(selected, isLead)}
                        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-rcf-navy px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                        {submitting && (
                            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                        )}
                        {submitting ? "Appointing…" : "Confirm appointment"}
                    </button>
                </div>
            )}
        </div>
    );
}
