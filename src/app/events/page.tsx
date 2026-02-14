"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Plus,
  Repeat,
  Lock,
  ArrowRight,
} from "lucide-react";
import { getEvents } from "./actions";
import { CompactPreloader } from "@/components/ui/preloader";
import Link from "next/link";
import { format, isAfter, isBefore, startOfDay } from "date-fns";
import { useProfileStore } from "@/lib/stores/profile.store";
import { isUserAdmin } from "@/config/sidebar-items";
import { EventModal } from "@/components/events/EventModal";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/ui/logo";
import { EventCard } from "@/components/events/EventCard";

export interface Event {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  date: string;
  is_active: boolean;
  is_recurring: boolean;
  is_exclusive: boolean;
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const { user } = useProfileStore();
  const isAdmin = useMemo(() => isUserAdmin(user?.profile?.email), [user?.profile?.email]);

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getEvents();
      if (result.success) {
        setEvents(result.data as Event[] || []);
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

  const handleCreateClick = () => {
      setEditingEvent(null);
      setIsModalOpen(true);
  };

  const handleEditClick = (event: Event) => {
      setEditingEvent(event);
      setIsModalOpen(true);
  };

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
      <div className="min-h-screen bg-white">
        <CompactPreloader
          title="Loading Events..."
          subtitle="Fetching upcoming events and details"
          showUserIcon={false}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadEvents}
        event={editingEvent}
      />

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-slate-900 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-10"
               style={{backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '40px 40px'}} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <Logo variant="white" asLink width={160} height={60} />
          </motion.div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="max-w-2xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-6"
              >
                <Sparkles className="w-4 h-4" />
                Experience the Fellowship
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight"
              >
                RCF FUTA <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-indigo-400">Events</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-lg text-slate-400 leading-relaxed"
              >
                Join us in our journey of spiritual growth and community building. From weekly fellowship to grand conventions, stay updated with all our activities.
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-wrap gap-4"
            >
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-2xl">
                <div className="text-3xl font-bold text-white">{events.length}</div>
                <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">Total Events</div>
              </div>
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-2xl">
                <div className="text-3xl font-bold text-blue-400">{upcomingCount}</div>
                <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">Upcoming</div>
              </div>
              {isAdmin && (
                <button
                    onClick={handleCreateClick}
                    className="flex items-center gap-2 px-6 h-18 bg-blue-600 text-white rounded-2xl hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 group"
                >
                    <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform" />
                    <span className="font-bold">Create New Event</span>
                </button>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Controls */}
        <div className="sticky top-4 z-30 bg-white/80 backdrop-blur-xl border border-slate-200 rounded-3xl p-4 shadow-xl shadow-slate-200/50 mb-12 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, description or slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 placeholder:text-slate-400 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl self-stretch md:self-auto overflow-x-auto no-scrollbar">
            {[
              { key: "all", label: "All Events" },
              { key: "upcoming", label: "Upcoming" },
              { key: "active", label: "Active" },
              { key: "past", label: "Past" },
            ].map((option) => (
              <button
                key={option.key}
                onClick={() => setFilter(option.key as FilterType)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                  filter === option.key
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error State */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-12 overflow-hidden"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center shrink-0">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-red-900 font-bold">Failed to load events</h3>
                  <p className="text-red-700 text-sm opacity-80">{error}</p>
                </div>
                <button
                  onClick={loadEvents}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors text-sm font-bold"
                >
                  Retry Action
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grid */}
        {filteredEvents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-24 bg-white rounded-4xl border border-slate-200 shadow-sm"
          >
            <div className="w-24 h-24 bg-slate-50 rounded-4xl flex items-center justify-center mx-auto mb-6">
              <Calendar className="h-12 w-12 text-slate-300" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-4">No events found</h3>
            <p className="text-slate-500 max-w-sm mx-auto mb-8 font-medium">
              We couldn&apos;t find any events matching your current filters or search query.
            </p>
            {(search || filter !== "all") && (
              <button
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
                className="px-8 py-3 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-colors font-bold"
              >
                Reset all filters
              </button>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence mode="popLayout">
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
      </div>

      {/* Search and Alert Icons are missing imports or definitions, fixing below */}
    </div>
  );
}

const AlertCircle = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
);
