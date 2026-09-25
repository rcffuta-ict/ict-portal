/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useState } from "react";
import { getUnitDetailsAction, removeWorkerAction } from "../actions";
import { Search, Trash2, User, Users, Info, Loader2, RefreshCw, Download, Crown, Mars, Venus, UserRound } from "lucide-react";
import { RosterCard } from "@/components/dashboard/roster/roster-card";
import { StatsStrip, StatsSkeleton, type StatItem } from "@/components/dashboard/roster/stats-strip";
import { GENDER_UNSPECIFIED_LABEL, tallyGender } from "@/lib/gender";
import { downloadCsv, fileSlug } from "@/lib/csv";
import { byLevel } from "@/lib/levels";
import { PaginatedGrid } from "@/components/dashboard/roster/paginated-grid";
import { isGenderCategoryUnit } from "@/config/fellowship-units";
import { useAlertModal, AlertModal } from "@/components/ui/alert-modal";
import { AddWorkersForm } from "./add-workers-form";

/**
 * One unit's roster: load, add, remove.
 *
 * Loads its own members rather than taking them as a prop. It used to copy an
 * `initialMembers` prop into state once — but the parent mounted it before the fetch
 * came back, so the copy was always the empty list and a unit's members never showed.
 *
 * `readOnly` is for the President, who sees every unit but is write-blocked. The server
 * refuses writes regardless; hiding the controls just avoids offering a button that
 * always fails.
 */
export function UnitManager({
    unit,
    readOnly = false,
    onChanged,
}: {
    unit: { id: string; name: string; slug?: string | null };
    readOnly?: boolean;
    /** Called after a successful add/remove, so the parent can refresh its counts. */
    onChanged?: () => void;
}) {
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [levelFilter, setLevelFilter] = useState("all");
    const { isOpen, alertConfig, showAlert, closeAlert } = useAlertModal();

    // Brothers'/Sisters': the roster is computed from gender, so there is nothing here
    // to add to or remove from.
    const isDerived = isGenderCategoryUnit(unit.slug ?? null);
    const canEdit = !readOnly && !isDerived;

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        const res = await getUnitDetailsAction(unit.id);
        if (res.success) setMembers(res.data);
        else setLoadError(res.error || "Couldn't load this roster.");
        setLoading(false);
    }, [unit.id]);

    useEffect(() => {
        // Deferred a tick so the fetch's setState calls happen outside the effect body.
        const t = setTimeout(load, 0);
        return () => clearTimeout(t);
    }, [load]);

    const handleRemove = (membershipId: string, who: string) => {
        showAlert({
            type: "warning",
            title: "Remove worker?",
            message: `Remove ${who} from ${unit.name}?`,
            confirmText: "Remove",
            onConfirm: async () => {
                const res = await removeWorkerAction(membershipId);
                if (!res.success) {
                    showAlert({ type: "error", message: res.error || "Couldn't remove that member." });
                    return;
                }
                await load();
                onChanged?.();
            },
        });
    };

    const q = search.toLowerCase();
    // The levels actually present, in order, so the filter never offers an empty choice.
    const levelsPresent = [...new Set(members.map((m: any) => m.level as string | null).filter(Boolean))]
        .sort(byLevel) as string[];
    const filtered = members.filter(
        (m: any) =>
            (levelFilter === "all" || (m.level ?? "") === levelFilter) &&
            ((m.first_name ?? "").toLowerCase().includes(q) ||
                (m.last_name ?? "").toLowerCase().includes(q)),
    );
    const isFiltered = !!search.trim() || levelFilter !== "all";

    /** Exactly what's on screen after filtering — what you see is what you download. */
    const exportCsv = () => {
        downloadCsv(
            `${fileSlug(unit.name)}${levelFilter !== "all" ? `-${fileSlug(levelFilter)}` : ""}-members.csv`,
            ["First name", "Last name", "Email", "Phone", "Level", "Generation", "Department", "Role"],
            filtered.map((m: any) => [
                m.first_name, m.last_name, m.email, m.phone_number,
                m.level, m.generation, m.department, m.role,
            ]),
        );
    };

    return (
        <div className="space-y-5">
            <AlertModal isOpen={isOpen} onClose={closeAlert} {...alertConfig} />

            {isDerived ? (
                <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                    <div className="text-xs leading-relaxed text-blue-900">
                        <p className="font-bold">This list is not edited — it is counted.</p>
                        <p className="mt-1 text-blue-800">
                            Every member of the fellowship is in {unit.name} by gender, so
                            there is no induction and no roster to curate. To correct
                            somebody&apos;s membership, correct their gender on their profile.
                        </p>
                    </div>
                </div>
            ) : canEdit ? (
                <AddWorkersForm
                    unitId={unit.id}
                    unitName={unit.name}
                    onAdded={() => {
                        void load();
                        onChanged?.();
                    }}
                />
            ) : null}

            {/* Stats — the same strip as Levels, with Workforce's own figures. */}
            {loading ? <StatsSkeleton /> : !loadError && <StatsStrip items={unitStatItems(members)} />}

            {/* The roster, in the same frame as Levels'. */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="flex items-center gap-2 font-bold text-slate-700">
                        <Users className="h-4 w-4" aria-hidden="true" /> {isDerived ? "Members" : "Workers"}
                        {!loading && !loadError && (
                            <span className="text-xs font-medium text-slate-400">
                                {isFiltered ? `${filtered.length} of ${members.length}` : members.length}
                            </span>
                        )}
                    </h4>
                    <button
                        type="button"
                        onClick={exportCsv}
                        disabled={loading || filtered.length === 0}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:border-rcf-navy/40 hover:text-rcf-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy disabled:opacity-40"
                    >
                        <Download className="h-4 w-4" aria-hidden="true" />
                        {isFiltered ? `Export ${filtered.length}` : "Export CSV"}
                    </button>
                </div>

                {/* Search and level filter — stack on a phone so neither is squeezed. */}
                <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name"
                            aria-label={`Search ${unit.name} members`}
                            className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rcf-navy focus:outline-none"
                        />
                    </div>
                    <select
                        value={levelFilter}
                        onChange={(e) => setLevelFilter(e.target.value)}
                        aria-label={`Filter ${unit.name} members by level`}
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-rcf-navy focus:outline-none sm:w-44"
                    >
                        <option value="all">All levels</option>
                        {levelsPresent.map((l) => (
                            <option key={l} value={l}>{l}</option>
                        ))}
                    </select>
                </div>

                {loading ? (
                    <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500" role="status">
                        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                        Loading members…
                    </p>
                ) : loadError ? (
                    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        <p>{loadError}</p>
                        <button
                            type="button"
                            onClick={load}
                            className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-red-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                        >
                            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
                        </button>
                    </div>
                ) : (
                    <PaginatedGrid
                        items={filtered}
                        label={`${unit.name} members`}
                        resetKey={`${search}|${levelFilter}`}
                        getKey={(m: any) => m.membershipId || m.id}
                        empty={
                            <p className="rounded-xl border-2 border-dashed border-slate-100 py-10 text-center text-sm text-slate-400">
                                <User className="mx-auto mb-2 h-8 w-8 opacity-20" aria-hidden="true" />
                                {isFiltered
                                    ? "Nobody matches that filter."
                                    : isDerived
                                        ? "No member is recorded with this gender yet."
                                        : "No members in this unit yet."}
                            </p>
                        }
                        renderItem={(m: any) => {
                            const who = `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || "this member";
                            return (
                                <RosterCard
                                    href={`/dashboard/units/${unit.id}/member/${m.id}`}
                                    firstName={m.first_name}
                                    lastName={m.last_name}
                                    gender={m.gender}
                                    avatarUrl={m.avatar_url}
                                    email={m.email}
                                    phone={m.phone_number}
                                    meta={[m.level, m.department].filter(Boolean).join(" · ") || null}
                                    badge={
                                        m.excoOffice ? (
                                            <span
                                                title={m.excoOffice}
                                                className="inline-flex shrink-0 items-center gap-0.5 rounded bg-rcf-gold/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rcf-navy"
                                            >
                                                <Crown className="h-2.5 w-2.5" aria-hidden="true" /> Exco
                                            </span>
                                        ) : null
                                    }
                                    action={
                                        canEdit && !m.derived ? (
                                            <button
                                                type="button"
                                                onClick={() => handleRemove(m.membershipId, who)}
                                                aria-label={`Remove ${who}`}
                                                className="rounded-full p-2.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                            >
                                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                            </button>
                                        ) : null
                                    }
                                />
                            );
                        }}
                    />
                )}
            </section>
        </div>
    );
}

/**
 * Workforce's figures, in the strip Levels uses. Executives are the unit's members who
 * hold an Exco office this tenure — lead or assistant, any unit's.
 */
function unitStatItems(members: any[]): StatItem[] {
    const g = tallyGender(members, (m: any) => m.gender);
    const items: StatItem[] = [
        { label: "Total", value: members.length, icon: Users, tone: "text-slate-700 bg-slate-100" },
        { label: "Male", value: g.male, icon: Mars, tone: "text-sky-600 bg-sky-50" },
        { label: "Female", value: g.female, icon: Venus, tone: "text-pink-600 bg-pink-50" },
        { label: "Executives", value: members.filter((m: any) => m.excoOffice).length, icon: Crown, tone: "text-amber-700 bg-amber-50" },
    ];
    if (g.unspecified > 0) {
        items.push({ label: GENDER_UNSPECIFIED_LABEL, value: g.unspecified, icon: UserRound, tone: "text-slate-600 bg-slate-100" });
    }
    return items;
}
