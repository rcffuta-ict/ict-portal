"use client";

import { useState, useEffect, useMemo } from "react";
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
  UserPlus,
  ShieldCheck,
  Zap,
  Ticket,
  ChevronRight,
  Heart,
  CalendarDays,
  ListRestart,
  Info,
  X,
  MessageSquare,
  HelpCircle,
  LayoutDashboard
} from "lucide-react";
import { getEventBySlug, getEventRegistrationStats } from "../actions";
import { CompactPreloader } from "@/components/ui/preloader";
import Link from "next/link";
import { format, isAfter, isBefore, startOfDay, differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useProfileStore } from "@/lib/stores/profile.store";
import { GenericFooter } from "@/components/events/footer";
import { LoLogo } from "@/components/lo-app/LoLogo";

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

interface RegistrationStats {
  total: number;
  recent: Array<{ first_name: string; last_name: string; gender: string }>;
}

export default function EventDetailsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const user = useProfileStore(e => e.user);

  const [event, setEvent] = useState<Event | null>(null);
  const [stats, setStats] = useState<RegistrationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  const loadEvent = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getEventBySlug(slug);
      if (result.success) {
        setEvent(result.data);
        // Load stats if enabled
        if (result.data.config?.registration?.enabled) {
          const statsResult = await getEventRegistrationStats(result.data.id);
          if (statsResult.success) {
            setStats(statsResult.data || null);
          }
        }
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

  useEffect(() => {
    if (slug) {
      loadEvent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Countdown Logic
  useEffect(() => {
    if (!event) return;

    const target = new Date(event.date);
    const interval = setInterval(() => {
      const now = new Date();
      if (isAfter(now, target)) {
        setTimeLeft(null);
        clearInterval(interval);
        return;
      }

      setTimeLeft({
        d: differenceInDays(target, now),
        h: differenceInHours(target, now) % 24,
        m: differenceInMinutes(target, now) % 60,
        s: differenceInSeconds(target, now) % 60
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [event]);

  const isAdmin = useMemo(() => {
    return !!user?.profile?.email && (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).includes(user.profile.email.toLowerCase());
  }, [user]);

  const regConfig: any = useMemo(() => event?.config?.registration || {}, [event]);

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

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      {/* Global Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-200 h-200 bg-blue-500/5 blur-[120px] rounded-full -mr-96 -mt-96" />
        <div className="absolute bottom-0 left-0 w-150 h-150 bg-indigo-500/5 blur-[100px] rounded-full -ml-48 -mb-48" />
      </div>

      {/* Dynamic Header/Hero */}
      <section className="relative pt-12 pb-32 overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-slate-950 pointer-events-none">
          <div className="absolute top-0 right-0 w-full h-full bg-linear-to-br from-blue-600/10 via-transparent to-transparent" />
          <div className="absolute inset-0 opacity-[0.05]"
               style={{backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px'}} />
          <div className="absolute bottom-0 left-0 w-full h-32 bg-linear-to-t from-slate-950 to-transparent" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-12">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 text-slate-500 hover:text-white transition-all font-black uppercase tracking-widest text-[10px] bg-white/5 px-4 py-2 rounded-full border border-white/10 hover:border-white/20 group"
            >
              <ArrowLeft className="h-3 w-3 group-hover:-translate-x-1 transition-transform" />
              Catalog
            </Link>

            {isAdmin && (
              <Link
                href={`/events/${slug}/admin`}
                className="inline-flex items-center gap-2 text-blue-400 hover:text-white transition-all font-black uppercase tracking-widest text-[10px] bg-blue-500/5 px-4 py-2 rounded-full border border-blue-500/20 hover:border-blue-500/40 group"
              >
                <LayoutDashboard className="h-3 w-3" />
                Data Console
              </Link>
            )}
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12 lg:gap-20">
            <div className="flex-1 max-w-3xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 mb-8"
              >
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  isUpcoming ? "bg-linear-to-r from-blue-500 to-indigo-600 text-white shadow-xl shadow-blue-500/20" : "bg-slate-800 text-slate-400"
                }`}>
                  {isUpcoming ? "Upcoming Experience" : "Archive Presentation"}
                </span>
                {event.is_active && (
                  <span className="flex items-center gap-1.5 px-4 py-1.5 bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-black uppercase tracking-widest rounded-full">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                    Live Interaction
                  </span>
                )}
                {event.is_exclusive && (
                  <span className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-black uppercase tracking-widest rounded-full">
                    <ShieldCheck className="w-3 h-3" />
                    Exclusive Access
                  </span>
                )}
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-5xl md:text-8xl font-black text-white mb-10 tracking-tighter leading-[0.9] text-balance"
              >
                {event.title}
              </motion.h1>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex flex-wrap gap-10"
              >
                <div className="flex items-center gap-4 group">
                  <div className="w-14 h-14 rounded-3xl bg-white/5 flex items-center justify-center text-blue-400 border border-white/10 group-hover:bg-blue-500 group-hover:text-white transition-all duration-500">
                    <CalendarDays className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Date</div>
                    <div className="font-bold text-white text-lg">{format(eventDate, "MMM do, yyyy")}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 group">
                  <div className="w-14 h-14 rounded-3xl bg-white/5 flex items-center justify-center text-indigo-400 border border-white/10 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-500">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Time</div>
                    <div className="font-bold text-white text-lg">{format(eventDate, "HH:mm")} <span className="text-slate-600 text-sm font-medium">WAT</span></div>
                  </div>
                </div>

                {event.is_recurring && (
                  <div className="flex items-center gap-4 group">
                    <div className="w-14 h-14 rounded-3xl bg-white/5 flex items-center justify-center text-amber-400 border border-white/10 group-hover:bg-amber-500 group-hover:text-white transition-all duration-500">
                      <ListRestart className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Schedule</div>
                      <div className="font-bold text-white text-lg">Periodic</div>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>

            <motion.div
               initial={{ opacity: 0, x: 30 }}
               animate={{ opacity: 1, x: 0 }}
               className="shrink-0"
            >
               {timeLeft && (
                  <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-[40px] p-8 flex gap-6 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Zap className="w-24 h-24 text-blue-400" />
                    </div>
                    {[
                      { l: 'Days', v: timeLeft.d },
                      { l: 'Hrs', v: timeLeft.h },
                      { l: 'Min', v: timeLeft.m },
                      { l: 'Sec', v: timeLeft.s }
                    ].map((t) => (
                      <div key={t.l} className="flex flex-col items-center">
                        <span className="text-3xl md:text-4xl font-black text-white tabular-nums">{t.v.toString().padStart(2, '0')}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 mt-1">{t.l}</span>
                      </div>
                    ))}
                  </div>
               )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Counter Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10 shrink-0">
         <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
         >
            {/* Registration Stat */}
            {regConfig.enabled && (
               <div className="bg-white rounded-4xl p-8 border border-slate-200 shadow-2xl shadow-slate-200/50 flex items-center justify-between group overflow-hidden relative">
                  <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-blue-50 rounded-full group-hover:scale-110 transition-transform duration-700" />
                  <div className="relative z-10">
                     <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-blue-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Public Engagement</span>
                     </div>
                     <div className="text-4xl font-black text-slate-900 leading-none">
                        {stats?.total || 0}
                     </div>
                     <div className="text-[10px] font-bold text-slate-400 mt-2 italic">People Registered</div>
                  </div>
                  <div className="relative z-10 flex flex-col items-end">
                     <div className="flex -space-x-2 mb-2">
                        {stats?.recent.map((r, i) => (
                           <div key={i} className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black text-white ${r.gender === 'male' ? 'bg-blue-500' : 'bg-pink-500'}`}>
                              {r.first_name[0]}
                           </div>
                        ))}
                     </div>
                     <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">Live Activity</span>
                  </div>
               </div>
            )}

            {/* CTA Option 1: Register */}
            {event.is_active && isUpcoming && regConfig.enabled && (
               <Link
                  href={`/events/${event.slug}/register`}
                  className="md:col-span-2 bg-linear-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 rounded-4xl p-8 text-white shadow-2xl shadow-blue-500/20 flex items-center justify-between group transition-all"
               >
                  <div>
                     <div className="flex items-center gap-2 mb-2">
                        <Ticket className="w-4 h-4 text-blue-200" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-100">Enrollment Portal</span>
                     </div>
                     <div className="text-3xl font-black leading-none uppercase tracking-tight">Secure Your Spot</div>
                  </div>
                  <div className="w-14 h-14 bg-white/10 group-hover:bg-white/20 rounded-2xl flex items-center justify-center border border-white/20 group-hover:scale-110 transition-all">
                     <ArrowUpRight className="w-6 h-6" />
                  </div>
               </Link>
            )}

            {!regConfig.enabled && (
                <div className="md:col-span-3 bg-white rounded-4xl p-8 border border-slate-200 shadow-xl flex items-center gap-6">
                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                        <Info className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="font-black text-slate-900 uppercase text-xs tracking-widest mb-1">Open Admission</h4>
                        <p className="text-sm text-slate-500 font-medium">This experience does not require prior registration. Kindly arrive at the designated venue on time.</p>
                    </div>
                </div>
            )}
         </motion.div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pb-32 flex-grow ">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Main Info */}
          <div className="lg:col-span-8 space-y-12 w-[800px] max-w-full">
            <motion.div
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-white rounded-[40px] border border-slate-200 shadow-2xl shadow-slate-200/40 p-12 overflow-hidden relative group"
            >
              <div className="absolute top-0 right-0 p-12 opacity-[0.02] scale-150 group-hover:rotate-12 transition-transform duration-1000">
                 <BookOpen className="w-64 h-64" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-10 flex items-center gap-4">
                 <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                    <Sparkles className="w-5 h-5 text-white" />
                 </div>
                 The Experience Narrative
              </h2>
              {event.description ? (
                <div className="prose prose-slate max-w-none">
                  <p className="text-slate-600 text-xl leading-[1.8] whitespace-pre-wrap italic font-serif">
                    &ldquo;{event.description}&rdquo;
                  </p>
                </div>
              ) : (
                <p className="text-slate-400 font-bold py-20 text-center border-4 border-dashed border-slate-50 rounded-4xl">
                   A detailed narrative for this experience is yet to be disclosed.
                </p>
              )}
            </motion.div>


            {/* Q&A Hub Card */}
            <motion.div
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ delay: 0.15 }}
               className="bg-white rounded-[40px] p-10 border border-slate-200 shadow-xl overflow-hidden relative group"
            >
               <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12 group-hover:rotate-45 transition-transform duration-700">
                  <HelpCircle className="w-32 h-32" />
               </div>
               <LoLogo mode="full" size="md" variant="light"/>
               <p className="text-sm text-slate-500 leading-relaxed mb-8 font-medium">
                  Have specific inquiries or thoughts regarding this experience? Use our official forum.
               </p>

               <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                     <span className="w-8 h-8 rounded-lg bg-rcf-navy text-white flex items-center justify-center font-black text-sm">#</span>
                     <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Required Tag</span>
                        <span className="text-sm font-bold text-rcf-navy">{event.slug}</span>
                     </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight italic">
                     * Ensure you include the tag above in your question text.
                  </p>
               </div>

               <Link
                  href="/lo-app"
                  className="w-full py-4 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-rcf-navy transition-all shadow-lg shadow-slate-900/10"
               >
                  <span className="text-lg">Go to</span>
                   <LoLogo mode="full" size="sm" variant="dark"/>
                  <ArrowUpRight className="w-3.5 h-3.5" />
               </Link>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-10">
            {/* Eligibility Card */}
            {regConfig.enabled && (
               <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white rounded-[40px] p-10 border border-slate-200 shadow-xl overflow-hidden relative"
               >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full -mr-16 -mt-16 blur-3xl" />
                  <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3">
                     <ShieldCheck className="w-5 h-5 text-indigo-600" />
                     Eligibility
                  </h3>
                  <div className="space-y-6">
                     {[
                        { label: 'Undergraduates', active: regConfig.allowStudents, desc: 'Current FUTA Students' },
                        { label: 'Alumni Network', active: regConfig.allowAlumni, desc: 'Graduated ICT Members' },
                        { label: 'External Guests', active: regConfig.allowGuest, desc: 'Invited Visitors' },
                     ].map((item, i) => (
                        <div key={i} className="flex items-start gap-4">
                           <div className={`mt-1 w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${item.active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-300'}`}>
                              {item.active ? <CheckCircle2 className="w-3 h-3" /> : <X className="w-3 h-3 opacity-30" />}
                           </div>
                           <div>
                              <div className={`text-sm font-black ${item.active ? 'text-slate-900' : 'text-slate-400'}`}>{item.label}</div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{item.desc}</div>
                           </div>
                        </div>
                     ))}
                  </div>
               </motion.div>
            )}



            {/* Logistics Card */}
            <motion.div
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ delay: 0.2 }}
               className="bg-slate-900 rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden group"
            >
               <div className="relative z-10">
                  <h3 className="text-xl font-black mb-10 flex items-center gap-3">
                     <MapPin className="w-5 h-5 text-blue-400" />
                     Logistics
                  </h3>
                  <div className="space-y-8">
                    <div className="flex flex-col gap-2">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Official Tag</span>
                       <span className="text-lg font-bold flex items-center gap-2">
                          <Zap className="w-4 h-4 text-blue-400" />
                          {event.slug}
                       </span>
                    </div>
                    <div className="flex flex-col gap-2">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Registry Timestamp</span>
                       <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-slate-500" />
                          <span className="font-bold">{format(new Date(event.created_at), "MMM do, yyyy")}</span>
                       </div>
                    </div>
                  </div>
               </div>
               <div className="absolute bottom-0 right-0 w-48 h-48 bg-blue-600/10 blur-[80px] rounded-full pointer-events-none" />
            </motion.div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <GenericFooter />
    </div>
  );
}
