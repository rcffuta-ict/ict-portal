"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  Users,
  Search,
  Download,
  MessageSquare,
  PieChart,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  ChevronDown,
  LayoutDashboard,
  RefreshCcw
} from "lucide-react";
import { getEventAdminStats, getEventQuestions } from "./actions";
import { useProfileStore } from "@/lib/stores/profile.store";
import { isUserAdmin } from "@/config/sidebar-items";
import Link from "next/link";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { displayLevelBetter } from "@/lib/utils";

type TabType = "overview" | "attendees" | "questions";

export default function EventAdminPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { user } = useProfileStore();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [search, setSearch] = useState("");

  const isAdmin = useMemo(() => {
    return isUserAdmin(user?.profile?.email);
  }, [user?.profile?.email]);

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push(`/events/${slug}`);
    }
  }, [isAdmin, loading, router, slug]);

  const loadData = async () => {
    setLoading(true);
    try {
      const statsData = await getEventAdminStats(slug);
      if (statsData) {
        setStats(statsData);
        const questionsData = await getEventQuestions(statsData.event.id);
        if (questionsData.success) {
          setQuestions(questionsData.data || []);
        }
      }
    } catch (err) {
      console.error("Failed to load admin data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [slug]);

  const filteredAttendees = useMemo(() => {
    if (!stats?.registrants) return [];
    const term = search.toLowerCase();
    return stats.registrants.filter((r: any) =>
      r.first_name.toLowerCase().includes(term) ||
      r.last_name.toLowerCase().includes(term) ||
      r.email.toLowerCase().includes(term) ||
      r.phone_number.includes(term) ||
      r.department?.toLowerCase().includes(term)
    );
  }, [stats?.registrants, search]);

  const exportCSV = () => {
    if (!stats?.registrants) return;
    const headers = ["First Name", "Last Name", "Email", "Phone", "Gender", "Level", "Department", "RCF Member", "Registered At"];
    const rows = stats.registrants.map((r: any) => [
      r.first_name,
      r.last_name,
      r.email,
      r.phone_number,
      r.gender || "",
      r.level || "",
      r.department || "",
      r.is_rcf_member ? "Yes" : "No",
      new Date(r.created_at).toLocaleString()
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slug}-attendees.csv`;
    link.click();
  };

  if (!isAdmin && !loading) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-rcf-navy animate-spin mb-4" />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Authorizing Admin Access...</p>
      </div>
    );
  }

  const event = stats?.event;

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/events/${slug}`}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">Admin Console</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{event?.title}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
               <button
                onClick={loadData}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
                title="Refresh Data"
               >
                 <RefreshCcw className="w-5 h-5" />
               </button>
               <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
               >
                 <Download className="w-4 h-4" />
                 <span className="hidden sm:inline">Export List</span>
               </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-2">
          <div className="flex gap-8">
            {[
              { id: 'overview', label: 'Overview', icon: LayoutDashboard },
              { id: 'attendees', label: 'Attendees', icon: Users, count: stats?.totalRegistered },
              { id: 'questions', label: 'Lo! Questions', icon: MessageSquare, count: questions.length },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as TabType)}
                className={`flex items-center gap-2 py-4 text-xs font-black uppercase tracking-widest relative transition-colors ${
                  activeTab === t.id ? 'text-rcf-navy' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
                {t.count !== undefined && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] ${
                    activeTab === t.id ? 'bg-rcf-navy/10 text-rcf-navy' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {t.count}
                  </span>
                )}
                {activeTab === t.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-rcf-navy rounded-full"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard
                  label="Total Registered"
                  value={stats?.totalRegistered}
                  icon={Users}
                  color="blue"
                />
                <StatCard
                  label="RCF Members"
                  value={stats?.rcfMembers}
                  icon={CheckCircle2}
                  color="indigo"
                />
                <StatCard
                  label="Guest Attendance"
                  value={stats?.guests}
                  icon={Users}
                  color="amber"
                />
                <StatCard
                  label="Active Questions"
                  value={questions.length}
                  icon={MessageSquare}
                  color="teal"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Level Breakdown */}
                <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-slate-400" />
                    Attendees Breakdown
                  </h3>
                  <div className="space-y-4">
                    {Object.entries(stats?.levelBreakdown || {}).sort((a:any, b:any) => b[1] - a[1]).map(([level, count]: [string, any]) => (
                      <div key={level}>
                        <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                          <span className="text-slate-600 uppercase tracking-wider">{level}</span>
                          <span className="text-slate-900">{count}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-slate-900 rounded-full"
                            style={{ width: `${(count / stats.totalRegistered) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gender / Demographic */}
                <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-400" />
                    Gender Distribution
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100/50 flex flex-col items-center text-center">
                      <span className="text-2xl font-black text-blue-700">{stats?.genderBreakdown.male}</span>
                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mt-1">Brothers</span>
                    </div>
                    <div className="p-6 bg-pink-50/50 rounded-2xl border border-pink-100/50 flex flex-col items-center text-center">
                      <span className="text-2xl font-black text-pink-700">{stats?.genderBreakdown.female}</span>
                      <span className="text-[10px] font-black text-pink-400 uppercase tracking-widest mt-1">Sisters</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "attendees" && (
            <motion.div
              key="attendees"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, email or phone..."
                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-rcf-navy/5 focus:border-rcf-navy transition-all"
                  />
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  Showing {filteredAttendees.length} of {stats?.totalRegistered}
                </div>
              </div>

              <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Name</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Identifier</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Academic Hub</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Ecosystem</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Registered</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredAttendees.map((r: any) => (
                        <tr key={r.id} className="hover:bg-slate-50/30 transition-colors group">
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white ${
                                r.gender?.toLowerCase() === 'male' ? 'bg-blue-600' :
                                r.gender?.toLowerCase() === 'female' ? 'bg-pink-500' : 'bg-slate-400'
                              }`}>
                                {r.first_name[0]}{r.last_name[0]}
                              </div>
                              <div>
                                <div className="text-sm font-bold text-slate-900 leading-none mb-1">{r.first_name} {r.last_name}</div>
                                <div className="text-[10px] font-medium text-slate-400">{r.phone_number}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="text-xs font-bold text-slate-600">{r.email}</div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-900">{displayLevelBetter(r.level)}</span>
                              {/* <span className="text-[10px] font-medium text-slate-400 truncate max-w-[150px]">{r.department}</span> */}
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            {r.is_rcf_member ? (
                              <span className="px-2.5 py-1 bg-rcf-navy/5 text-rcf-navy text-[9px] font-black uppercase tracking-widest rounded-lg border border-rcf-navy/10">Member</span>
                            ) : (
                              <span className="px-2.5 py-1 bg-amber-50 text-amber-600 text-[9px] font-black uppercase tracking-widest rounded-lg border border-amber-100">Guest</span>
                            )}
                          </td>
                          <td className="px-6 py-5">
                            <div className="text-[10px] font-bold text-slate-400">{format(new Date(r.created_at), "MMM d, HH:mm")}</div>
                          </td>
                        </tr>
                      ))}
                      {filteredAttendees.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-20 text-center">
                             <div className="flex flex-col items-center gap-3">
                               <Users className="w-10 h-10 text-slate-200" />
                               <p className="text-sm font-bold text-slate-400">No matching registrants found</p>
                             </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "questions" && (
            <motion.div
              key="questions"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm">
                 <div className="flex items-center gap-4 mb-8">
                   <div className="w-12 h-12 bg-rcf-navy rounded-2xl flex items-center justify-center text-white">
                     <MessageSquare className="w-6 h-6" />
                   </div>
                   <div>
                     <h2 className="text-lg font-black text-slate-900 tracking-tight">Lo! App Interactivity</h2>
                     <p className="text-xs text-slate-500 font-medium">Monitoring all thoughts and inquiries linked with #{slug}</p>
                   </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {questions.length === 0 ? (
                      <div className="md:col-span-2 py-20 text-center bg-slate-50/50 rounded-[28px] border-4 border-dashed border-slate-100">
                         <p className="text-sm font-bold text-slate-400">No questions have been asked yet for this event tag.</p>
                      </div>
                   ) : (
                     questions.map((q) => (
                       <div key={q.id} className="p-6 bg-white border border-slate-200 rounded-3xl hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
                         <div className="flex items-start justify-between mb-4">
                           <div className="flex items-center gap-2">
                             <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">
                               {q.asker_name?.[0] || 'A'}
                             </div>
                             <div>
                               <div className="text-xs font-bold text-slate-900">{q.asker_name || 'Anonymous'}</div>
                               <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{format(new Date(q.created_at), "MMM d, yyyy")}</div>
                             </div>
                           </div>
                           <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                             q.status === 'answered' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                           }`}>
                             {q.status}
                           </span>
                         </div>
                         <p className="text-sm text-slate-600 leading-relaxed font-medium mb-4">&quot;{q.question_text}&quot;</p>
                         {q.scripture_reference && (
                           <div className="flex items-center gap-1.5 p-2 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-bold">
                             <Calendar className="w-3 h-3" />
                             {q.scripture_reference}
                           </div>
                         )}
                         {q.answer_text && (
                           <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                             <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                               Official Response
                             </div>
                             <p className="text-xs text-slate-600 leading-relaxed italic">&quot;{q.answer_text}&quot;</p>
                           </div>
                         )}
                       </div>
                     ))
                   )}
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  const colorMap: any = {
    blue: "bg-blue-600 text-white shadow-blue-500/20",
    indigo: "bg-indigo-600 text-white shadow-indigo-500/20",
    amber: "bg-amber-500 text-white shadow-amber-500/20",
    teal: "bg-teal-600 text-white shadow-teal-500/20",
  };

  return (
    <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group">
      <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
        <Icon className="w-32 h-32" />
      </div>
      <div className="relative z-10 flex flex-col items-start">
        <div className={`w-10 h-10 ${colorMap[color]} rounded-2xl flex items-center justify-center mb-6 shadow-xl`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
        <div className="text-4xl font-black text-slate-900 tracking-tighter">{value || 0}</div>
      </div>
    </div>
  );
}
