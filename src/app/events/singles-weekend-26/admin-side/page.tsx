"use client";

import { useState, useEffect } from "react";

import { 
  Loader2, 
  Users, 
  UserCheck, 
  ShoppingBag, 
  BookOpen, 
  QrCode 
} from "lucide-react";
import { getAgapeStats } from "./actions";
import { 
  Header, 
  TabNavigation, 
  OverviewTab, 
  LinksTab, 
  AttendeesTab, 
  QuestionsTab 
} from "./components";
import { StatsData, RegistrantType, TabType, LinkItem } from "./types";

const EVENT_PATH = "/events/singles-weekend-26";

const LINKS: LinkItem[] = [
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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Questions tab state
  const [questionsSearch, setQuestionsSearch] = useState("");
  const [questionsFilter, setQuestionsFilter] = useState("");
  const [questionsSortBy, setQuestionsSortBy] = useState<'newest' | 'oldest' | 'longest' | 'shortest' | 'name'>('newest');
  const [currentQuestionsPage, setCurrentQuestionsPage] = useState(1);
  const [questionsPerPage, setQuestionsPerPage] = useState(25);

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

  const toggleRowExpansion = (attendeeId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(attendeeId)) {
      newExpanded.delete(attendeeId);
    } else {
      newExpanded.add(attendeeId);
    }
    setExpandedRows(newExpanded);
  };

  const getRelationshipStatusBadgeClass = (status: string) => {
    const statusLower = status?.toLowerCase() || "";
    if (statusLower === "single") return "bg-green-100 text-green-700";
    if (statusLower === "in_relationship") return "bg-blue-100 text-blue-700";
    if (statusLower === "engaged") return "bg-purple-100 text-purple-700";
    if (statusLower === "complicated") return "bg-amber-100 text-amber-700";
    return "bg-gray-100 text-gray-700";
  };

  const getRelationshipStatusDisplayName = (status: string) => {
    switch (status?.toLowerCase()) {
      case "single": return "Single";
      case "in_relationship": return "In a Relationship";
      case "engaged": return "Engaged";
      case "complicated": return "You can't exactly tell yet";
      default: return status || "Not specified";
    }
  };

  const filteredAttendees =
    data?.registrants?.filter(
      (a) =>
        a.first_name.toLowerCase().includes(search.toLowerCase()) ||
        a.last_name.toLowerCase().includes(search.toLowerCase()) ||
        a.email.toLowerCase().includes(search.toLowerCase()) ||
        a.phone_number.includes(search) ||
        (a.coupon_code && a.coupon_code.toLowerCase().includes(search.toLowerCase())) ||
        (a.relationship_status && a.relationship_status.toLowerCase().includes(search.toLowerCase())) ||
        (a.questions_content && a.questions_content.toLowerCase().includes(search.toLowerCase()))
    ) || [];

  // Questions filtering and pagination logic
  const questionsData = data?.registrants?.filter((r: RegistrantType) => r.questions_content && r.questions_content.trim()) || [];

  const filteredQuestions = questionsData.filter((registrant) => {
    // Text search
    const matchesSearch = !questionsSearch || 
      registrant.first_name.toLowerCase().includes(questionsSearch.toLowerCase()) ||
      registrant.last_name.toLowerCase().includes(questionsSearch.toLowerCase()) ||
      registrant.email.toLowerCase().includes(questionsSearch.toLowerCase()) ||
      (registrant.questions_content && registrant.questions_content.toLowerCase().includes(questionsSearch.toLowerCase()));

    // Filter conditions
    let matchesFilter = true;
    switch (questionsFilter) {
      case 'long':
        matchesFilter = (registrant.questions_content?.length || 0) >= 100;
        break;
      case 'short':
        matchesFilter = (registrant.questions_content?.length || 0) < 100;
        break;
      case 'checked_in':
        matchesFilter = !!registrant.checked_in_at;
        break;
      case 'male':
        matchesFilter = registrant.gender?.toLowerCase() === 'male';
        break;
      case 'female':
        matchesFilter = registrant.gender?.toLowerCase() === 'female';
        break;
      case 'guests':
        matchesFilter = !registrant.is_rcf_member;
        break;
      case 'members':
        matchesFilter = registrant.is_rcf_member;
        break;
      default:
        matchesFilter = true;
    }

    return matchesSearch && matchesFilter;
  }).sort((a, b) => {
    switch (questionsSortBy) {
      case 'oldest':
        return new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime();
      case 'longest':
        return (b.questions_content?.length || 0) - (a.questions_content?.length || 0);
      case 'shortest':
        return (a.questions_content?.length || 0) - (b.questions_content?.length || 0);
      case 'name':
        return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      default: // newest
        return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
    }
  });

  const paginatedQuestions = filteredQuestions.slice(
    (currentQuestionsPage - 1) * questionsPerPage,
    currentQuestionsPage * questionsPerPage
  );

  const handleExportCSV = () => {
    if (!data) return;
    const headers = [
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Gender",
      "Level",
      "Relationship Status",
      "RCF Member",
      "Questions/Comments",
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
      getRelationshipStatusDisplayName(r.relationship_status || ""),
      r.is_rcf_member ? "Yes" : "No",
      (r.questions_content || "").replace(/[\r\n]+/g, " ").replace(/,/g, ";"),
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
      <Header loading={loading} loadData={loadData} />
      
      <TabNavigation activeTab={tab} setTab={setTab} />

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6 sm:pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          </div>
        ) : (
          <>
            {tab === "overview" && (
              <OverviewTab
                data={data}
                copiedId={copiedId}
                copyToClipboard={copyToClipboard}
                getRelationshipStatusDisplayName={getRelationshipStatusDisplayName}
                getColorClasses={getColorClasses}
                LINKS={LINKS}
              />
            )}

            {tab === "links" && (
              <LinksTab
                copiedId={copiedId}
                copyToClipboard={copyToClipboard}
                getColorClasses={getColorClasses}
                LINKS={LINKS}
              />
            )}

            {tab === "attendees" && (
              <AttendeesTab
                data={data}
                search={search}
                setSearch={setSearch}
                filteredAttendees={filteredAttendees}
                expandedRows={expandedRows}
                toggleRowExpansion={toggleRowExpansion}
                getRelationshipStatusBadgeClass={getRelationshipStatusBadgeClass}
                getRelationshipStatusDisplayName={getRelationshipStatusDisplayName}
                handleExportCSV={handleExportCSV}
              />
            )}

            {tab === "questions" && (
              <QuestionsTab
                questionsData={questionsData}
                filteredQuestions={filteredQuestions}
                paginatedQuestions={paginatedQuestions}
                questionsSearch={questionsSearch}
                setQuestionsSearch={setQuestionsSearch}
                questionsFilter={questionsFilter}
                setQuestionsFilter={setQuestionsFilter}
                questionsSortBy={questionsSortBy}
                setQuestionsSortBy={setQuestionsSortBy}
                currentQuestionsPage={currentQuestionsPage}
                setCurrentQuestionsPage={setCurrentQuestionsPage}
                questionsPerPage={questionsPerPage}
                setQuestionsPerPage={setQuestionsPerPage}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
