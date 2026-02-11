"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  ExternalLink,
  Search,
  Filter,
  ChevronRight,
  Sparkles,
  CalendarDays,
  Eye,
} from "lucide-react";
import { getEvents } from "./actions";
import { CompactPreloader } from "@/components/ui/preloader";
import Link from "next/link";
import { format, isAfter, isBefore, startOfDay } from "date-fns";

interface Event {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  date: string;
  is_active: boolean;
  created_at: string;
  config: Record<string, unknown> | null;
}

type FilterType = "all" | "upcoming" | "past" | "active";

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getEvents();
      if (result.success) {
        setEvents(result.data || []);
      } else {
        setError(result.error || "Failed to load events");
      }
    } catch (err) {
      setError("An error occurred while loading events");
      console.error("Error loading events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  // Filter events based on search and filter type
  const filteredEvents = events.filter((event) => {
    const matchesSearch = 
      event.title.toLowerCase().includes(search.toLowerCase()) ||
      event.description?.toLowerCase().includes(search.toLowerCase()) ||
      event.slug.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    const eventDate = new Date(event.date);
    const today = startOfDay(new Date());

    switch (filter) {
      case "upcoming":
        return isAfter(eventDate, today) || eventDate.getTime() === today.getTime();
      case "past":
        return isBefore(eventDate, today);
      case "active":
        return event.is_active;
      default:
        return true;
    }
  });

  const upcomingCount = events.filter(e => {
    const eventDate = new Date(e.date);
    const today = startOfDay(new Date());
    return isAfter(eventDate, today) || eventDate.getTime() === today.getTime();
  }).length;

  const activeCount = events.filter(e => e.is_active).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <CompactPreloader 
            title="Loading Events..." 
            subtitle="Fetching upcoming events and details" 
            showUserIcon={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-linear-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Events</h1>
                <p className="text-slate-600">Discover upcoming events and activities</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-1">
                <CalendarDays className="h-4 w-4" />
                <span>{events.length} Total</span>
              </div>
              <div className="flex items-center gap-1">
                <Sparkles className="h-4 w-4 text-blue-500" />
                <span className="text-blue-600 font-medium">{upcomingCount} Upcoming</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-slate-500" />
            {[
              { key: "all", label: "All", count: events.length },
              { key: "upcoming", label: "Upcoming", count: upcomingCount },
              { key: "active", label: "Active", count: activeCount },
              { key: "past", label: "Past", count: events.length - upcomingCount },
            ].map((filterOption) => (
              <button
                key={filterOption.key}
                onClick={() => setFilter(filterOption.key as FilterType)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === filterOption.key
                    ? "bg-blue-600 text-white shadow-lg"
                    : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                }`}
              >
                {filterOption.label}
                <span className="ml-1 opacity-75">({filterOption.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <ExternalLink className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <h3 className="text-red-900 font-semibold">Error Loading Events</h3>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
            <button
              onClick={loadEvents}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Events Grid */}
        {filteredEvents.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              {search || filter !== "all" ? "No events found" : "No events available"}
            </h3>
            <p className="text-slate-500 max-w-md mx-auto">
              {search || filter !== "all" 
                ? "Try adjusting your search or filter criteria." 
                : "Check back later for upcoming events and activities."
              }
            </p>
            {(search || filter !== "all") && (
              <button
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <EventCard event={event} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Event Card Component
function EventCard({ event }: { event: Event }) {
  const eventDate = new Date(event.date);
  const today = startOfDay(new Date());
  const isUpcoming = isAfter(eventDate, today) || eventDate.getTime() === today.getTime();
  const isPast = isBefore(eventDate, today);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isUpcoming ? "bg-blue-100 text-blue-600" : 
              isPast ? "bg-slate-100 text-slate-500" : "bg-green-100 text-green-600"
            }`}>
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                {event.title}
              </h3>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                {event.slug}
              </p>
            </div>
          </div>
          
          {event.is_active && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              Active
            </span>
          )}
        </div>

        {/* Description */}
        {event.description && (
          <p className="text-slate-600 text-sm line-clamp-3 mb-4">
            {event.description}
          </p>
        )}

        {/* Event Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Calendar className="h-4 w-4" />
            <span>{format(eventDate, "MMMM do, yyyy")}</span>
            {isUpcoming && (
              <span className="ml-auto text-blue-600 font-medium">Upcoming</span>
            )}
            {isPast && (
              <span className="ml-auto text-slate-400 font-medium">Past</span>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Clock className="h-4 w-4" />
            <span>Created {format(new Date(event.created_at), "MMM do, yyyy")}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
        <Link
          href={`/events/${event.slug}`}
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm group-hover:translate-x-1 transition-all"
        >
          <Eye className="h-4 w-4" />
          View Details
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}