import Link from "next/link";
import { AlertCircle, ArrowRight, CalendarPlus, MapPin, Repeat } from "lucide-react";
import { formatEventTimeWithZone, getEventDateParts } from "@/lib/event-utils";
import { getUpcomingEvents } from "../data";

/** The next three events. Streams in after the page shell, with its own states. */
export async function EventsPreview() {
    const result = await getUpcomingEvents(3);

    return (
        <EventsShell>
            {!result.ok ? (
                <Notice
                    icon={AlertCircle}
                    title="We couldn't load upcoming events"
                    body="It's likely the connection. The events page will try again."
                />
            ) : result.events.length === 0 ? (
                <Notice
                    icon={CalendarPlus}
                    title="Nothing scheduled just yet"
                    body="New programmes are announced here first. Check back soon."
                />
            ) : (
                <ol className="grid gap-4 md:grid-cols-3">
                    {result.events.map((event) => {
                        const at = new Date(event.date);
                        const parts = getEventDateParts(at);
                        return (
                            <li key={event.slug}>
                                <Link
                                    href={`/events/${event.slug}`}
                                    className="group flex h-full gap-4 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-gold sm:p-5"
                                >
                                    <span className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-rcf-gold text-rcf-navy">
                                        <span className="text-[10px] font-bold tracking-wider">{parts.month}</span>
                                        <span className="text-2xl font-black leading-none">{parts.day}</span>
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-[11px] font-semibold uppercase tracking-wider text-white/50">
                                            {parts.weekday} · {formatEventTimeWithZone(at)}
                                        </span>
                                        <span className="mt-1 block font-bold leading-snug text-white group-hover:text-rcf-gold">
                                            {event.title}
                                        </span>
                                        <span className="mt-2 flex items-start gap-1.5 text-xs text-white/60">
                                            <MapPin className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                            <span className="line-clamp-1">{event.location}</span>
                                        </span>
                                        {event.isRecurring && (
                                            <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-rcf-gold/90">
                                                <Repeat className="h-3 w-3" aria-hidden="true" /> Recurring
                                            </span>
                                        )}
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ol>
            )}
        </EventsShell>
    );
}

function EventsShell({ children }: { children: React.ReactNode }) {
    return (
        <section id="events" aria-labelledby="events-title" className="scroll-mt-20 bg-rcf-navy py-20 text-white sm:py-24">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-rcf-gold">Coming up</p>
                        <h2 id="events-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                            Gather with us<span className="font-display font-normal italic text-rcf-gold">.</span>
                        </h2>
                    </div>
                    <Link
                        href="/events"
                        className="inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-gold"
                    >
                        All events <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                </div>
                <div className="mt-10">{children}</div>
            </div>
        </section>
    );
}

function Notice({ icon: Icon, title, body }: { icon: typeof AlertCircle; title: string; body: string }) {
    return (
        <div className="flex items-start gap-4 rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10 sm:p-6">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-rcf-gold" aria-hidden="true" />
            <div>
                <p className="font-bold">{title}</p>
                <p className="mt-1 text-sm text-white/65">{body}</p>
            </div>
        </div>
    );
}

export function EventsPreviewSkeleton() {
    return (
        <EventsShell>
            <div role="status" aria-label="Loading upcoming events" className="grid gap-4 md:grid-cols-3">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="flex gap-4 rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10">
                        <div className="h-16 w-14 rounded-xl bg-white/10 motion-safe:animate-pulse" />
                        <div className="flex-1 space-y-2 pt-1">
                            <div className="h-2.5 w-24 rounded bg-white/10 motion-safe:animate-pulse" />
                            <div className="h-4 w-4/5 rounded bg-white/10 motion-safe:animate-pulse" />
                            <div className="h-2.5 w-1/2 rounded bg-white/10 motion-safe:animate-pulse" />
                        </div>
                    </div>
                ))}
            </div>
        </EventsShell>
    );
}
