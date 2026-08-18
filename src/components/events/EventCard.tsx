"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Clock, Lock, MapPin, Pencil, Repeat, Ticket } from "lucide-react";
import Link from "next/link";
import {
    EventRecord,
    formatEventTime,
    getEventDateParts,
    getEventLocation,
    getRegistrationConfig,
    isEventUpcoming,
    parseEventDate,
} from "@/lib/event-utils";
import { truncate } from "@/lib/utils";

interface EventCardProps {
    event: EventRecord;
    index: number;
    isAdmin: boolean;
    onEdit: (event: EventRecord) => void;
}

export function EventCard({ event, index, isAdmin, onEdit }: EventCardProps) {
    const reduceMotion = useReducedMotion();
    const eventDate = useMemo(() => parseEventDate(event.date), [event.date]);
    const dateParts = useMemo(() => getEventDateParts(eventDate), [eventDate]);
    const location = useMemo(() => getEventLocation(event.config), [event.config]);
    const regConfig = useMemo(() => getRegistrationConfig(event.config), [event.config]);
    const isUpcoming = isEventUpcoming(eventDate);

    return (
        <motion.article
            layout
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.25, delay: reduceMotion ? 0 : Math.min(index, 8) * 0.03 }}
            className="group flex h-full flex-col rounded-3xl border border-slate-200 bg-white transition-shadow duration-200 hover:shadow-lg hover:shadow-slate-200/60"
        >
            <div className="flex flex-1 flex-col gap-4 p-5">
                <div className="flex items-start gap-4">
                    {/* Calendar tile — the one loud element, so the date reads at a glance */}
                    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-rcf-navy text-white">
                        <span className="text-[10px] font-semibold tracking-widest text-white/70">
                            {dateParts.month}
                        </span>
                        <span className="text-lg leading-none font-bold">{dateParts.day}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 text-base font-bold text-slate-900 transition-colors group-hover:text-rcf-navy sm:text-lg">
                            {event.title}
                        </h3>
                        <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span>
                                {dateParts.weekday} · {formatEventTime(eventDate)}
                            </span>
                        </p>
                    </div>
                </div>

                {location && (
                    <p className="flex items-start gap-1.5 text-xs font-medium text-slate-500">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="line-clamp-1">{location.venue}</span>
                    </p>
                )}

                {event.description && (
                    <p className="line-clamp-2 text-sm leading-relaxed text-slate-600">
                        {truncate(event.description, 160)}
                    </p>
                )}

                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    {event.is_active && isUpcoming && (
                        <Badge tone="emerald">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Live
                        </Badge>
                    )}
                    {regConfig.enabled && isUpcoming && (
                        <Badge tone="navy">
                            <Ticket className="h-3 w-3" />
                            Registration open
                        </Badge>
                    )}
                    {event.is_exclusive && (
                        <Badge tone="slate">
                            <Lock className="h-3 w-3" />
                            Members only
                        </Badge>
                    )}
                    {event.is_recurring && (
                        <Badge tone="amber">
                            <Repeat className="h-3 w-3" />
                            Recurring
                        </Badge>
                    )}
                    {!isUpcoming && (
                        <Badge tone="slate">Past</Badge>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-100 p-3">
                <Link
                    href={`/events/${event.slug}`}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-rcf-navy hover:text-white focus-visible:ring-4 focus-visible:ring-rcf-navy/20 focus-visible:outline-none"
                >
                    View details
                    <ArrowRight className="h-4 w-4" />
                </Link>

                {isAdmin && (
                    <button
                        type="button"
                        onClick={() => onEdit(event)}
                        aria-label={`Edit ${event.title}`}
                        className="rounded-2xl border border-slate-200 p-3 text-slate-400 transition-colors hover:border-rcf-navy/30 hover:text-rcf-navy focus-visible:ring-4 focus-visible:ring-rcf-navy/20 focus-visible:outline-none"
                    >
                        <Pencil className="h-4 w-4" />
                    </button>
                )}
            </div>
        </motion.article>
    );
}

const TONES = {
    emerald: "bg-emerald-50 text-emerald-700",
    navy: "bg-rcf-navy/5 text-rcf-navy",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-600",
} as const;

function Badge({
    tone,
    children,
}: {
    tone: keyof typeof TONES;
    children: React.ReactNode;
}) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONES[tone]}`}
        >
            {children}
        </span>
    );
}
