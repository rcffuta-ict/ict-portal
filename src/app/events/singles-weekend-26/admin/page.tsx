"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Heart,
  CheckCircle2,
  Search,
  RefreshCcw,
  Download,
  Loader2,
  UserCheck,
  Copy,
  Check,
  ExternalLink,
  Link2,
  ShoppingBag,
  QrCode,
  BookOpen,
  Gift,
  Ticket,
  TrendingUp,
} from "lucide-react";
import { getAgapeStats } from "./actions";

const EVENT_PATH = "/events/singles-weekend-26";

type TabType = "overview" | "links" | "attendees";

interface RegistrantType {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  gender: string;
  level: string;
  checked_in_at: string | null;
  coupon_code: string | null;
  coupon_active: boolean;
  coupon_used_at: string | null;
}

interface StatsData {
  totalRegistered: number;
  checkedIn: number;
  brothers: number;
  sisters: number;
  levelBreakdown: Record<string, number>;
  registrants: RegistrantType[];
}

const LINKS = [
  {
    id: "registration",
    title: "Registration Page",
    description: "Public event registration for new attendees",
    path: `${EVENT_PATH}`,
    icon: Users,
    color: "purple",
    shareText: "🎉 Register for Agape '26 Singles Weekend!",
  },
  {
    id: "self-checkin",
    title: "Self Check-In",
    description: "Attendees can check themselves in using their phone or email",
    path: `${EVENT_PATH}/check-in/self`,
    icon: UserCheck,
    color: "green",
    shareText: "✨ Check in to Agape '26 Singles Weekend!",
  },
  {
    id: "vendor-scanner",
    title: "Vendor Portal",
    description: "Vendors use this to scan and validate shopping coupons",
    path: `${EVENT_PATH}/vendor`,
    icon: ShoppingBag,
    color: "amber",
    shareText: "🛍️ Vendor Portal for Agape '26:",
  },
  {
    id: "docs",
    title: "Documentation",
    description: "Complete guide explaining the event flow and system",
    path: `${EVENT_PATH}/docs`,
    icon: BookOpen,
    color: "blue",
    shareText: "📖 Agape '26 Event Documentation:",
  },
  {
    id: "admin-dashboard",
    title: "Admin Dashboard",
    description: "This admin panel for monitoring and management",
    path: `${EVENT_PATH}/admin`,
    icon: QrCode,
    color: "teal",
    shareText: "⚙️ Admin Dashboard for Agape '26:",
  },
];

export default function AgapeAdmin() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>("overview");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await getAgapeStats();
      if (result) {
        setData(result);
      }
    } catch (e) {
      console.error("Error loading data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const copyToClipboard = async (linkId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(linkId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const filteredAttendees =
    data?.registrants?.filter(
      (a) =>
        a.first_name.toLowerCase().includes(search.toLowerCase()) ||
        a.last_name.toLowerCase().includes(search.toLowerCase()) ||
        a.email.toLowerCase().includes(search.toLowerCase()) ||
        a.phone_number.includes(search) ||
        (a.coupon_code && a.coupon_code.toLowerCase().includes(search.toLowerCase()))
    ) || [];

  const handleExportCSV = () => {
    if (!data) return;
    const headers = [
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Gender",
      "Level",
      "Checked In",
      "Coupon Code",
      "Coupon Active",
      "Coupon Used",
    ];
    const rows = data.registrants.map((r) => [
      r.first_name,
      r.last_name,
      r.email,
      r.phone_number,
      r.gender,
      r.level,
      r.checked_in_at ? "Yes" : "No",
      r.coupon_code || "",
      r.coupon_active ? "Yes" : "No",
      r.coupon_used_at || "",
    ]);
    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "agape26-attendees.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const couponsGenerated = data?.registrants?.filter((r) => r.coupon_code).length || 0;
  const couponsActive = data?.registrants?.filter((r) => r.coupon_active).length || 0;
  const couponsRedeemed = data?.registrants?.filter((r) => r.coupon_used_at).length || 0;

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
      purple: {
        bg: "bg-purple-50",
        text: "text-purple-600",
        border: "border-purple-200",
        iconBg: "bg-purple-100",
      },
      green: {
        bg: "bg-green-50",
        text: "text-green-600",
        border: "border-green-200",
        iconBg: "bg-green-100",
      },
      amber: {
        bg: "bg-amber-50",
        text: "text-amber-600",
        border: "border-amber-200",
        iconBg: "bg-amber-100",
      },
      blue: {
        bg: "bg-blue-50",
        text: "text-blue-600",
        border: "border-blue-200",
        iconBg: "bg-blue-100",
      },
      teal: {
        bg: "bg-teal-50",
        text: "text-teal-600",
        border: "border-teal-200",
        iconBg: "bg-teal-100",
      },
    };
    return colors[color] || colors.purple;
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-teal-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="relative shrink-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-linear-to-br from-teal-500 to-teal-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/20">
                <Heart className="h-5 w-5 sm:h-6 sm:w-6 text-white fill-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-amber-400 rounded-full border-2 border-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">Agape &apos;26 Admin</h1>
              <p className="text-xs sm:text-sm text-slate-500 hidden sm:block">Singles Weekend Management</p>
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-all disabled:opacity-50 shadow-lg shadow-teal-500/20 shrink-0 text-sm sm:text-base"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex gap-1 sm:gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          {[
            { id: "overview", label: "Overview", icon: TrendingUp },
            { id: "links", label: "Links", icon: Link2 },
            { id: "attendees", label: "Attendees", icon: Users },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as TabType)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap text-sm sm:text-base ${
                tab === t.id
                  ? "bg-teal-600 text-white shadow-md"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6 sm:pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {tab === "overview" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                  {[
                    {
                      label: "Total Registered",
                      value: data?.totalRegistered || 0,
                      icon: Users,
                      color: "from-purple-500 to-purple-600",
                      bgLight: "bg-purple-50",
                    },
                    {
                      label: "Checked In",
                      value: data?.checkedIn || 0,
                      icon: CheckCircle2,
                      color: "from-green-500 to-green-600",
                      bgLight: "bg-green-50",
                    },
                    {
                      label: "Brothers",
                      value: data?.brothers || 0,
                      icon: Users,
                      color: "from-blue-500 to-blue-600",
                      bgLight: "bg-blue-50",
                    },
                    {
                      label: "Sisters",
                      value: data?.sisters || 0,
                      icon: Heart,
                      color: "from-pink-500 to-pink-600",
                      bgLight: "bg-pink-50",
                    },
                    {
                      label: "Coupons Active",
                      value: couponsActive,
                      icon: Gift,
                      color: "from-amber-500 to-amber-600",
                      bgLight: "bg-amber-50",
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className={`${stat.bgLight} rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-white shadow-sm`}
                    >
                      <div
                        className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-linear-to-br ${stat.color} flex items-center justify-center mb-2 sm:mb-3 shadow-lg`}
                      >
                        <stat.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <p className="text-2xl sm:text-3xl font-bold text-slate-900">{stat.value}</p>
                      <p className="text-slate-500 text-xs sm:text-sm">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Additional Stats */}
                <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
                  {/* Coupon Stats */}
                  <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm">
                    <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-3 sm:mb-4 flex items-center gap-2">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-amber-100">
                        <Ticket className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                      </div>
                      Coupon Statistics
                    </h3>
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex justify-between items-center py-1.5 sm:py-2">
                        <span className="text-slate-600 text-sm sm:text-base">Total Generated</span>
                        <span className="text-slate-900 font-semibold">{couponsGenerated}</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 sm:py-2">
                        <span className="text-slate-600 text-sm sm:text-base">Active (Unused)</span>
                        <span className="text-green-600 font-semibold">{couponsActive}</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 sm:py-2">
                        <span className="text-slate-600 text-sm sm:text-base">Redeemed</span>
                        <span className="text-amber-600 font-semibold">{couponsRedeemed}</span>
                      </div>
                      <div className="pt-2 sm:pt-3 border-t border-slate-100">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600 text-sm sm:text-base">Redemption Rate</span>
                          <span className="text-teal-600 font-semibold">
                            {couponsGenerated > 0
                              ? ((couponsRedeemed / couponsGenerated) * 100).toFixed(1)
                              : 0}
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Links */}
                  <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm">
                    <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-3 sm:mb-4 flex items-center gap-2">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-teal-100">
                        <Link2 className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600" />
                      </div>
                      Quick Links
                    </h3>
                    <div className="space-y-2">
                      {LINKS.slice(0, 4).map((link) => {
                        const colors = getColorClasses(link.color);
                        return (
                          <div
                            key={link.id}
                            className={`flex items-center justify-between p-2 sm:p-3 rounded-lg sm:rounded-xl ${colors.bg} border ${colors.border}`}
                          >
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                              <div className={`p-1.5 sm:p-2 rounded-lg ${colors.iconBg} shrink-0`}>
                                <link.icon className={`w-3 h-3 sm:w-4 sm:h-4 ${colors.text}`} />
                              </div>
                              <span className="text-slate-900 text-xs sm:text-sm font-medium truncate">{link.title}</span>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() =>
                                  copyToClipboard(
                                    link.id,
                                    `${link.shareText}\n${window.location.origin}${link.path}`
                                  )
                                }
                                className="p-1.5 sm:p-2 rounded-lg hover:bg-white/50 transition-colors"
                              >
                                {copiedId === link.id ? (
                                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                                ) : (
                                  <Copy className={`w-3 h-3 sm:w-4 sm:h-4 ${colors.text}`} />
                                )}
                              </button>
                              <a
                                href={link.path}
                                target="_blank"
                                className="p-1.5 sm:p-2 rounded-lg hover:bg-white/50 transition-colors"
                              >
                                <ExternalLink className={`w-3 h-3 sm:w-4 sm:h-4 ${colors.text}`} />
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Links Tab */}
            {tab === "links" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <div className="p-1.5 sm:p-2 rounded-lg bg-teal-100">
                      <Link2 className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600" />
                    </div>
                    Event Links
                  </h2>
                  <p className="text-slate-500 mb-4 sm:mb-6 text-sm sm:text-base">
                    Copy and share these links with attendees, vendors, and team members.
                  </p>

                  <div className="space-y-3 sm:space-y-4">
                    {LINKS.map((link) => {
                      const colors = getColorClasses(link.color);
                      const fullUrl =
                        typeof window !== "undefined"
                          ? `${window.location.origin}${link.path}`
                          : link.path;

                      return (
                        <div
                          key={link.id}
                          className={`p-3 sm:p-4 rounded-lg sm:rounded-xl ${colors.bg} border ${colors.border} transition-all hover:shadow-md`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                            <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${colors.iconBg} w-fit`}>
                              <link.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${colors.text}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-slate-900 font-semibold text-base sm:text-lg">{link.title}</h3>
                              <p className="text-slate-500 text-xs sm:text-sm mt-1">{link.description}</p>
                              <div className="mt-2 sm:mt-3 flex flex-col sm:flex-row sm:items-center gap-2 bg-white/70 rounded-lg p-2 border border-slate-200">
                                <code className="text-xs text-slate-600 flex-1 truncate">
                                  {fullUrl}
                                </code>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() =>
                                      copyToClipboard(link.id, `${link.shareText}\n${fullUrl}`)
                                    }
                                    className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg ${colors.iconBg} ${colors.text} text-xs sm:text-sm font-medium hover:opacity-80 transition-opacity`}
                                  >
                                    {copiedId === link.id ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                        Copied!
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                        Copy
                                      </>
                                    )}
                                  </button>
                                  <a
                                    href={link.path}
                                    target="_blank"
                                    className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs sm:text-sm font-medium hover:bg-slate-200 transition-colors`}
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    Open
                                  </a>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Attendees Tab */}
            {tab === "attendees" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Search and Actions */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
                  <div className="relative flex-1 sm:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by name, email, phone, or coupon..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-9 sm:pl-10 pr-4 py-2 sm:py-2.5 bg-white border border-slate-200 rounded-xl text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent shadow-sm"
                    />
                  </div>
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center justify-center gap-2 px-4 py-2 sm:py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-500/20 text-sm sm:text-base"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                </div>

                {/* Attendees Table */}
                <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-150">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                            Contact
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                            Gender
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                            Level
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                            Coupon
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredAttendees.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                              No attendees found
                            </td>
                          </tr>
                        ) : (
                          filteredAttendees.map((attendee) => (
                            <tr key={attendee.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <p className="text-slate-900 font-medium">
                                  {attendee.first_name} {attendee.last_name}
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-slate-700 text-sm">{attendee.email}</p>
                                <p className="text-slate-400 text-xs">{attendee.phone_number}</p>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    attendee.gender?.toLowerCase() === "male"
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-pink-100 text-pink-700"
                                  }`}
                                >
                                  {attendee.gender?.toLowerCase() === "male" ? "Brother" : "Sister"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-700 text-sm">{attendee.level}</td>
                              <td className="px-4 py-3">
                                {attendee.checked_in_at ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Checked In
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                                    Pending
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {attendee.coupon_code ? (
                                  <div className="space-y-1">
                                    <code className="text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                      {attendee.coupon_code}
                                    </code>
                                    {attendee.coupon_used_at ? (
                                      <p className="text-xs text-amber-600 font-medium">Redeemed</p>
                                    ) : attendee.coupon_active ? (
                                      <p className="text-xs text-green-600 font-medium">Active</p>
                                    ) : (
                                      <p className="text-xs text-slate-400">Inactive</p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-sm">—</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <p className="text-slate-500 text-sm text-center">
                  Showing {filteredAttendees.length} of {data?.registrants?.length || 0} attendees
                </p>
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
