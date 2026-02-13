"use client";

import { useState } from "react";
import {
    Shield,
    MessageCircle,
    Eye,
    EyeOff,
    CheckCircle2,
    Clock,
    Flag,
    RefreshCw,
    Search,
    BarChart3,
    AlertTriangle,
    HelpCircle,
} from "lucide-react";
import { type Question } from "./QAPageClient";
import { QuestionCard } from "./QuestionCard";

type AdminFilter = "all" | "visible" | "answered" | "hidden" | "flagged";

interface AdminPanelProps {
    questions: Question[];
    onAnswer: (id: string, text: string) => Promise<void>;
    onToggleVisibility: (id: string, status: "visible" | "hidden") => Promise<void>;
    onRefresh: () => void;
    loading: boolean;
}

export function AdminPanel({
    questions,
    onAnswer,
    onToggleVisibility,
    onRefresh,
    loading,
}: AdminPanelProps) {
    const [filter, setFilter] = useState<AdminFilter>("all");
    const [searchTerm, setSearchTerm] = useState("");

    // Stats
    const stats = {
        total: questions.length,
        visible: questions.filter((q) => q.status === "visible").length,
        answered: questions.filter((q) => q.status === "answered").length,
        hidden: questions.filter((q) => q.status === "hidden").length,
        flagged: questions.filter((q) => q.status === "flagged").length,
    };

    // Filter questions
    const filteredQuestions = questions.filter((q) => {
        const matchesFilter = filter === "all" || q.status === filter;
        const matchesSearch =
            !searchTerm ||
            q.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
            q.asker_name?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const filterTabs: {
        id: AdminFilter;
        label: string;
        count: number;
    }[] = [
        { id: "all", label: "All", count: stats.total },
        { id: "visible", label: "Pending", count: stats.visible },
        { id: "answered", label: "Answered", count: stats.answered },
        { id: "hidden", label: "Hidden", count: stats.hidden },
        { id: "flagged", label: "Flagged", count: stats.flagged },
    ];

    return (
        <div>
            {/* Header */}
            <div className="sticky top-14 z-20 bg-white/95 backdrop-blur-xl border-b border-slate-200/80">
                <div className="px-4 pt-3 pb-0">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-rcf-navy" />
                            <h2 className="text-xl font-extrabold text-slate-900">Admin Panel</h2>
                        </div>
                        <button
                            onClick={onRefresh}
                            disabled={loading}
                            className="p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-all disabled:opacity-50"
                        >
                            <RefreshCw
                                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                            />
                        </button>
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="px-4 pb-3">
                    <div className="grid grid-cols-4 gap-2">
                        <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                            <p className="text-lg font-extrabold text-slate-900">{stats.total}</p>
                            <p className="text-[10px] text-slate-500 font-medium">Total</p>
                        </div>
                        <div className="bg-blue-50 rounded-xl p-2.5 text-center">
                            <p className="text-lg font-extrabold text-blue-600">{stats.visible}</p>
                            <p className="text-[10px] text-blue-600 font-medium">Pending</p>
                        </div>
                        <div className="bg-green-50 rounded-xl p-2.5 text-center">
                            <p className="text-lg font-extrabold text-green-600">{stats.answered}</p>
                            <p className="text-[10px] text-green-600 font-medium">Answered</p>
                        </div>
                        <div className="bg-red-50 rounded-xl p-2.5 text-center">
                            <p className="text-lg font-extrabold text-red-600">{stats.flagged + stats.hidden}</p>
                            <p className="text-[10px] text-red-600 font-medium">Attention</p>
                        </div>
                    </div>
                </div>

                {/* Search */}
                <div className="px-4 pb-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search questions or names..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-slate-100 border border-transparent focus:bg-white focus:border-rcf-navy focus:ring-1 focus:ring-rcf-navy/20 outline-none text-sm text-slate-900 placeholder:text-slate-500 transition-all"
                        />
                    </div>
                </div>

                {/* Filter Tabs */}
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
                            {tab.count > 0 && (
                                <span className={`ml-1 text-xs ${
                                    filter === tab.id ? "text-rcf-navy" : "text-slate-400"
                                }`}>
                                    {tab.count}
                                </span>
                            )}
                            {filter === tab.id && (
                                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-[3px] bg-rcf-navy rounded-full" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Questions */}
            {filteredQuestions.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center px-4">
                    <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                        <HelpCircle className="w-7 h-7 text-slate-300" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mb-1">
                        No questions found
                    </h3>
                    <p className="text-sm text-slate-500">
                        {searchTerm
                            ? `No matches for "${searchTerm}"`
                            : `No ${filter !== "all" ? filter : ""} questions`}
                    </p>
                </div>
            ) : (
                <div>
                    {filteredQuestions.map((question) => (
                        <QuestionCard
                            key={question.id}
                            question={question}
                            isAdmin={true}
                            onAnswer={onAnswer}
                            onToggleVisibility={onToggleVisibility}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
