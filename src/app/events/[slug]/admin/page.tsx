"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
    ArrowLeft,
    CheckCircle2,
    Download,
    GraduationCap,
    LayoutDashboard,
    Loader2,
    MessageSquare,
    RefreshCcw,
    Search,
    UserRound,
    Users,
} from "lucide-react";
import { EventAdminStats, getEventAdminStats, getEventQuestions } from "./actions";
import { useProfileStore } from "@/lib/stores/profile.store";
import { isProfileAdmin } from "@/lib/auth-roles";
import { formatEventDateTime, levelLabel, parseEventDate } from "@/lib/event-utils";

type TabType = "overview" | "attendees" | "questions";

interface Registrant {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    gender?: string | null;
    level?: string | null;
    department?: string | null;
    matric_number?: string | null;
    is_rcf_member?: boolean | null;
    created_at: string;
}

interface EventQuestion {
    id: string;
    asker_name?: string | null;
    question_text: string;
    answer_text?: string | null;
    scripture_reference?: string | null;
    status: string;
    created_at: string;
}

const TABS: { id: TabType; label: string; icon: typeof Users }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "attendees", label: "Attendees", icon: Users },
    { id: "questions", label: "Questions", icon: MessageSquare },
];

/** RFC-4180 quoting — names and departments routinely contain commas. */
function csvCell(value: unknown): string {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
}

export default function EventAdminPage() {
    const params = useParams();
    const slug = params.slug as string;
    const router = useRouter();
    const reduceMotion = useReducedMotion();
    const { user } = useProfileStore();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<EventAdminStats | null>(null);
    const [questions, setQuestions] = useState<EventQuestion[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>("overview");
    const [search, setSearch] = useState("");
    const [levelFilter, setLevelFilter] = useState<string>("all");

    const isAdmin = useMemo(() => isProfileAdmin(user), [user]);

    useEffect(() => {
        if (!loading && !isAdmin) {
            router.push(`/events/${slug}`);
        }
    }, [isAdmin, loading, router, slug]);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const statsData = await getEventAdminStats(slug);
            if (!statsData) {
                setError("This event could not be found.");
                return;
            }

            setStats(statsData);
            const questionsData = await getEventQuestions(
                (statsData.event as { id: string }).id,
            );
            setQuestions(questionsData.success ? ((questionsData.data as EventQuestion[]) || []) : []);
        } catch (err) {
            console.error("Failed to load admin data", err);
            setError("We couldn't load this event's data. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [slug]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const registrants = useMemo(
        () => (stats?.registrants || []) as unknown as Registrant[],
        [stats?.registrants],
    );

    const filteredAttendees = useMemo(() => {
        const term = search.trim().toLowerCase();

        return registrants.filter((r) => {
            if (levelFilter !== "all" && (r.level?.trim() || "Unspecified") !== levelFilter) {
                return false;
            }
            if (!term) return true;

            return (
                r.first_name?.toLowerCase().includes(term) ||
                r.last_name?.toLowerCase().includes(term) ||
                r.email?.toLowerCase().includes(term) ||
                r.phone_number?.includes(term) ||
                r.department?.toLowerCase().includes(term)
            );
        });
    }, [registrants, search, levelFilter]);

    const exportCSV = () => {
        if (!registrants.length) return;

        const headers = [
            "First Name",
            "Last Name",
            "Email",
            "Phone",
            "Gender",
            "Level",
            "Department",
            "Matric Number",
            "RCF Member",
            "Registered At",
        ];

        const rows = registrants.map((r) => [
            r.first_name,
            r.last_name,
            r.email,
            r.phone_number,
            r.gender || "",
            r.level || "",
            r.department || "",
            r.matric_number || "",
            r.is_rcf_member ? "Yes" : "No",
            formatEventDateTime(parseEventDate(r.created_at)),
        ]);

        const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `${slug}-attendees.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    if (!isAdmin && !loading) return null;

    if (loading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-4">
                <Loader2 className="h-8 w-8 animate-spin text-rcf-navy" />
                <p className="text-sm font-medium text-slate-500">Loading event data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
                <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center">
                    <h1 className="text-lg font-bold text-slate-900">Something went wrong</h1>
                    <p className="mt-2 text-sm text-slate-500">{error}</p>
                    <button
                        type="button"
                        onClick={loadData}
                        className="mt-6 w-full rounded-2xl bg-rcf-navy px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-rcf-navy-light"
                    >
                        Try again
                    </button>
                </div>
            </div>
        );
    }

    const event = stats?.event as { title?: string; date?: string } | undefined;
    const levelStats = stats?.levelStats || [];

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="sticky top-0 z-30 border-b border-slate-200 bg-white pt-safe">
                <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                            <Link
                                href={`/events/${slug}`}
                                aria-label="Back to event"
                                className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Link>
                            <div className="min-w-0">
                                <h1 className="truncate text-base font-bold text-slate-900">
                                    {event?.title || "Event"}
                                </h1>
                                <p className="truncate text-xs text-slate-500">
                                    {formatEventDateTime(parseEventDate(event?.date))}
                                </p>
                            </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                            <button
                                type="button"
                                onClick={loadData}
                                aria-label="Refresh data"
                                className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                            >
                                <RefreshCcw className="h-5 w-5" />
                            </button>
                            <button
                                type="button"
                                onClick={exportCSV}
                                disabled={!registrants.length}
                                className="flex items-center gap-2 rounded-xl bg-rcf-navy px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-rcf-navy-light disabled:opacity-40"
                            >
                                <Download className="h-4 w-4" />
                                <span className="hidden sm:inline">Export CSV</span>
                            </button>
                        </div>
                    </div>

                    <nav className="no-scrollbar mt-2 flex gap-1 overflow-x-auto" aria-label="Sections">
                        {TABS.map((tab) => {
                            const count =
                                tab.id === "attendees"
                                    ? stats?.totalRegistered
                                    : tab.id === "questions"
                                        ? questions.length
                                        : undefined;
                            const isActive = activeTab === tab.id;

                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    aria-current={isActive ? "page" : undefined}
                                    className={`relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                                        isActive
                                            ? "bg-rcf-navy/5 text-rcf-navy"
                                            : "text-slate-500 hover:text-slate-900"
                                    }`}
                                >
                                    <tab.icon className="h-4 w-4" />
                                    {tab.label}
                                    {count !== undefined && (
                                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
                <motion.div
                    key={activeTab}
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === "overview" && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                <StatCard
                                    label="Registered"
                                    value={stats?.totalRegistered ?? 0}
                                    icon={Users}
                                />
                                <StatCard
                                    label="Members"
                                    value={stats?.rcfMembers ?? 0}
                                    icon={CheckCircle2}
                                />
                                <StatCard
                                    label="Guests"
                                    value={stats?.guests ?? 0}
                                    icon={UserRound}
                                />
                                <StatCard
                                    label="Questions"
                                    value={questions.length}
                                    icon={MessageSquare}
                                />
                            </div>

                            {/* Levels — the breakdown the team plans logistics around */}
                            <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
                                <div className="flex items-center gap-2">
                                    <GraduationCap className="h-4 w-4 text-slate-400" />
                                    <h2 className="text-base font-bold text-slate-900">
                                        Attendees by level
                                    </h2>
                                </div>

                                {!stats?.collectsLevel && (
                                    <p className="mt-2 text-sm text-slate-500">
                                        This event&apos;s form doesn&apos;t ask for level. Enable the
                                        &ldquo;Level / status&rdquo; field when editing the event to
                                        collect it.
                                    </p>
                                )}

                                {levelStats.length === 0 ? (
                                    <p className="mt-4 text-sm text-slate-400">
                                        No registrations yet.
                                    </p>
                                ) : (
                                    <ul className="mt-5 space-y-4">
                                        {levelStats.map((stat) => (
                                            <li key={stat.level}>
                                                <div className="flex items-baseline justify-between gap-3">
                                                    <span className="text-sm font-semibold text-slate-900">
                                                        {stat.label}
                                                    </span>
                                                    <span className="text-sm text-slate-500 tabular-nums">
                                                        <span className="font-semibold text-slate-900">
                                                            {stat.count}
                                                        </span>{" "}
                                                        · {stat.percentage}%
                                                    </span>
                                                </div>
                                                <div
                                                    className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100"
                                                    role="img"
                                                    aria-label={`${stat.label}: ${stat.count} of ${stats?.totalRegistered} registrations`}
                                                >
                                                    <div
                                                        className="h-full rounded-full bg-rcf-navy"
                                                        style={{ width: `${stat.percentage}%` }}
                                                    />
                                                </div>
                                                <p className="mt-1.5 text-xs text-slate-500">
                                                    {stat.members} member
                                                    {stat.members === 1 ? "" : "s"} · {stat.guests}{" "}
                                                    guest{stat.guests === 1 ? "" : "s"}
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>

                            <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
                                <h2 className="text-base font-bold text-slate-900">Gender split</h2>
                                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                                    <Tile
                                        label="Brothers"
                                        value={stats?.genderBreakdown.male ?? 0}
                                    />
                                    <Tile
                                        label="Sisters"
                                        value={stats?.genderBreakdown.female ?? 0}
                                    />
                                    {!!stats?.genderBreakdown.other && (
                                        <Tile
                                            label="Unspecified"
                                            value={stats.genderBreakdown.other}
                                        />
                                    )}
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === "attendees" && (
                        <div className="space-y-4">
                            <div className="space-y-3">
                                <div className="relative">
                                    <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <label htmlFor="attendee-search" className="sr-only">
                                        Search attendees
                                    </label>
                                    <input
                                        id="attendee-search"
                                        type="search"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search name, email, phone or department"
                                        className="w-full rounded-2xl border border-slate-200 bg-white py-3 pr-4 pl-11 text-sm font-medium outline-none transition-all placeholder:text-slate-400 focus:border-rcf-navy focus:ring-4 focus:ring-rcf-navy/10"
                                    />
                                </div>

                                {levelStats.length > 1 && (
                                    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                                        <FilterChip
                                            active={levelFilter === "all"}
                                            onClick={() => setLevelFilter("all")}
                                        >
                                            All ({stats?.totalRegistered ?? 0})
                                        </FilterChip>
                                        {levelStats.map((stat) => (
                                            <FilterChip
                                                key={stat.level}
                                                active={levelFilter === stat.level}
                                                onClick={() => setLevelFilter(stat.level)}
                                            >
                                                {stat.label} ({stat.count})
                                            </FilterChip>
                                        ))}
                                    </div>
                                )}

                                <p className="text-xs font-medium text-slate-500">
                                    Showing {filteredAttendees.length} of {stats?.totalRegistered ?? 0}
                                </p>
                            </div>

                            {filteredAttendees.length === 0 ? (
                                <div className="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center">
                                    <Users className="mx-auto h-8 w-8 text-slate-300" />
                                    <p className="mt-3 text-sm font-medium text-slate-500">
                                        No attendees match this filter.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Cards on phones — a 5-column table is unusable at 360px */}
                                    <ul className="space-y-3 md:hidden">
                                        {filteredAttendees.map((r) => (
                                            <li
                                                key={r.id}
                                                className="rounded-2xl border border-slate-200 bg-white p-4"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-bold text-slate-900">
                                                            {r.first_name} {r.last_name}
                                                        </p>
                                                        <p className="truncate text-xs text-slate-500">
                                                            {r.email}
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            {r.phone_number}
                                                        </p>
                                                    </div>
                                                    <MemberBadge isMember={!!r.is_rcf_member} />
                                                </div>
                                                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                                    <span className="rounded-lg bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                                                        {r.level ? levelLabel(r.level) : "No level"}
                                                    </span>
                                                    {r.department && (
                                                        <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600">
                                                            {r.department}
                                                        </span>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>

                                    <div className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white md:block">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="border-b border-slate-100 bg-slate-50/60">
                                                        {[
                                                            "Name",
                                                            "Contact",
                                                            "Level",
                                                            "Type",
                                                            "Registered",
                                                        ].map((h) => (
                                                            <th
                                                                key={h}
                                                                scope="col"
                                                                className="px-5 py-3 text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                                            >
                                                                {h}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {filteredAttendees.map((r) => (
                                                        <tr
                                                            key={r.id}
                                                            className="transition-colors hover:bg-slate-50/60"
                                                        >
                                                            <td className="px-5 py-4">
                                                                <p className="text-sm font-semibold text-slate-900">
                                                                    {r.first_name} {r.last_name}
                                                                </p>
                                                                {r.department && (
                                                                    <p className="text-xs text-slate-500">
                                                                        {r.department}
                                                                    </p>
                                                                )}
                                                            </td>
                                                            <td className="px-5 py-4">
                                                                <p className="text-sm text-slate-600">
                                                                    {r.email}
                                                                </p>
                                                                <p className="text-xs text-slate-500">
                                                                    {r.phone_number}
                                                                </p>
                                                            </td>
                                                            <td className="px-5 py-4 text-sm font-medium text-slate-700">
                                                                {r.level ? levelLabel(r.level) : "—"}
                                                            </td>
                                                            <td className="px-5 py-4">
                                                                <MemberBadge
                                                                    isMember={!!r.is_rcf_member}
                                                                />
                                                            </td>
                                                            <td className="px-5 py-4 text-xs text-slate-500">
                                                                {formatEventDateTime(
                                                                    parseEventDate(r.created_at),
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === "questions" && (
                        <div className="space-y-3">
                            <p className="text-sm text-slate-500">
                                Questions asked on Lo! tagged{" "}
                                <span className="font-mono font-semibold text-slate-700">
                                    #{slug}
                                </span>
                            </p>

                            {questions.length === 0 ? (
                                <div className="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center">
                                    <MessageSquare className="mx-auto h-8 w-8 text-slate-300" />
                                    <p className="mt-3 text-sm font-medium text-slate-500">
                                        No questions yet for this event.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid gap-3 md:grid-cols-2">
                                    {questions.map((q) => (
                                        <article
                                            key={q.id}
                                            className="rounded-3xl border border-slate-200 bg-white p-5"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">
                                                        {q.asker_name || "Anonymous"}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {formatEventDateTime(
                                                            parseEventDate(q.created_at),
                                                        )}
                                                    </p>
                                                </div>
                                                <span
                                                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                                        q.status === "answered"
                                                            ? "bg-emerald-50 text-emerald-700"
                                                            : "bg-amber-50 text-amber-700"
                                                    }`}
                                                >
                                                    {q.status}
                                                </span>
                                            </div>

                                            <p className="mt-3 text-sm leading-relaxed text-slate-700">
                                                {q.question_text}
                                            </p>

                                            {q.scripture_reference && (
                                                <p className="mt-3 inline-block rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                                    {q.scripture_reference}
                                                </p>
                                            )}

                                            {q.answer_text && (
                                                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                                                    <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                                                        Response
                                                    </p>
                                                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                                                        {q.answer_text}
                                                    </p>
                                                </div>
                                            )}
                                        </article>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            </main>
        </div>
    );
}

function StatCard({
    label,
    value,
    icon: Icon,
}: {
    label: string;
    value: number;
    icon: typeof Users;
}) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2 text-slate-400">
                <Icon className="h-4 w-4" />
                <span className="text-xs font-semibold tracking-wide uppercase">{label}</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums sm:text-3xl">
                {value}
            </p>
        </div>
    );
}

function Tile({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-2xl bg-slate-50 p-4 text-center">
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
            <p className="mt-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {label}
            </p>
        </div>
    );
}

function MemberBadge({ isMember }: { isMember: boolean }) {
    return (
        <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                isMember ? "bg-rcf-navy/5 text-rcf-navy" : "bg-amber-50 text-amber-700"
            }`}
        >
            {isMember ? "Member" : "Guest"}
        </span>
    );
}

function FilterChip({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                active
                    ? "border-rcf-navy bg-rcf-navy text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
        >
            {children}
        </button>
    );
}
