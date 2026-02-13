"use client";

import { useState, useCallback, useEffect } from "react";
import {
    MessageSquare,
    Shield,
    Search,
    RefreshCw,
    AlertCircle,
    Home,
    Compass,
    Settings,
    HelpCircle,
    CheckCircle2,
    Clock,
    Hash,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import Link from "next/link";
import { AskQuestionForm } from "./AskQuestionForm";
import { QuestionFeed } from "./QuestionFeed";
import { AdminPanel } from "./AdminPanel";
import { getQuestions, answerQuestion, toggleVisibility } from "@/app/qa/actions";

export interface Question {
    id: string;
    question_text: string;
    scripture_reference?: string;
    asker_name?: string;
    answer_text?: string;
    answered_at?: string;
    created_at: string;
    status: "visible" | "hidden" | "answered" | "flagged";
    event_id: string;
    answer_author_name?: string;
}

export interface AuthUser {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}

interface Event {
    id: string;
    title: string;
}

interface QAPageClientProps {
    initialQuestions: Question[];
    events: Event[];
    isAdmin: boolean;
    authenticatedUser: AuthUser | null;
}

type ViewTab = "feed" | "admin";
type FilterType = "all" | "answered" | "unanswered";

export function QAPageClient({
    initialQuestions,
    events,
    isAdmin,
    authenticatedUser,
}: QAPageClientProps) {
    const [activeTab, setActiveTab] = useState<ViewTab>("feed");
    const [questions, setQuestions] = useState<Question[]>(initialQuestions);
    const [filter, setFilter] = useState<FilterType>("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchFocused, setSearchFocused] = useState(false);

    const fetchQuestions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const statusFilters: string[] = [];
            if (isAdmin && activeTab === "admin") {
                statusFilters.push("visible", "answered", "flagged", "hidden");
            } else {
                if (filter === "answered") statusFilters.push("answered");
                else if (filter === "unanswered") statusFilters.push("visible");
                else statusFilters.push("visible", "answered");
            }

            const result = await getQuestions({
                status: statusFilters,
                search_term: searchTerm || undefined,
            });

            if (result.success) {
                setQuestions(result.data || []);
            } else {
                setError(result.error || "Failed to load questions");
            }
        } catch {
            setError("Failed to load questions");
        } finally {
            setLoading(false);
        }
    }, [filter, searchTerm, isAdmin, activeTab]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchQuestions();
        }, 350);
        return () => clearTimeout(timer);
    }, [fetchQuestions]);

    const handleAnswer = async (id: string, text: string) => {
        const result = await answerQuestion(id, text);
        if (result.success) {
            setQuestions((prev) =>
                prev.map((q) =>
                    q.id === id
                        ? {
                              ...q,
                              answer_text: text,
                              status: "answered" as const,
                              answered_at: new Date().toISOString(),
                          }
                        : q
                )
            );
        } else {
            alert("Failed to answer: " + result.error);
        }
    };

    const handleToggleVisibility = async (
        id: string,
        status: "visible" | "hidden"
    ) => {
        const result = await toggleVisibility(id, status);
        if (result.success) {
            setQuestions((prev) =>
                prev.map((q) => (q.id === id ? { ...q, status } : q))
            );
        } else {
            alert("Failed to update: " + result.error);
        }
    };

    const handleQuestionSubmitted = () => {
        fetchQuestions();
    };

    // Stats
    const totalQuestions = questions.length;
    const answeredCount = questions.filter((q) => q.status === "answered").length;
    const pendingCount = questions.filter((q) => q.status === "visible").length;

    const filterTabs: { id: FilterType; label: string; count?: number }[] = [
        { id: "all", label: "Latest" },
        { id: "answered", label: "Answered", count: answeredCount },
        { id: "unanswered", label: "Pending", count: pendingCount },
    ];

    return (
        <div className="min-h-screen bg-[#f7f9fa]">
            {/* ─── Top Navigation Bar ─── */}
            <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 backdrop-blur-xl bg-white/95">
                <div className="max-w-[1280px] mx-auto px-4">
                    <div className="flex items-center justify-between h-14">
                        {/* Left: Logo */}
                        <div className="flex items-center gap-3">
                            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                                <Logo width={32} />
                            </Link>
                            <div className="hidden md:block h-5 w-px bg-slate-200" />
                            <h1 className="hidden md:block text-sm font-bold text-slate-900">Q&A</h1>
                        </div>

                        {/* Center: Search */}
                        <div className={`relative transition-all duration-200 ${searchFocused ? "w-80" : "w-64"} hidden md:block`}>
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search questions"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onFocus={() => setSearchFocused(true)}
                                onBlur={() => setSearchFocused(false)}
                                className="w-full pl-10 pr-4 py-2 rounded-full bg-slate-100 border border-transparent focus:bg-white focus:border-rcf-navy focus:ring-1 focus:ring-rcf-navy/20 outline-none text-sm text-slate-900 placeholder:text-slate-500 transition-all"
                            />
                        </div>

                        {/* Right: User */}
                        <div className="flex items-center gap-3">
                            {isAdmin && (
                                <div className="flex bg-slate-100 p-0.5 rounded-full">
                                    <button
                                        onClick={() => setActiveTab("feed")}
                                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                            activeTab === "feed"
                                                ? "bg-rcf-navy text-white shadow-sm"
                                                : "text-slate-600 hover:text-slate-900"
                                        }`}
                                    >
                                        Feed
                                    </button>
                                    <button
                                        onClick={() => setActiveTab("admin")}
                                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1 ${
                                            activeTab === "admin"
                                                ? "bg-rcf-navy text-white shadow-sm"
                                                : "text-slate-600 hover:text-slate-900"
                                        }`}
                                    >
                                        <Shield className="w-3 h-3" />
                                        Admin
                                    </button>
                                </div>
                            )}
                            {authenticatedUser ? (
                                <Link href="/dashboard" className="flex items-center gap-2 group">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rcf-navy to-rcf-navy-light text-white flex items-center justify-center text-[11px] font-bold ring-2 ring-white shadow-sm group-hover:ring-rcf-navy/20 transition-all">
                                        {authenticatedUser.firstName[0]}{authenticatedUser.lastName[0]}
                                    </div>
                                </Link>
                            ) : (
                                <Link
                                    href="/login"
                                    className="text-xs font-semibold text-rcf-navy hover:underline"
                                >
                                    Sign in
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* ─── Main Layout ─── */}
            <div className="max-w-[1280px] mx-auto flex">
                {/* ─── Left Sidebar (Desktop) ─── */}
                <aside className="hidden lg:flex flex-col w-[260px] shrink-0 px-4 pt-4 sticky top-14 h-[calc(100vh-56px)] justify-between">
                    <nav className="space-y-1">
                        <Link href="/" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors group">
                            <Home className="w-5 h-5 text-slate-500 group-hover:text-rcf-navy" />
                            <span className="text-sm font-medium">Home</span>
                        </Link>
                        <Link href="/events" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors group">
                            <Compass className="w-5 h-5 text-slate-500 group-hover:text-rcf-navy" />
                            <span className="text-sm font-medium">Events</span>
                        </Link>
                        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-rcf-navy/5 text-rcf-navy">
                            <MessageSquare className="w-5 h-5" />
                            <span className="text-sm font-bold">Q&A Hub</span>
                        </div>
                        <Link href="/dashboard" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors group">
                            <Settings className="w-5 h-5 text-slate-500 group-hover:text-rcf-navy" />
                            <span className="text-sm font-medium">Dashboard</span>
                        </Link>
                    </nav>

                    {/* User Card */}
                    {authenticatedUser && (
                        <div className="mb-4 p-3 rounded-2xl bg-white border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rcf-navy to-rcf-navy-light text-white flex items-center justify-center text-xs font-bold">
                                    {authenticatedUser.firstName[0]}{authenticatedUser.lastName[0]}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-slate-900 truncate">
                                        {authenticatedUser.firstName} {authenticatedUser.lastName}
                                    </p>
                                    <p className="text-[11px] text-slate-500 truncate">{authenticatedUser.email}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </aside>

                {/* ─── Main Feed ─── */}
                <main className="flex-1 min-w-0 border-x border-slate-200/80 bg-white min-h-screen">
                    {activeTab === "feed" ? (
                        <>
                            {/* Feed Header */}
                            <div className="sticky top-14 z-20 bg-white/95 backdrop-blur-xl border-b border-slate-200/80">
                                <div className="px-4 pt-3 pb-0">
                                    <h2 className="text-xl font-extrabold text-slate-900">Q&A</h2>
                                    <p className="text-xs text-slate-500 mb-3">Ask questions & engage with scripture</p>
                                </div>

                                {/* Filter Tabs - Twitter/X style */}
                                <div className="flex">
                                    {filterTabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setFilter(tab.id)}
                                            className={`flex-1 py-3 text-sm font-semibold text-center relative transition-colors hover:bg-slate-50 ${
                                                filter === tab.id
                                                    ? "text-slate-900"
                                                    : "text-slate-500"
                                            }`}
                                        >
                                            {tab.label}
                                            {tab.count !== undefined && tab.count > 0 && (
                                                <span className={`ml-1 text-xs ${
                                                    filter === tab.id ? "text-rcf-navy" : "text-slate-400"
                                                }`}>
                                                    {tab.count}
                                                </span>
                                            )}
                                            {filter === tab.id && (
                                                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-[3px] bg-rcf-navy rounded-full" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Mobile Search */}
                            <div className="md:hidden px-4 py-3 border-b border-slate-100">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search questions"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 rounded-full bg-slate-100 border border-transparent focus:bg-white focus:border-rcf-navy focus:ring-1 focus:ring-rcf-navy/20 outline-none text-sm text-slate-900 placeholder:text-slate-500 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Compose Box */}
                            <AskQuestionForm
                                events={events}
                                authenticatedUser={authenticatedUser}
                                onQuestionSubmitted={handleQuestionSubmitted}
                            />

                            {/* Questions */}
                            {loading && questions.length === 0 ? (
                                <div className="py-20 text-center flex flex-col items-center">
                                    <RefreshCw className="w-5 h-5 mb-3 animate-spin text-rcf-navy" />
                                    <p className="text-sm text-slate-500">Loading questions...</p>
                                </div>
                            ) : error ? (
                                <div className="m-4 p-6 text-center text-red-600 flex flex-col items-center bg-red-50 rounded-2xl border border-red-100">
                                    <AlertCircle className="w-5 h-5 mb-2" />
                                    <p className="text-sm font-medium">{error}</p>
                                    <button
                                        onClick={fetchQuestions}
                                        className="mt-3 text-xs text-red-600 hover:text-red-700 underline"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            ) : questions.length === 0 ? (
                                <div className="py-20 text-center flex flex-col items-center px-4">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                        <HelpCircle className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 mb-1">
                                        {searchTerm ? "No results" : "No questions yet"}
                                    </h3>
                                    <p className="text-sm text-slate-500 max-w-sm">
                                        {searchTerm
                                            ? `Nothing found for "${searchTerm}". Try a different search.`
                                            : "Be the first to ask! Your question could spark a great conversation."}
                                    </p>
                                </div>
                            ) : (
                                <QuestionFeed
                                    questions={questions}
                                    isAdmin={isAdmin}
                                    onAnswer={handleAnswer}
                                    onToggleVisibility={handleToggleVisibility}
                                />
                            )}

                            {loading && questions.length > 0 && (
                                <div className="flex justify-center py-6">
                                    <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                                </div>
                            )}
                        </>
                    ) : (
                        <AdminPanel
                            questions={questions}
                            onAnswer={handleAnswer}
                            onToggleVisibility={handleToggleVisibility}
                            onRefresh={fetchQuestions}
                            loading={loading}
                        />
                    )}
                </main>

                {/* ─── Right Sidebar (Desktop) ─── */}
                <aside className="hidden xl:block w-[300px] shrink-0 px-5 pt-4 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto">
                    {/* Stats Card */}
                    <div className="bg-slate-50 rounded-2xl p-4 mb-4">
                        <h3 className="text-base font-extrabold text-slate-900 mb-3">What&apos;s happening</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-rcf-navy/10 flex items-center justify-center">
                                        <MessageSquare className="w-3.5 h-3.5 text-rcf-navy" />
                                    </div>
                                    <span className="text-sm text-slate-700">Total Questions</span>
                                </div>
                                <span className="text-sm font-bold text-slate-900">{totalQuestions}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                    </div>
                                    <span className="text-sm text-slate-700">Answered</span>
                                </div>
                                <span className="text-sm font-bold text-green-600">{answeredCount}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                                    </div>
                                    <span className="text-sm text-slate-700">Pending</span>
                                </div>
                                <span className="text-sm font-bold text-amber-600">{pendingCount}</span>
                            </div>
                        </div>
                    </div>

                    {/* Trending Topics */}
                    {events.length > 0 && (
                        <div className="bg-slate-50 rounded-2xl p-4 mb-4">
                            <h3 className="text-base font-extrabold text-slate-900 mb-3">Active Events</h3>
                            <div className="space-y-2.5">
                                {events.slice(0, 5).map((event) => (
                                    <div key={event.id} className="flex items-center gap-2 group cursor-default">
                                        <Hash className="w-3.5 h-3.5 text-slate-400 group-hover:text-rcf-navy shrink-0" />
                                        <span className="text-sm text-slate-600 group-hover:text-rcf-navy truncate transition-colors">
                                            {event.title}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="pb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <Logo width={24} />
                            <span className="text-xs font-bold text-slate-700">RCF FUTA</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
                            Redeemed Christian Fellowship FUTA Chapter
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                            <Link href="/" className="hover:text-rcf-navy hover:underline transition-colors">Home</Link>
                            <Link href="/events" className="hover:text-rcf-navy hover:underline transition-colors">Events</Link>
                            <Link href="/dashboard" className="hover:text-rcf-navy hover:underline transition-colors">Dashboard</Link>
                        </div>
                        <p className="text-[10px] text-slate-300 mt-3">
                            Powered by RCFFUTA ICT Team
                        </p>
                    </div>
                </aside>
            </div>

            {/* ─── Mobile Bottom Footer ─── */}
            <footer className="xl:hidden border-t border-slate-200 bg-white mt-4">
                <div className="max-w-lg mx-auto px-4 py-6 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Logo width={28} />
                        <span className="text-sm font-bold text-slate-900">RCF FUTA</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3">
                        Redeemed Christian Fellowship FUTA Chapter
                    </p>
                    <div className="flex justify-center gap-4 text-xs text-slate-500">
                        <Link href="/" className="hover:text-rcf-navy transition-colors">Home</Link>
                        <Link href="/events" className="hover:text-rcf-navy transition-colors">Events</Link>
                        <Link href="/dashboard" className="hover:text-rcf-navy transition-colors">Dashboard</Link>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-3">Powered by RCFFUTA ICT Team</p>
                </div>
            </footer>
        </div>
    );
}
