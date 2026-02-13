"use client";

import { useState, useCallback, useEffect } from "react";
import {
    Search,
    RefreshCw,
    AlertCircle,
    HelpCircle,
    Calendar,
} from "lucide-react";
import { LoLogo } from "./LoLogo";
import { LoAppHeader } from "./LoAppHeader";
import { LoAppSidebar } from "./LoAppSidebar";
import { LoAppRightSidebar } from "./LoAppRightSidebar";
import { LoAppMobileNav } from "./LoAppMobileNav";
import { LoAppInfoModal } from "./LoAppInfoModal";
import { AskQuestionForm } from "./AskQuestionForm";
import { QuestionFeed } from "./QuestionFeed";
import { AdminPanel } from "./AdminPanel";
import { EventCard } from "./EventCard";
import {
    getQuestions,
    answerQuestion,
    toggleVisibility,
    toggleStar,
    getStarCounts,
    getUserStars,
} from "@/app/lo-app/actions";

// ─── Exported Types ───

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
    event_title?: string;
    event_slug?: string;
    answer_author_name?: string;
    author_full_name?: string;
    answerer_full_name?: string;
}

export interface AuthUser {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    level: string;
}

export interface LoEvent {
    id: string;
    title: string;
    slug: string;
    description?: string | null;
    date?: string;
    is_active?: boolean;
    created_at?: string;
}

// ─── Props ───

interface LoAppClientProps {
    initialQuestions: Question[];
    events: LoEvent[];
    isAdmin: boolean;
    authenticatedUser: AuthUser | null;
    initialStarCounts: Record<string, number>;
    initialUserStars: string[];
}

type ViewTab = "feed" | "admin";
type FeedTab = "questions" | "events";
type FilterType = "all" | "answered" | "unanswered";

// ─── Main Component ───

export function LoAppClient({
    initialQuestions,
    events,
    isAdmin,
    authenticatedUser,
    initialStarCounts,
    initialUserStars,
}: LoAppClientProps) {
    // ── State ──
    const [activeTab, setActiveTab] = useState<ViewTab>("feed");
    const [feedTab, setFeedTab] = useState<FeedTab>("questions");
    const [questions, setQuestions] = useState<Question[]>(initialQuestions);
    const [filter, setFilter] = useState<FilterType>("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchFocused, setSearchFocused] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [starCounts, setStarCounts] =
        useState<Record<string, number>>(initialStarCounts);
    const [userStars, setUserStars] = useState<string[]>(initialUserStars);

    // ── Data Fetching ──
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
                const newQuestions = result.data || [];
                setQuestions(newQuestions);

                const ids = newQuestions.map((q: Question) => q.id);
                const [countsRes, userRes] = await Promise.all([
                    getStarCounts(ids),
                    getUserStars(ids),
                ]);
                if (countsRes.data) setStarCounts(countsRes.data);
                if (userRes.data) setUserStars(userRes.data);
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
        const timer = setTimeout(() => fetchQuestions(), 350);
        return () => clearTimeout(timer);
    }, [fetchQuestions]);

    // ── Handlers ──
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

    const handleToggleStar = async (questionId: string) => {
        if (!authenticatedUser) return;

        const wasStarred = userStars.includes(questionId);
        setUserStars((prev) =>
            wasStarred
                ? prev.filter((id) => id !== questionId)
                : [...prev, questionId]
        );
        setStarCounts((prev) => ({
            ...prev,
            [questionId]: (prev[questionId] || 0) + (wasStarred ? -1 : 1),
        }));

        const result = await toggleStar(questionId);
        if (!result.success) {
            setUserStars((prev) =>
                wasStarred
                    ? [...prev, questionId]
                    : prev.filter((id) => id !== questionId)
            );
            setStarCounts((prev) => ({
                ...prev,
                [questionId]:
                    (prev[questionId] || 0) + (wasStarred ? 1 : -1),
            }));
        }
    };

    // ── Computed Values ──
    const totalQuestions = questions.length;
    const answeredCount = questions.filter(
        (q) => q.status === "answered"
    ).length;
    const pendingCount = questions.filter(
        (q) => q.status === "visible"
    ).length;
    const activeEventsCount = events.filter((e) => e.is_active).length;

    const questionFilterTabs: {
        id: FilterType;
        label: string;
        count?: number;
    }[] = [
        { id: "all", label: "Latest" },
        { id: "answered", label: "Answered", count: answeredCount },
        { id: "unanswered", label: "Pending", count: pendingCount },
    ];

    const filteredEvents = events.filter((e) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            e.title.toLowerCase().includes(term) ||
            e.slug.toLowerCase().includes(term) ||
            e.description?.toLowerCase().includes(term)
        );
    });

    // ─── Render ───
    return (
        <div className="min-h-screen bg-[#f5f6f8]">
            {/* Header */}
            <LoAppHeader
                isAdmin={isAdmin}
                authenticatedUser={authenticatedUser}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                feedTab={feedTab}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                searchFocused={searchFocused}
                setSearchFocused={setSearchFocused}
                onOpenInfo={() => setShowInfo(true)}
            />

            {/* Three-Column Layout */}
            <div className="max-w-7xl mx-auto flex">
                {/* Left Sidebar */}
                <LoAppSidebar
                    isAdmin={isAdmin}
                    authenticatedUser={authenticatedUser}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    feedTab={feedTab}
                    setFeedTab={setFeedTab}
                    pendingCount={pendingCount}
                    activeEventsCount={activeEventsCount}
                    onOpenInfo={() => setShowInfo(true)}
                />

                {/* Main Feed */}
                <main className="flex-1 min-w-0 border-x border-slate-200/80 bg-white min-h-screen">
                    {activeTab === "feed" ? (
                        <FeedView
                            feedTab={feedTab}
                            setFeedTab={setFeedTab}
                            filter={filter}
                            setFilter={setFilter}
                            questionFilterTabs={questionFilterTabs}
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            questions={questions}
                            events={events}
                            filteredEvents={filteredEvents}
                            loading={loading}
                            error={error}
                            totalQuestions={totalQuestions}
                            isAdmin={isAdmin}
                            authenticatedUser={authenticatedUser}
                            starCounts={starCounts}
                            userStars={userStars}
                            onAnswer={handleAnswer}
                            onToggleVisibility={handleToggleVisibility}
                            onToggleStar={handleToggleStar}
                            onQuestionSubmitted={fetchQuestions}
                            onRetry={fetchQuestions}
                        />
                    ) : (
                        <AdminPanel
                            questions={questions}
                            onAnswer={handleAnswer}
                            onToggleVisibility={handleToggleVisibility}
                            onRefresh={fetchQuestions}
                            loading={loading}
                            starCounts={starCounts}
                            userStars={userStars}
                            onToggleStar={handleToggleStar}
                            events={events}
                        />
                    )}
                </main>

                {/* Right Sidebar */}
                <LoAppRightSidebar
                    events={events}
                    totalQuestions={totalQuestions}
                    answeredCount={answeredCount}
                    pendingCount={pendingCount}
                    setFeedTab={setFeedTab}
                    setActiveTab={setActiveTab}
                />
            </div>

            {/* Mobile Bottom Nav */}
            <LoAppMobileNav
                isAdmin={isAdmin}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                feedTab={feedTab}
                setFeedTab={setFeedTab}
            />

            {/* Info Modal */}
            <LoAppInfoModal
                open={showInfo}
                onClose={() => setShowInfo(false)}
            />
        </div>
    );
}

// ─── Feed View (inline, keeps LoAppClient focused on state) ───

interface FeedViewProps {
    feedTab: FeedTab;
    setFeedTab: (tab: FeedTab) => void;
    filter: FilterType;
    setFilter: (f: FilterType) => void;
    questionFilterTabs: { id: FilterType; label: string; count?: number }[];
    searchTerm: string;
    setSearchTerm: (v: string) => void;
    questions: Question[];
    events: LoEvent[];
    filteredEvents: LoEvent[];
    loading: boolean;
    error: string | null;
    totalQuestions: number;
    isAdmin: boolean;
    authenticatedUser: AuthUser | null;
    starCounts: Record<string, number>;
    userStars: string[];
    onAnswer: (id: string, text: string) => Promise<void>;
    onToggleVisibility: (id: string, status: "visible" | "hidden") => Promise<void>;
    onToggleStar: (questionId: string) => Promise<void>;
    onQuestionSubmitted: () => void;
    onRetry: () => void;
}

function FeedView({
    feedTab,
    setFeedTab,
    filter,
    setFilter,
    questionFilterTabs,
    searchTerm,
    setSearchTerm,
    questions,
    events,
    filteredEvents,
    loading,
    error,
    totalQuestions,
    isAdmin,
    authenticatedUser,
    starCounts,
    userStars,
    onAnswer,
    onToggleVisibility,
    onToggleStar,
    onQuestionSubmitted,
    onRetry,
}: FeedViewProps) {
    return (
        <>
            {/* Feed Header */}
            <div className="sticky top-14 z-20 bg-white/95 backdrop-blur-xl border-b border-slate-200/80">
                <div className="px-4 pt-3 pb-0">
                    <LoLogo size="md" variant="light" mode="full" />
                    <p className="text-xs text-slate-500 mb-3">
                        Behold — questions, answers &amp; fellowship events
                    </p>
                </div>

                {/* Feed Tabs */}
                <div className="flex">
                    <FeedTabButton
                        label="Questions"
                        count={totalQuestions}
                        active={feedTab === "questions"}
                        onClick={() => setFeedTab("questions")}
                    />
                    <FeedTabButton
                        label="Events"
                        count={events.length}
                        active={feedTab === "events"}
                        onClick={() => setFeedTab("events")}
                    />
                </div>
            </div>

            {feedTab === "questions" ? (
                <>
                    {/* Sub-filters */}
                    <div className="flex border-b border-slate-100 bg-slate-50/50">
                        {questionFilterTabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setFilter(tab.id)}
                                className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors ${
                                    filter === tab.id
                                        ? "text-rcf-navy bg-rcf-navy/5"
                                        : "text-slate-400 hover:text-slate-600"
                                }`}
                            >
                                {tab.label}
                                {tab.count !== undefined && tab.count > 0 && (
                                    <span
                                        className={`ml-1 ${
                                            filter === tab.id
                                                ? "text-rcf-gold"
                                                : "text-slate-400"
                                        }`}
                                    >
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Mobile Search */}
                    <MobileSearch
                        placeholder="Search questions..."
                        value={searchTerm}
                        onChange={setSearchTerm}
                    />

                    {/* Compose */}
                    <AskQuestionForm
                        events={events}
                        authenticatedUser={authenticatedUser}
                        onQuestionSubmitted={onQuestionSubmitted}
                    />

                    {/* Questions List */}
                    {loading && questions.length === 0 ? (
                        <LoadingState />
                    ) : error ? (
                        <ErrorState message={error} onRetry={onRetry} />
                    ) : questions.length === 0 ? (
                        <EmptyState
                            icon={
                                <HelpCircle className="w-8 h-8 text-rcf-navy/30" />
                            }
                            title={
                                searchTerm ? "No results" : "No questions yet"
                            }
                            description={
                                searchTerm
                                    ? `Nothing found for "${searchTerm}". Try a different search.`
                                    : "Be the first to ask! Your question could spark a great conversation."
                            }
                        />
                    ) : (
                        <QuestionFeed
                            questions={questions}
                            isAdmin={isAdmin}
                            onAnswer={onAnswer}
                            onToggleVisibility={onToggleVisibility}
                            starCounts={starCounts}
                            userStars={userStars}
                            onToggleStar={onToggleStar}
                            isAuthenticated={!!authenticatedUser}
                            events={events}
                        />
                    )}

                    {loading && questions.length > 0 && (
                        <div className="flex justify-center py-6">
                            <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                        </div>
                    )}
                </>
            ) : (
                <>
                    {/* Mobile Search */}
                    <MobileSearch
                        placeholder="Search events..."
                        value={searchTerm}
                        onChange={setSearchTerm}
                    />

                    {filteredEvents.length === 0 ? (
                        <EmptyState
                            icon={
                                <Calendar className="w-8 h-8 text-rcf-navy/30" />
                            }
                            title={
                                searchTerm
                                    ? "No events found"
                                    : "No events yet"
                            }
                            description={
                                searchTerm
                                    ? "Try a different search term."
                                    : "Events will appear here when they're created."
                            }
                        />
                    ) : (
                        <div>
                            {filteredEvents.map((event, i) => (
                                <EventCard
                                    key={event.id}
                                    event={event}
                                    index={i}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </>
    );
}

// ─── Shared UI Atoms ───

function FeedTabButton({
    label,
    count,
    active,
    onClick,
}: {
    label: string;
    count: number;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 py-3 text-sm font-semibold text-center relative transition-colors hover:bg-slate-50 ${
                active ? "text-rcf-navy" : "text-slate-400"
            }`}
        >
            {label}
            {count > 0 && (
                <span
                    className={`ml-1 text-xs ${
                        active ? "text-rcf-gold" : "text-slate-400"
                    }`}
                >
                    {count}
                </span>
            )}
            {active && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-0.5 bg-rcf-navy rounded-full" />
            )}
        </button>
    );
}

function MobileSearch({
    placeholder,
    value,
    onChange,
}: {
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="md:hidden px-4 py-3 border-b border-slate-100">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-full bg-slate-100 border border-transparent focus:bg-white focus:border-rcf-navy focus:ring-1 focus:ring-rcf-navy/20 outline-none text-sm text-slate-900 placeholder:text-slate-500 transition-all"
                />
            </div>
        </div>
    );
}

function LoadingState() {
    return (
        <div className="py-20 text-center flex flex-col items-center">
            <RefreshCw className="w-5 h-5 mb-3 animate-spin text-rcf-navy" />
            <p className="text-sm text-slate-500">Loading questions...</p>
        </div>
    );
}

function ErrorState({
    message,
    onRetry,
}: {
    message: string;
    onRetry: () => void;
}) {
    return (
        <div className="m-4 p-6 text-center text-red-600 flex flex-col items-center bg-red-50 rounded-2xl border border-red-100">
            <AlertCircle className="w-5 h-5 mb-2" />
            <p className="text-sm font-medium">{message}</p>
            <button
                onClick={onRetry}
                className="mt-3 text-xs text-red-600 hover:text-red-700 underline"
            >
                Try Again
            </button>
        </div>
    );
}

function EmptyState({
    icon,
    title,
    description,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
}) {
    return (
        <div className="py-20 text-center flex flex-col items-center px-4">
            <div className="w-16 h-16 bg-rcf-navy/5 rounded-full flex items-center justify-center mb-4">
                {icon}
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">{title}</h3>
            <p className="text-sm text-slate-500 max-w-sm">{description}</p>
        </div>
    );
}
