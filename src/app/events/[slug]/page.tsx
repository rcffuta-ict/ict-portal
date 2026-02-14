"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Calendar,
  Clock,
  ArrowLeft,
  Users,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Search,
  BookOpen,
  MapPin,
  Mail,
  Phone,
  ArrowUpRight,
} from "lucide-react";
import { getEventBySlug, getEventRegistrations } from "../actions";
import { CompactPreloader } from "@/components/ui/preloader";
import Link from "next/link";
import { format, isAfter, isBefore, startOfDay } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

interface Event {
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

interface Registration {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  gender: string;
  level: string | null;
  checked_in_at: string | null;
  created_at: string;
}

export default function EventDetailsPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRegistrations, setShowRegistrations] = useState(false);
  const [regSearch, setRegSearch] = useState("");

  const loadEvent = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getEventBySlug(slug);
      if (result.success) {
        setEvent(result.data);
      } else {
        setError(result.error || "Event not found");
      }
    } catch (err) {
      setError("An error occurred while loading the event");
      console.error("Error loading event:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadRegistrations = async () => {
    if (!event) return;

    setLoadingRegistrations(true);
    try {
      const result = await getEventRegistrations(event.id);
      if (result.success) {
        setRegistrations(result.data || []);
        setShowRegistrations(true);
      }
    } catch (err) {
      console.error("Error loading registrations:", err);
    } finally {
      setLoadingRegistrations(false);
    }
  };

  useEffect(() => {
    if (slug) {
      loadEvent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const filteredRegistrations = registrations.filter(r =>
    `${r.first_name} ${r.last_name}`.toLowerCase().includes(regSearch.toLowerCase()) ||
    r.email.toLowerCase().includes(regSearch.toLowerCase()) ||
    r.phone_number.includes(regSearch)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <CompactPreloader
          title="Curating Details..."
          subtitle="Gathering all information for this event"
          showUserIcon={false}
        />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-4xl border border-slate-200 p-12 text-center shadow-xl shadow-slate-200/50"
        >
          <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-4">Event Unavailable</h1>
          <p className="text-slate-500 mb-10 font-medium">
            {error || "The requested event could not be found or has been removed."}
          </p>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 w-full justify-center px-8 py-4 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all font-bold group"
          >
            <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
            Back to Catalog
          </Link>
        </motion.div>
      </div>
    );
  }

  const eventDate = new Date(event.date);
  const today = startOfDay(new Date());
  const isUpcoming = isAfter(eventDate, today) || eventDate.getTime() === today.getTime();
  const isPast = isBefore(eventDate, today);

  return (
    <div className="min-h-screen bg-slate-50/30">
      {/* Dynamic Header/Hero */}
      <section className="relative pt-12 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-slate-900 pointer-events-none">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-linear-to-l from-blue-600/20 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full h-1/2 bg-linear-to-t from-slate-900 to-transparent" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03]"
               style={{backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px'}} />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-12 font-bold group"
          >
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </div>
            Explore Events
          </Link>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-12">
            <div className="flex-1">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 mb-6"
              >
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  isUpcoming ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-slate-700 text-slate-300"
                }`}>
                  {isUpcoming ? "Upcoming Experience" : "Archive Presentation"}
                </span>
                {event.is_active && (
                  <span className="flex items-center gap-1.5 px-4 py-1.5 bg-green-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-green-500/20">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    Now Online
                  </span>
                )}
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-4xl md:text-7xl font-black text-white mb-8 tracking-tight leading-tight"
              >
                {event.title}
              </motion.h1>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex flex-wrap gap-8"
              >
                <div className="flex items-center gap-4 text-slate-300">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-blue-400 border border-white/10">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-0.5">Event Schedule</div>
                    <div className="font-bold text-white">{format(eventDate, "EEEE, MMMM do, yyyy")}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-slate-300">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-purple-400 border border-white/10">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-0.5">Internal Slug</div>
                    <div className="font-bold text-white">{event.slug}</div>
                  </div>
                </div>
              </motion.div>
            </div>

            <motion.div
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               transition={{ delay: 0.3 }}
               className="shrink-0"
            >
               {!showRegistrations && (
                 <button
                    onClick={loadRegistrations}
                    disabled={loadingRegistrations}
                    className="flex flex-col items-center gap-2 p-8 bg-blue-600 hover:bg-blue-500 text-white rounded-4xl transition-all shadow-2xl shadow-blue-600/30 group relative overflow-hidden"
                 >
                    <div className="relative z-10">
                        <Users className="w-10 h-10 mb-2 mx-auto group-hover:scale-110 transition-transform" />
                        <div className="text-xl font-black">Attendance Hub</div>
                        <div className="text-sm font-medium opacity-80">View Registrations</div>
                    </div>
                    {loadingRegistrations && (
                      <div className="absolute inset-0 bg-blue-600 flex items-center justify-center z-20">
                         <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                      </div>
                    )}
                 </button>
               )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-8">
            <motion.div
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-white rounded-4xl border border-slate-200 shadow-xl shadow-slate-200/50 p-10 overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
                 <BookOpen className="w-32 h-32" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3">
                 <Sparkles className="w-6 h-6 text-blue-600" />
                 Event Narrative
              </h2>
              {event.description ? (
                <div className="prose prose-slate max-w-none">
                  <p className="text-slate-600 text-lg leading-relaxed whitespace-pre-wrap italic font-serif">
                    &ldquo;{event.description}&rdquo;
                  </p>
                </div>
              ) : (
                <p className="text-slate-400 font-medium py-12 text-center border-2 border-dashed border-slate-100 rounded-4xl">
                  No detailed description has been provided for this event.
                </p>
              )}
            </motion.div>

            {/* Registrations List */}
            {showRegistrations && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-4xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden"
              >
                <div className="p-8 border-b border-slate-100">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900">Registered Delegates</h2>
                      <p className="text-slate-500 font-medium">Verified attendees for this event</p>
                    </div>
                    <div className="bg-blue-600 text-white px-6 py-2 rounded-2xl font-black text-xl flex items-center gap-3">
                       <Users className="w-5 h-5" />
                       {registrations.length}
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                       type="text"
                       placeholder="Filter by name, email or phone..."
                       value={regSearch}
                       onChange={(e) => setRegSearch(e.target.value)}
                       className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium text-slate-900"
                    />
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {filteredRegistrations.length === 0 ? (
                    <div className="py-20 text-center">
                       <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                          <Users className="w-10 h-10 text-slate-200" />
                       </div>
                       <p className="text-slate-400 font-bold">No delegates matched your search.</p>
                    </div>
                  ) : (
                    filteredRegistrations.map((reg, index) => (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        key={reg.id}
                        className="group flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-white border border-slate-100 rounded-3xl hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300"
                      >
                        <div className="flex items-center gap-5">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 font-black text-lg transition-transform group-hover:scale-110 ${
                            reg.gender?.toLowerCase() === 'male' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'
                          }`}>
                            {reg.first_name[0]}{reg.last_name[0]}
                          </div>
                          <div>
                            <h4 className="text-lg font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                              {reg.first_name} {reg.last_name}
                            </h4>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm font-medium text-slate-400">
                               <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{reg.email}</span>
                               <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{reg.phone_number}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end md:self-center">
                           {reg.level && (
                             <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase">Level {reg.level}</span>
                           )}
                           {reg.checked_in_at ? (
                              <span className="flex items-center gap-1.5 px-4 py-2 bg-green-50 text-green-700 rounded-2xl text-xs font-black uppercase tracking-wider">
                                 <CheckCircle2 className="w-4 h-4" />
                                 Checked In
                              </span>
                           ) : (
                              <span className="px-4 py-2 bg-slate-50 text-slate-400 rounded-2xl text-xs font-black uppercase tracking-wider">
                                 Pending
                              </span>
                           )}
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* Sidebar / Stats */}
          <div className="space-y-8">
            <motion.div
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               className="bg-slate-900 rounded-4xl p-8 text-white shadow-2xl shadow-slate-900/40 relative overflow-hidden"
            >
               <div className="relative z-10">
                  <h3 className="text-xl font-black mb-8 flex items-center gap-2">
                     <MapPin className="w-5 h-5 text-blue-400" />
                     Event Logistics
                  </h3>
                  <div className="space-y-6">
                    <div className="flex flex-col gap-1">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registration Status</span>
                       <span className={`text-lg font-bold ${isUpcoming ? 'text-green-400' : 'text-slate-400'}`}>
                          {isUpcoming ? 'Open for Enrollment' : 'Archive Data Only'}
                       </span>
                    </div>
                    <div className="flex flex-col gap-1">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Created At</span>
                       <span className="text-white font-bold">{format(new Date(event.created_at), "MMM do, yyyy")}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recurring Schedule</span>
                       <span className="text-white font-bold">{event.is_recurring ? "Enabled (Weekly/Monthly)" : "Single Session"}</span>
                    </div>
                  </div>

                  <div className="mt-12">
                     <button className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-2xl text-white font-black transition-all flex items-center justify-center gap-2 group">
                        Official Resources
                        <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                     </button>
                  </div>
               </div>
               <div className="absolute top-0 right-0 w-2/3 h-2/3 bg-blue-600/20 blur-[100px] pointer-events-none" />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
