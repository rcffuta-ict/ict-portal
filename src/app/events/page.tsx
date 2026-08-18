"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { AlertCircle, CalendarX2, Plus, Search } from "lucide-react";
import { getEvents } from "./actions";
import { CompactPreloader } from "@/components/ui/preloader";
import { useProfileStore } from "@/lib/stores/profile.store";
import { isProfileAdmin } from "@/config/sidebar-items";
import { EventModal } from "@/components/events/EventModal";
import { Logo } from "@/components/ui/logo";
import { EventCard } from "@/components/events/EventCard";
import { EventRecord, isEventUpcoming, parseEventDate } from "@/lib/event-utils";

type FilterType = "all" | "upcoming" | "past" | "active";

const FILTERS: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "upcoming", label: "Upcoming" },
    { key: "active", label: "Live" },
    { key: "past", label: "Past" },
];

export default function EventsPage() {
    const [events, setEvents] = useState<EventRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<FilterType>("all");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);

    const reduceMotion = useReducedMotion();
    const { user } = useProfileStore();
    const isAdmin = useMemo(() => isProfileAdmin(user), [user]);

    const loadEvents = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getEvents();
            if (result.success) {
                setEvents((result.data as EventRecord[]) || []);
            } else {
                setError(result.error || "Failed to load events");
            }
        } catch (err) {
            setError("An error occurred while loading events");
            console.error("Error loading events:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadEvents();
    }, [loadEvents]);

    const handleCreateClick = () => {
        setEditingEvent(null);
        setIsModalOpen(true);
    };

    const handleEditClick = (event: EventRecord) => {
        setEditingEvent(event);
        setIsModalOpen(true);
    };

    const filteredEvents = useMemo(() => {
        const term = search.trim().toLowerCase();

        return events.filter((event) => {
            const matchesSearch =
                !term ||
                event.title.toLowerCase().includes(term) ||
                event.description?.toLowerCase().includes(term) ||
                event.slug.toLowerCase().includes(term);

            if (!matchesSearch) return false;

            const upcoming = isEventUpcoming(parseEventDate(event.date));
            switch (filter) {
                case "upcoming":
                    return upcoming;
                case "past":
                    return !upcoming;
                case "active":
                    return event.is_active;
                default:
                    return true;
            }
        });
    }, [events, search, filter]);

    const upcomingCount = useMemo(
        () => events.filter((e) => isEventUpcoming(parseEventDate(e.date))).length,
        [events],
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-white">
                <CompactPreloader
                    title="Loading events..."
                    subtitle="Fetching upcoming events and details"
                    showUserIcon={false}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <EventModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={loadEvents}
                event={editingEvent}
            />

            {/* Header */}
            <header className="bg-rcf-navy pt-safe text-white">
                <div className="mx-auto max-w-6xl px-4 pt-8 pb-10 sm:px-6 sm:pt-10 lg:px-8">
                    <Logo variant="white" asLink width={120} height={44} />

                    <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                        <div className="max-w-xl">
                            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                                Events
                            </h1>
                            <p className="mt-2 text-sm leading-relaxed text-white/70 sm:text-base">
                                Fellowship gatherings, conferences and programmes — dates, venues
                                and registration, all in one place.
                            </p>
                            <p className="mt-4 text-sm font-medium text-white/60">
                                {events.length} event{events.length === 1 ? "" : "s"} ·{" "}
                                <span className="text-rcf-gold">{upcomingCount} upcoming</span>
                            </p>
                        </div>

                        {isAdmin && (
                            <button
                                type="button"
                                onClick={handleCreateClick}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-rcf-navy transition-colors hover:bg-rcf-gold focus-visible:ring-4 focus-visible:ring-white/30 focus-visible:outline-none"
                            >
                                <Plus className="h-4 w-4" />
                                New event
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
                {/* Controls */}
                <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <label htmlFor="event-search" className="sr-only">
                                Search events
                            </label>
                            <input
                                id="event-search"
                                type="search"
                                placeholder="Search events"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pr-4 pl-11 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-rcf-navy focus:ring-4 focus:ring-rcf-navy/10"
                            />
                        </div>

                        <div
                            role="tablist"
                            aria-label="Filter events"
                            className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 ring-1 ring-slate-200"
                        >
                            {FILTERS.map((option) => (
                                <button
                                    key={option.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={filter === option.key}
                                    onClick={() => setFilter(option.key)}
                                    className={`rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                                        filter === option.key
                                            ? "bg-rcf-navy text-white"
                                            : "text-slate-500 hover:text-slate-900"
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 sm:flex-row sm:items-center">
                        <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-red-900">
                                Couldn&apos;t load events
                            </p>
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                        <button
                            type="button"
                            onClick={loadEvents}
                            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {filteredEvents.length === 0 ? (
                    <div className="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center">
                        <CalendarX2 className="mx-auto h-10 w-10 text-slate-300" />
                        <h2 className="mt-4 text-lg font-bold text-slate-900">No events found</h2>
                        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                            Nothing matches your current search or filter.
                        </p>
                        {(search || filter !== "all") && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearch("");
                                    setFilter("all");
                                }}
                                className="mt-6 rounded-2xl bg-rcf-navy px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-rcf-navy-light"
                            >
                                Reset filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <AnimatePresence mode="popLayout" initial={!reduceMotion}>
                            {filteredEvents.map((event, index) => (
                                <EventCard
                                    key={event.id}
                                    event={event}
                                    index={index}
                                    isAdmin={isAdmin}
                                    onEdit={handleEditClick}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </main>
        </div>
    );
}
