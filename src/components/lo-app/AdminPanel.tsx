"use client";

import { useState, useMemo } from "react";
import {
    Shield,
    Search,
    RefreshCw,
    MessageSquare,
    CheckCircle2,
    Clock,
    EyeOff,
    AlertTriangle,
    BarChart3,
} from "lucide-react";
import { QuestionCard } from "./QuestionCard";
import type { Question, LoEvent } from "./LoAppClient";

interface AdminPanelProps {
    questions: Question[];
    onAnswer: (id: string, text: string) => void;
    onToggleVisibility: (id: string, status: "visible" | "hidden") => void;
    onRefresh: () => void;
    loading: boolean;
    starCounts: Record<string, number>;
    userStars: string[];
    onToggleStar: (id: string) => void;
    events: LoEvent[];
}

type AdminFilter = "all" | "visible" | "answered" | "hidden" | "flagged";

export function AdminPanel({
    questions,
    onAnswer,
    onToggleVisibility,
    onRefresh,
    loading,
    starCounts,
    userStars,
    onToggleStar,
    events,
}: AdminPanelProps) {
    const [filter, setFilter] = useState<AdminFilter>("all");
    const [searchTerm, setSearchTerm] = useState("");

    const stats = useMemo(() => ({
        total: questions.length,
        visible: questions.filter((q) => q.status === "visible").length,
        answered: questions.filter((q) => q.status === "answered").length,
        hidden: questions.filter((q) => q.status === "hidden").length,
        flagged: questions.filter((q) => q.status === "flagged").length,
    }), [questions]);

    const filteredQuestions = useMemo(() => {
        let result = questions;
        if (filter !== "all") {
            result = result.filter((q) => q.status === filter);
        }
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(
                (q) =>
                    q.question_text.toLowerCase().includes(term) ||
                    q.asker_name?.toLowerCase().includes(term) ||
                    q.answer_text?.toLowerCase().includes(term)
            );
        }

        // Sort by star count (descending)
        result = [...result].sort((a, b) => {
            const starsA = starCounts[a.id] || 0;
            const starsB = starCounts[b.id] || 0;
            return starsB - starsA;
        });

        return result;
    }, [questions, filter, searchTerm, starCounts]);

    const filters: { id: AdminFilter; label: string; count: number; icon: any; color: string }[] = [
        { id: "all", label: "All", count: stats.total, icon: BarChart3, color: "text-slate-600" },
        { id: "visible", label: "Pending", count: stats.visible, icon: Clock, color: "text-amber-600" },
        { id: "answered", label: "Answered", count: stats.answered, icon: CheckCircle2, color: "text-green-600" },
        { id: "hidden", label: "Hidden", count: stats.hidden, icon: EyeOff, color: "text-slate-500" },
        { id: "flagged", label: "Flagged", count: stats.flagged, icon: AlertTriangle, color: "text-red-600" },
    ];

    return (
        <div>
            {/* Admin Header */}
            <div className="sticky top-14 z-20 bg-white border-b border-slate-200">
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-rcf-navy" />
                            <h2 className="text-lg font-extrabold text-slate-900">Admin Panel</h2>
                        </div>
                        <button
                            onClick={onRefresh}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rcf-navy bg-rcf-navy/10 rounded-full hover:bg-rcf-navy/20 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                            Refresh
                        </button>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                        <div className="bg-rcf-navy/5 rounded-xl p-2.5 text-center">
                            <p className="text-lg font-black text-rcf-navy">{stats.total}</p>
                            <p className="text-[10px] text-slate-500 font-medium">Total</p>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-2.5 text-center">
                            <p className="text-lg font-black text-amber-600">{stats.visible}</p>
                            <p className="text-[10px] text-slate-500 font-medium">Pending</p>
                        </div>
                        <div className="bg-green-50 rounded-xl p-2.5 text-center">
                            <p className="text-lg font-black text-green-600">{stats.answered}</p>
                            <p className="text-[10px] text-slate-500 font-medium">Answered</p>
                        </div>
                        <div className="bg-red-50 rounded-xl p-2.5 text-center">
                            <p className="text-lg font-black text-red-600">{stats.flagged}</p>
                            <p className="text-[10px] text-slate-500 font-medium">Flagged</p>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search all questions..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-full bg-slate-100 border border-transparent focus:bg-white focus:border-rcf-navy focus:ring-1 focus:ring-rcf-navy/20 outline-none text-sm text-slate-900 placeholder:text-slate-500 transition-all"
                        />
                    </div>

                    {/* Filter tabs */}
                    <div className="flex overflow-x-auto gap-1 no-scrollbar -mx-1 px-1">
                        {filters.map((f) => {
                            const Icon = f.icon;
                            return (
                                <button
                                    key={f.id}
                                    onClick={() => setFilter(f.id)}
                                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                                        filter === f.id
                                            ? "bg-rcf-navy text-white"
                                            : "text-slate-600 hover:bg-slate-100"
                                    }`}
                                >
                                    <Icon className={`w-3 h-3 ${filter === f.id ? "text-white" : f.color}`} />
                                    {f.label}
                                    <span className={`ml-0.5 ${filter === f.id ? "text-white/70" : "text-slate-400"}`}>
                                        {f.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Questions List */}
            {filteredQuestions.length === 0 ? (
                <div className="py-16 text-center">
                    <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">
                        {searchTerm
                            ? "No questions match your search"
                            : `No ${filter === "all" ? "" : filter} questions`}
                    </p>
                </div>
            ) : (
                <div>
                    {filteredQuestions.map((question, i) => (
                        <QuestionCard
                            key={question.id}
                            question={question}
                            isAdmin={true}
                            onAnswer={onAnswer}
                            onToggleVisibility={onToggleVisibility}
                            starCount={starCounts[question.id] || 0}
                            isStarred={userStars.includes(question.id)}
                            onToggleStar={onToggleStar}
                            isAuthenticated={true}
                            events={events}
                            index={i}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
