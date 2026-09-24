"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
    AlertTriangle,
    ArrowRight,
    ArrowRightLeft,
    Crown,
    GraduationCap,
    KeyRound,
    Layers,
    RefreshCw,
    Users,
    UsersRound,
} from "lucide-react";
import { getSessionInsightAction } from "../actions";
import type { SessionInsight as Insight } from "@/lib/session-insight";

type TabId = "structure" | "cabinet" | "families" | "transfers";

/**
 * How is the session actually faring?
 *
 * Every panel answers "so what", not just "how many", and ends in a link to the screen
 * where something can be done about it — a number you can't act on is decoration.
 *
 * Charts are deliberately plain: one hue (the session's primary, so they follow the
 * palette) on a lighter track of the same hue; every bar carries its number in text,
 * because the light shade alone is under 3:1 against white. Warnings are amber with an
 * icon AND a word, never colour alone.
 */
export function SessionInsight({
    refreshToken,
    onNavigate,
}: {
    /** Changes whenever the page's data is refreshed, so the panels follow. */
    refreshToken?: unknown;
    onNavigate: (tab: TabId) => void;
}) {
    const [data, setData] = useState<Insight | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        const res = await getSessionInsightAction();
        if (res.success) setData(res.data);
        else setError(res.error || "Couldn't work out the session's figures.");
        setLoading(false);
    }, []);

    useEffect(() => {
        const t = setTimeout(load, 0);
        return () => clearTimeout(t);
    }, [load, refreshToken]);

    if (loading && !data) return <InsightSkeleton />;

    if (error && !data) {
        return (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                <p>{error}</p>
                <button
                    type="button"
                    onClick={load}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
                </button>
            </div>
        );
    }
    if (!data) return null;

    return <InsightPanels data={data} loading={loading} onNavigate={onNavigate} />;
}

/** The panels themselves, from a computed insight. Pure — no fetching. */
export function InsightPanels({
    data,
    loading = false,
    onNavigate,
}: {
    data: Insight;
    loading?: boolean;
    onNavigate: (tab: TabId) => void;
}) {
    const { coverage, units, teams, cabinet, generations, access, pendingTransfers } = data;
    const emptyUnits = units.filter((u) => !u.byGender && u.members === 0);
    const noExco = units.filter((u) => !u.hasExco);
    // Gender-based units hold half the fellowship each; scaling against them would
    // flatten every real workforce unit into a stub. They get their own line instead.
    const workforceUnits = units.filter((u) => !u.byGender);
    const genderUnits = units.filter((u) => u.byGender);
    const maxUnit = Math.max(1, ...workforceUnits.map((u) => u.members));
    const activeGenerations = generations.filter((g) => g.level !== "Alumni");
    const alumni = generations.filter((g) => g.level === "Alumni");

    return (
        <div className="space-y-4 sm:space-y-6" aria-busy={loading}>
            {/* --- Headline: coverage ------------------------------------------- */}
            <section aria-labelledby="coverage-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h3 id="coverage-title" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Workforce coverage
                </h3>
                <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
                    <p className="text-5xl font-bold leading-none text-rcf-navy sm:text-6xl">{coverage.percent}%</p>
                    <p className="pb-1 text-sm text-slate-600">
                        <strong className="text-slate-900">{coverage.workers}</strong> of{" "}
                        <strong className="text-slate-900">{coverage.members}</strong> members are workers
                    </p>
                </div>

                <Meter
                    value={coverage.workers}
                    max={coverage.members}
                    label={`${coverage.workers} of ${coverage.members} members are workers`}
                    className="mt-4 h-3"
                />

                <p className="mt-4 text-sm leading-relaxed text-slate-700">
                    {coverage.members === 0
                        ? "No members are registered yet — share the registration links with each generation."
                        : coverage.notInUnit === 0
                            ? "Every member belongs to a unit. The whole fellowship is serving."
                            : `${coverage.notInUnit} member${coverage.notInUnit === 1 ? " is" : "s are"} in no unit. Unit leaders may need to register their people, or the next induction needs planning.`}
                </p>
                <PanelLink href="/dashboard/units">Open Workforce</PanelLink>
            </section>

            {/* --- KPI row ---------------------------------------------------------- */}
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi icon={Users} label="Members" value={coverage.members} />
                <Kpi icon={UsersRound} label="Workers" value={coverage.workers} />
                <Kpi
                    icon={Layers}
                    label="Units · teams"
                    value={`${units.length} · ${teams.total}`}
                    note={teams.empty ? `${teams.empty} team${teams.empty === 1 ? "" : "s"} empty` : undefined}
                />
                <Kpi icon={Crown} label="Offices filled" value={`${cabinet.filled}/${cabinet.total}`} />
            </dl>

            {/* --- Units at a glance ---------------------------------------------- */}
            {/* Full width, with the units as a grid of tiles: a single column of every
            unit was the longest thing on the page, and on a phone two tiles a row
            halves the scroll to reach the panels below. */}
            <Panel
                icon={Layers}
                title="Units at a glance"
                summary={
                    emptyUnits.length || noExco.length
                        ? [
                            emptyUnits.length && `${emptyUnits.length} with no members`,
                            noExco.length && `${noExco.length} with no Executive`,
                        ].filter(Boolean).join(" · ")
                        : "Every unit has members and an Executive."
                }
                action={<PanelLink href="/dashboard/units">Manage units</PanelLink>}
            >
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
                    {workforceUnits.map((u) => (
                        <li
                            key={u.id}
                            className={`flex flex-col rounded-xl border p-3 ${
                                u.members === 0 || !u.hasExco ? "border-amber-200 bg-amber-50/40" : "border-slate-100 bg-slate-50"
                            }`}
                        >
                            <span className="line-clamp-2 text-sm font-medium leading-snug text-slate-800">{u.name}</span>
                            <span className="mt-auto pt-2 text-xl font-bold tabular-nums text-rcf-navy">
                                {u.members}
                                <span className="sr-only"> member{u.members === 1 ? "" : "s"}</span>
                            </span>
                            <Meter
                                value={u.members}
                                max={maxUnit}
                                label={`${u.name}: ${u.members} member${u.members === 1 ? "" : "s"}`}
                                className="mt-1 h-1.5"
                            />
                            {(!u.hasExco || u.members === 0) && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {u.members === 0 && <Flag>No members</Flag>}
                                    {!u.hasExco && <Flag>No Executive</Flag>}
                                </div>
                            )}
                        </li>
                    ))}
                    {workforceUnits.length === 0 && <Empty>No units are set up yet.</Empty>}
                </ul>
                {genderUnits.length > 0 && (
                    <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500">
                        <span className="font-semibold text-slate-600">By gender, not induction: </span>
                        {genderUnits.map((u, i) => (
                            <span key={u.id}>
                                {i > 0 && " · "}
                                {u.name} <span className="tabular-nums">{u.members}</span>
                                {!u.hasExco && <span className="font-semibold text-amber-700"> (no Executive)</span>}
                            </span>
                        ))}
                    </p>
                )}
            </Panel>

            <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                {/* --- Cabinet completeness ------------------------------------- */}
                <Panel
                    icon={Crown}
                    title="Cabinet"
                    summary={
                        cabinet.total === cabinet.filled
                            ? "Every office has a lead."
                            : `${cabinet.total - cabinet.filled} office${cabinet.total - cabinet.filled === 1 ? "" : "s"} still to appoint.`
                    }
                    action={<PanelButton onClick={() => onNavigate("cabinet")}>Appoint in Cabinet</PanelButton>}
                >
                    <ul className="space-y-4">
                        {cabinet.tiers.map((t) => (
                            <li key={t.tier}>
                                <div className="flex items-baseline justify-between gap-3 text-sm">
                                    <span className="font-medium text-slate-800">{t.label}</span>
                                    <span className="shrink-0 tabular-nums text-slate-600">
                                        {t.filled} of {t.total} filled
                                    </span>
                                </div>
                                <Meter value={t.filled} max={t.total} label={`${t.label}: ${t.filled} of ${t.total} filled`} className="mt-1 h-1.5" />
                                {t.vacant.length > 0 && (
                                    <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                                        <span className="font-semibold text-slate-600">Vacant: </span>
                                        {t.vacant.slice(0, 6).map((v, i) => (
                                            <span key={v.title}>
                                                {i > 0 && ", "}
                                                {v.title}
                                                {v.honorary && <span className="text-slate-400"> (honorary)</span>}
                                            </span>
                                        ))}
                                        {t.vacant.length > 6 && ` and ${t.vacant.length - 6} more`}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                </Panel>

                {/* --- Generations ------------------------------------------------- */}
                <Panel
                    icon={GraduationCap}
                    title="Generations"
                    summary={generationSummary(activeGenerations)}
                    action={<PanelButton onClick={() => onNavigate("families")}>Open Generations</PanelButton>}
                >
                    {/* Legend: two shades of one hue, so it must be spelled out. */}
                    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" aria-hidden="true">
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-sm bg-rcf-navy" /> Workers
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-sm bg-rcf-navy/30" /> Not in a unit
                        </span>
                    </div>
                    <ul className="space-y-3">
                        {activeGenerations.map((g) => (
                            <li key={g.id}>
                                <div className="flex items-baseline justify-between gap-3 text-sm">
                                    <span className="min-w-0 truncate">
                                        <span className="font-medium text-slate-800">{g.name}</span>
                                        {g.level && <span className="text-slate-500"> · {g.level}</span>}
                                    </span>
                                    <span className="shrink-0 tabular-nums text-slate-600">{g.members}</span>
                                </div>
                                <Split workers={g.workers} members={g.members} name={g.name} />
                                <p className="mt-1 text-xs tabular-nums text-slate-500">
                                    {g.workers} worker{g.workers === 1 ? "" : "s"} · {g.male} M · {g.female} F
                                    {g.unspecified > 0 && ` · ${g.unspecified} unspecified`}
                                </p>
                            </li>
                        ))}
                        {activeGenerations.length === 0 && <Empty>No generations are set up yet.</Empty>}
                    </ul>
                    {alumni.length > 0 && (
                        <p className="mt-3 text-xs text-slate-400">
                            {alumni.reduce((n, g) => n + g.members, 0)} alumni in {alumni.length} generation
                            {alumni.length === 1 ? "" : "s"} not shown.
                        </p>
                    )}
                </Panel>

                <div className="grid gap-4 sm:gap-6">
                    {/* --- Access -------------------------------------------------- */}
                    <Panel
                        icon={KeyRound}
                        title="Access"
                        summary={`${access.holders} leader${access.holders === 1 ? " holds an office" : "s hold offices"} that come with a portal login.`}
                        action={<PanelButton onClick={() => onNavigate("cabinet")}>Review in Cabinet</PanelButton>}
                    >
                        <ul className="space-y-2 text-sm">
                            <Row label="Can sign in" value={access.provisioned - access.neverSetPassword} />
                            <Row
                                label="Never set a password"
                                value={access.neverSetPassword}
                                warn={access.neverSetPassword > 0}
                                hint={access.neverSetPassword > 0 ? "They can't get in yet — send them a reset link." : undefined}
                            />
                            {access.missingLogin > 0 && (
                                <Row
                                    label="No login provisioned"
                                    value={access.missingLogin}
                                    warn
                                    hint="Their office grants a login but none exists. Re-save their appointment."
                                />
                            )}
                        </ul>
                    </Panel>

                    {/* --- Transfers ------------------------------------------------ */}
                    <Panel
                        icon={ArrowRightLeft}
                        title="Transfers"
                        summary={
                            pendingTransfers === 0
                                ? "No transfers are waiting."
                                : `${pendingTransfers} transfer${pendingTransfers === 1 ? " is" : "s are"} waiting for the VP Admin.`
                        }
                        action={
                            pendingTransfers > 0 ? (
                                <PanelButton onClick={() => onNavigate("transfers")}>Review transfers</PanelButton>
                            ) : undefined
                        }
                    >
                        {pendingTransfers > 0 && (
                            <Flag>Members stay in their current unit until each is decided</Flag>
                        )}
                    </Panel>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------

function generationSummary(gens: Insight["generations"]): string {
    const withMembers = gens.filter((g) => g.members > 0);
    if (withMembers.length === 0) return "No members in any current generation yet.";
    const share = (g: Insight["generations"][number]) => g.workers / g.members;
    const top = [...withMembers].sort((a, b) => share(b) - share(a))[0];
    const low = [...withMembers].sort((a, b) => share(a) - share(b))[0];
    if (top.id === low.id || share(top) === share(low)) {
        return `${Math.round(share(top) * 100)}% of every generation is serving.`;
    }
    return `${top.level ?? top.name} serves most (${Math.round(share(top) * 100)}%); ${low.level ?? low.name} least (${Math.round(share(low) * 100)}%).`;
}

/** A single ratio on a track of the same hue. Follows the session palette. */
function Meter({ value, max, label, className }: { value: number; max: number; label: string; className?: string }) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    return (
        <div
            role="meter"
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-label={label}
            title={label}
            className={`overflow-hidden rounded-full bg-rcf-navy/10 ${className ?? ""}`}
        >
            <div className="h-full rounded-full bg-rcf-navy" style={{ width: `${pct}%` }} />
        </div>
    );
}

/** Workers vs. not-in-a-unit, as two shades of the primary with a 2px gap. */
function Split({ workers, members, name }: { workers: number; members: number; name: string }) {
    const label = `${name}: ${workers} of ${members} are workers`;
    if (members === 0) return <div className="mt-1 h-2 rounded-full bg-slate-100" title={`${name}: no members`} />;
    const pct = (workers / members) * 100;
    return (
        <div role="img" aria-label={label} title={label} className="mt-1 flex h-2 gap-0.5">
            {workers > 0 && <div className="h-full rounded-full bg-rcf-navy" style={{ width: `${pct}%` }} />}
            {workers < members && <div className="h-full flex-1 rounded-full bg-rcf-navy/30" />}
        </div>
    );
}

function Kpi({
    icon: Icon,
    label,
    value,
    note,
}: {
    icon: typeof Users;
    label: string;
    value: number | string;
    note?: string;
}) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                <Icon className="h-3.5 w-3.5 text-rcf-navy" aria-hidden="true" />
                {label}
            </dt>
            <dd className="mt-1 text-2xl font-bold text-slate-900">{value}</dd>
            {note && <dd className="text-xs text-amber-700">{note}</dd>}
        </div>
    );
}

function Panel({
    icon: Icon,
    title,
    summary,
    action,
    children,
}: {
    icon: typeof Users;
    title: string;
    summary: string;
    action?: React.ReactNode;
    children?: React.ReactNode;
}) {
    return (
        <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h3 className="flex items-center gap-2 font-bold text-slate-900">
                <Icon className="h-4 w-4 text-rcf-navy" aria-hidden="true" />
                {title}
            </h3>
            <p className="mt-1 text-sm text-slate-600">{summary}</p>
            {children && <div className="mt-4">{children}</div>}
            {action && <div className="mt-auto pt-4">{action}</div>}
        </section>
    );
}

const linkClass =
    "inline-flex items-center gap-1 text-sm font-semibold text-rcf-navy hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy rounded";

function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <Link href={href} className={`mt-3 ${linkClass}`}>
            {children} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
    );
}

function PanelButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
    return (
        <button type="button" onClick={onClick} className={linkClass}>
            {children} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
    );
}

/** A warning: amber, with an icon and words — never colour alone. */
function Flag({ children }: { children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            {children}
        </span>
    );
}

function Row({ label, value, warn, hint }: { label: string; value: number; warn?: boolean; hint?: string }) {
    return (
        <li className={`rounded-lg px-3 py-2 ${warn ? "bg-amber-50" : "bg-slate-50"}`}>
            <div className="flex items-center justify-between gap-3">
                <span className={`flex items-center gap-1.5 ${warn ? "font-semibold text-amber-900" : "text-slate-700"}`}>
                    {warn && <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                    {label}
                </span>
                <span className="font-bold tabular-nums text-slate-900">{value}</span>
            </div>
            {hint && <p className="mt-0.5 text-xs text-amber-800">{hint}</p>}
        </li>
    );
}

function Empty({ children }: { children: React.ReactNode }) {
    // col-span-full: it also sits in the units grid, where it must span every column.
    return <li className="col-span-full py-4 text-center text-sm text-slate-400">{children}</li>;
}

/** Placeholder shapes while the figures load — the page doesn't jump when they land. */
function InsightSkeleton() {
    return (
        <div className="space-y-4 sm:space-y-6 motion-safe:animate-pulse" role="status" aria-label="Loading the session's figures">
            <div className="h-44 rounded-2xl bg-slate-100" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-20 rounded-2xl bg-slate-100" />
                ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                <div className="h-64 rounded-2xl bg-slate-100" />
                <div className="h-64 rounded-2xl bg-slate-100" />
            </div>
        </div>
    );
}
