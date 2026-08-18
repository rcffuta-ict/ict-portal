"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
    AlertCircle,
    ArrowLeft,
    ArrowUpRight,
    CalendarDays,
    CheckCircle2,
    Clock,
    ExternalLink,
    LayoutDashboard,
    Lock,
    MapPin,
    Repeat,
    Ticket,
    Users,
    X,
} from "lucide-react";
import { getEventBySlug, getEventRegistrationStats } from "../actions";
import { CompactPreloader } from "@/components/ui/preloader";
import { useProfileStore } from "@/lib/stores/profile.store";
import { isProfileAdmin } from "@/lib/auth-roles";
import { GenericFooter } from "@/components/events/footer";
import { LoLogo } from "@/components/lo-app/LoLogo";
import {
    EVENT_TIME_ZONE_LABEL,
    EventRecord,
    formatEventDate,
    formatEventTime,
    getEventLocation,
    getRegistrationConfig,
    isEventToday,
    isEventUpcoming,
    parseEventDate,
} from "@/lib/event-utils";

interface RegistrationStats {
    total: number;
    recent: Array<{ first_name: string; last_name: string; gender: string }>;
}

interface Countdown {
    d: number;
    h: number;
    m: number;
    s: number;
}

function getCountdown(target: Date, now: Date): Countdown | null {
    const diff = target.getTime() - now.getTime();
    if (diff <= 0) return null;

    const seconds = Math.floor(diff / 1000);
    return {
        d: Math.floor(seconds / 86400),
        h: Math.floor(seconds / 3600) % 24,
        m: Math.floor(seconds / 60) % 60,
        s: seconds % 60,
    };
}

export default function EventDetailsPage() {
    const params = useParams();
    const slug = params.slug as string;
    const user = useProfileStore((e) => e.user);
    const reduceMotion = useReducedMotion();

    const [event, setEvent] = useState<EventRecord | null>(null);
    const [stats, setStats] = useState<RegistrationStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<Countdown | null>(null);

    const isAdmin = useMemo(() => isProfileAdmin(user), [user]);

    const loadEvent = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const result = await getEventBySlug(slug);
            if (!result.success || !result.data) {
                setError(result.error || "Event not found");
                return;
            }

            const data = result.data as EventRecord;
            setEvent(data);

            if (getRegistrationConfig(data.config).enabled) {
                const statsResult = await getEventRegistrationStats(data.id);
                if (statsResult.success) setStats(statsResult.data || null);
            }
        } catch (err) {
            setError("An error occurred while loading the event");
            console.error("Error loading event:", err);
        } finally {
            setLoading(false);
        }
    }, [slug]);

    useEffect(() => {
        if (slug) loadEvent();
    }, [slug, loadEvent]);

    const eventDate = useMemo(() => parseEventDate(event?.date), [event?.date]);
    const location = useMemo(() => getEventLocation(event?.config), [event?.config]);
    const regConfig = useMemo(() => getRegistrationConfig(event?.config), [event?.config]);

    const isUpcoming = isEventUpcoming(eventDate);
    const isToday = isEventToday(eventDate);
    const canRegister = !!event?.is_active && isUpcoming && regConfig.enabled;

    // Countdown ticks only while there is something left to count down to.
    useEffect(() => {
        if (!eventDate) return;

        const tick = () => setTimeLeft(getCountdown(eventDate, new Date()));
        tick();

        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [eventDate]);

    if (loading) {
        return (
            <div className="min-h-screen bg-white">
                <CompactPreloader
                    title="Loading event..."
                    subtitle="Fetching the details for this event"
                    showUserIcon={false}
                />
            </div>
        );
    }

    if (error || !event) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
                <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center">
                    <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
                    <h1 className="mt-4 text-xl font-bold text-slate-900">Event unavailable</h1>
                    <p className="mt-2 text-sm text-slate-500">
                        {error || "This event could not be found or has been removed."}
                    </p>
                    <div className="mt-6 flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={loadEvent}
                            className="rounded-2xl bg-rcf-navy px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-rcf-navy-light"
                        >
                            Try again
                        </button>
                        <Link
                            href="/events"
                            className="rounded-2xl px-6 py-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                            Back to events
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const statusLabel = isToday
        ? "Happening today"
        : isUpcoming
            ? "Upcoming"
            : "Past event";

    return (
        <div className="flex min-h-screen flex-col bg-slate-50">
            {/* App bar */}
            <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 pt-safe backdrop-blur-sm">
                <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
                    <Link
                        href="/events"
                        className="inline-flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Events
                    </Link>

                    {isAdmin && (
                        <Link
                            href={`/events/${slug}/admin`}
                            className="inline-flex items-center gap-2 rounded-xl bg-rcf-navy/5 px-3 py-1.5 text-sm font-semibold text-rcf-navy transition-colors hover:bg-rcf-navy/10"
                        >
                            <LayoutDashboard className="h-4 w-4" />
                            <span className="hidden sm:inline">Admin console</span>
                        </Link>
                    )}
                </div>
            </div>

            {/* Hero */}
            <header className="bg-rcf-navy text-white">
                <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
                    <motion.div
                        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="flex flex-wrap items-center gap-2">
                            <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    isUpcoming
                                        ? "bg-rcf-gold text-rcf-navy"
                                        : "bg-white/10 text-white/70"
                                }`}
                            >
                                {statusLabel}
                            </span>
                            {event.is_exclusive && (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                                    <Lock className="h-3 w-3" />
                                    Members only
                                </span>
                            )}
                            {event.is_recurring && (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                                    <Repeat className="h-3 w-3" />
                                    Recurring
                                </span>
                            )}
                        </div>

                        <h1 className="mt-4 text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
                            {event.title}
                        </h1>

                        <div className="mt-5 flex flex-col gap-2 text-sm text-white/80 sm:flex-row sm:flex-wrap sm:gap-6">
                            <span className="inline-flex items-center gap-2">
                                <CalendarDays className="h-4 w-4 shrink-0 text-rcf-gold" />
                                {formatEventDate(eventDate)}
                            </span>
                            <span className="inline-flex items-center gap-2">
                                <Clock className="h-4 w-4 shrink-0 text-rcf-gold" />
                                {formatEventTime(eventDate)} {EVENT_TIME_ZONE_LABEL}
                            </span>
                            <span className="inline-flex items-center gap-2">
                                <MapPin className="h-4 w-4 shrink-0 text-rcf-gold" />
                                {location ? location.venue : "Venue to be announced"}
                            </span>
                        </div>

                        {/* Countdown — informative, not the centrepiece */}
                        {timeLeft && (
                            <div className="mt-6 inline-flex gap-4 rounded-2xl bg-white/5 px-5 py-3 ring-1 ring-white/10">
                                {[
                                    { l: "days", v: timeLeft.d },
                                    { l: "hrs", v: timeLeft.h },
                                    { l: "min", v: timeLeft.m },
                                    { l: "sec", v: timeLeft.s },
                                ].map((t) => (
                                    <div key={t.l} className="text-center">
                                        <div className="text-xl font-bold tabular-nums">
                                            {t.v.toString().padStart(2, "0")}
                                        </div>
                                        <div className="text-[10px] tracking-wide text-white/50 uppercase">
                                            {t.l}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {canRegister && (
                            <div className="mt-6 hidden sm:block">
                                <Link
                                    href={`/events/${slug}/register`}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-rcf-navy transition-colors hover:bg-rcf-gold"
                                >
                                    <Ticket className="h-4 w-4" />
                                    Register for this event
                                </Link>
                            </div>
                        )}
                    </motion.div>
                </div>
            </header>

            {/* Body */}
            <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-28 sm:px-6 sm:py-10 sm:pb-10">
                <div className="grid gap-4 lg:grid-cols-3">
                    <div className="space-y-4 lg:col-span-2">
                        {/* About */}
                        <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
                            <h2 className="text-base font-bold text-slate-900">About this event</h2>
                            {event.description ? (
                                <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-slate-600 sm:text-base">
                                    {event.description}
                                </p>
                            ) : (
                                <p className="mt-3 text-sm text-slate-400">
                                    More details about this event will be shared soon.
                                </p>
                            )}
                        </section>

                        {/* Event information */}
                        <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
                            <h2 className="text-base font-bold text-slate-900">
                                Event information
                            </h2>
                            <dl className="mt-4 divide-y divide-slate-100">
                                <InfoRow icon={CalendarDays} label="Date">
                                    {formatEventDate(eventDate)}
                                </InfoRow>

                                <InfoRow icon={Clock} label="Time">
                                    {formatEventTime(eventDate)}{" "}
                                    <span className="text-slate-400">
                                        ({EVENT_TIME_ZONE_LABEL})
                                    </span>
                                </InfoRow>

                                <InfoRow icon={MapPin} label="Location">
                                    {location ? (
                                        <>
                                            <span className="block">{location.venue}</span>
                                            {location.address && (
                                                <span className="mt-0.5 block text-sm font-normal text-slate-500">
                                                    {location.address}
                                                </span>
                                            )}
                                            {location.mapUrl && (
                                                <a
                                                    href={location.mapUrl}
                                                    target="_blank"
                                                    rel="noreferrer noopener"
                                                    className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-rcf-navy underline underline-offset-4 hover:text-rcf-navy-light"
                                                >
                                                    Open in maps
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                </a>
                                            )}
                                        </>
                                    ) : (
                                        <span className="font-normal text-slate-400">
                                            To be announced
                                        </span>
                                    )}
                                </InfoRow>

                                {event.is_recurring && (
                                    <InfoRow icon={Repeat} label="Schedule">
                                        Runs periodically
                                    </InfoRow>
                                )}

                                <InfoRow icon={Ticket} label="Registration">
                                    {regConfig.enabled ? (
                                        canRegister ? (
                                            "Open — register below"
                                        ) : (
                                            "Closed"
                                        )
                                    ) : (
                                        <span className="font-normal text-slate-500">
                                            Not required — just come along
                                        </span>
                                    )}
                                </InfoRow>
                            </dl>
                        </section>

                        {/* Questions */}
                        <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
                            <LoLogo mode="full" size="sm" variant="light" />
                            <p className="mt-3 text-sm leading-relaxed text-slate-600">
                                Have a question about this event? Ask it on Lo! — include the tag
                                below so it reaches the right team.
                            </p>
                            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3">
                                <span className="text-sm font-semibold text-slate-400">#</span>
                                <span className="font-mono text-sm font-semibold text-rcf-navy">
                                    {event.slug}
                                </span>
                            </div>
                            <Link
                                href="/lo-app"
                                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-rcf-navy"
                            >
                                Ask a question
                                <ArrowUpRight className="h-4 w-4" />
                            </Link>
                        </section>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-4">
                        {regConfig.enabled && (
                            <>
                                <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <Users className="h-4 w-4" />
                                        <span className="text-xs font-semibold tracking-wide uppercase">
                                            Registered
                                        </span>
                                    </div>
                                    <p className="mt-2 text-3xl font-bold text-slate-900">
                                        {stats?.total ?? 0}
                                    </p>
                                    {!!stats?.recent.length && (
                                        <div className="mt-3 flex items-center gap-2">
                                            <div className="flex -space-x-2">
                                                {stats.recent.slice(0, 5).map((r, i) => (
                                                    <span
                                                        key={`${r.first_name}-${i}`}
                                                        className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white ${
                                                            r.gender === "male"
                                                                ? "bg-rcf-navy"
                                                                : "bg-rcf-navy-light"
                                                        }`}
                                                    >
                                                        {r.first_name[0]}
                                                    </span>
                                                ))}
                                            </div>
                                            <span className="text-xs text-slate-500">
                                                recently joined
                                            </span>
                                        </div>
                                    )}
                                </section>

                                <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
                                    <h2 className="text-base font-bold text-slate-900">
                                        Who can register
                                    </h2>
                                    <ul className="mt-4 space-y-3">
                                        {[
                                            {
                                                label: "Students",
                                                desc: "Current FUTA students",
                                                active: !!regConfig.allowStudents,
                                            },
                                            {
                                                label: "Alumni",
                                                desc: "Graduated members",
                                                active: !!regConfig.allowAlumni,
                                            },
                                            {
                                                label: "Guests",
                                                desc: "Visitors and invitees",
                                                active: !!regConfig.allowGuest,
                                            },
                                        ].map((item) => (
                                            <li key={item.label} className="flex items-start gap-3">
                                                {item.active ? (
                                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                                ) : (
                                                    <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                                                )}
                                                <div>
                                                    <p
                                                        className={`text-sm font-semibold ${
                                                            item.active
                                                                ? "text-slate-900"
                                                                : "text-slate-400"
                                                        }`}
                                                    >
                                                        {item.label}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {item.desc}
                                                    </p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            </>
                        )}

                        {!regConfig.enabled && (
                            <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
                                <h2 className="text-base font-bold text-slate-900">
                                    Open attendance
                                </h2>
                                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                    No registration is needed for this event. Simply arrive at the
                                    venue on time.
                                </p>
                            </section>
                        )}
                    </div>
                </div>
            </main>

            {/* Sticky CTA — thumb-reachable on phones, where most members open this page */}
            {canRegister && (
                <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 pb-safe backdrop-blur-sm sm:hidden">
                    <Link
                        href={`/events/${slug}/register`}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rcf-navy px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-rcf-navy-light"
                    >
                        <Ticket className="h-4 w-4" />
                        Register for this event
                    </Link>
                </div>
            )}

            <GenericFooter />
        </div>
    );
}

function InfoRow({
    icon: Icon,
    label,
    children,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex gap-3 py-3.5 first:pt-0 last:pb-0">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div className="min-w-0 flex-1">
                <dt className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                    {label}
                </dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">{children}</dd>
            </div>
        </div>
    );
}
