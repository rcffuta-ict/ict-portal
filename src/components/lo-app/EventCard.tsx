"use client";

import { Calendar, Hash, MapPin, ChevronRight } from "lucide-react";
import type { LoEvent } from "./LoAppClient";

interface EventCardProps {
    event: LoEvent;
    index: number;
}

export function EventCard({ event, index }: EventCardProps) {
    const isActive = event.is_active;
    const eventDate = event.date ? new Date(event.date) : null;

    const formatDate = (date: Date) => {
        const now = new Date();
        const diffMs = date.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Tomorrow";
        if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;

        return date.toLocaleDateString("en-NG", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
        });
    };

    const isPast = eventDate ? eventDate.getTime() < Date.now() : false;

    return (
        <div
            className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
            style={{ animationDelay: `${index * 50}ms` }}
        >
            <div className="px-4 py-4">
                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isActive
                                ? "bg-gradient-to-br from-green-500 to-emerald-600"
                                : isPast
                                ? "bg-slate-200"
                                : "bg-gradient-to-br from-amber-400 to-orange-500"
                        }`}
                    >
                        <Calendar className="w-5 h-5 text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-bold text-slate-900 truncate">
                                {event.title}
                            </h3>
                            {isActive && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 shrink-0">
                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                    Live
                                </span>
                            )}
                            {isPast && !isActive && (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 shrink-0">
                                    Past
                                </span>
                            )}
                        </div>

                        {event.description && (
                            <p className="text-sm text-slate-600 line-clamp-2 mb-2">
                                {event.description}
                            </p>
                        )}

                        <div className="flex items-center gap-4 text-[11px] text-slate-500">
                            {eventDate && (
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(eventDate)}
                                </span>
                            )}
                            <span className="flex items-center gap-1">
                                <Hash className="w-3 h-3" />
                                {event.slug}
                            </span>
                        </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-4 h-4 text-slate-300 mt-1 shrink-0" />
                </div>
            </div>
        </div>
    );
}
