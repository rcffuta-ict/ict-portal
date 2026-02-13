"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Filter, RefreshCw, AlertCircle } from "lucide-react";
import { QuestionItem } from "./QuestionItem";
import { getQuestions, answerQuestion, toggleVisibility } from "@/app/qa/actions";

export interface Question {
    id: string;
    question_text: string;
    scripture_reference?: string;
    asker_name?: string;
    answer_text?: string;
    answered_at?: string;
    created_at: string;
    status: 'visible' | 'hidden' | 'answered' | 'flagged';
    event_id: string;
    answer_author_name?: string;
    // Add other fields from DB if needed
}

interface QuestionListProps {
    initialQuestions: Question[];
    isAdmin: boolean;
}

type FilterType = 'all' | 'answered' | 'flagged' | 'hidden';

export function QuestionList({ initialQuestions, isAdmin }: QuestionListProps) {
    const [questions, setQuestions] = useState<Question[]>(initialQuestions);
    const [filter, setFilter] = useState<FilterType>('all');
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchQuestions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const options: any = {
                search_term: searchTerm || undefined,
            };

            const statusFilters: string[] = [];

            if (isAdmin) {
                 if (filter === 'hidden') statusFilters.push('hidden');
                 else if (filter === 'flagged') statusFilters.push('flagged');
                 else if (filter === 'answered') statusFilters.push('answered');
                 else {
                     statusFilters.push('visible', 'answered', 'flagged', 'hidden');
                 }
            } else {
                 statusFilters.push('visible', 'answered');
            }

            if (statusFilters.length > 0) {
                options.status = statusFilters;
            }

            const result = await getQuestions(options);

            if (result.success) {

                if (!result.data) {
                    console.error("No Data", result.data);
                }


                setQuestions(result.data || []);
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError("Failed to load questions");
        } finally {
            setLoading(false);
        }
    }, [filter, searchTerm, isAdmin]);

    useEffect(() => {
        const timer = setTimeout(() => {
            // Only refetch if search changed or filter changed from initial
            // Actually, we want to allow refetching.
            // Avoid refetching on mount if initialQuestions present matching default state?
            // But search/filter state changes so...
            // Let's just debounce fetch.
            fetchQuestions();
        }, 300);
        return () => clearTimeout(timer);
    }, [fetchQuestions]);

    const handleAnswer = async (id: string, text: string) => {
        const result = await answerQuestion(id, text);
        if (result.success) {
            setQuestions(prev => prev.map(q =>
                q.id === id ? { ...q, answer_text: text, status: 'answered', answered_at: new Date().toISOString() } : q
            ));
        } else {
            alert("Failed to answer: " + result.error);
        }
    };

    const handleToggleVisibility = async (id: string, status: 'visible' | 'hidden') => {
        const result = await toggleVisibility(id, status);
        if (result.success) {
             setQuestions(prev => prev.map(q =>
                q.id === id ? { ...q, status: status } : q
            ));
        } else {
             alert("Failed to update status: " + result.error);
        }
    };

    const handleFlag = async (id: string) => {
        // Implement flag logic
    };

    // Filter tabs for Admin
    const tabs: {id: FilterType, label: string}[] = [
        { id: 'all', label: 'All Questions' },
        { id: 'answered', label: 'Answered' },
    ];

    if (isAdmin) {
        tabs.push({ id: 'flagged', label: 'Flagged' });
        tabs.push({ id: 'hidden', label: 'Hidden' });
    }

    return (
        <div className="space-y-6">
            {/* Filters and Search */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 no-scrollbar">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setFilter(tab.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                                filter === tab.id
                                ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                                : "text-slate-600 hover:bg-slate-100"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search questions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-hidden text-sm"
                    />
                </div>
            </div>

            {/* Questions List */}
            <div className="space-y-4">
                {loading && questions.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 flex flex-col items-center">
                        <RefreshCw className="w-8 h-8 mb-2 animate-spin text-blue-500" />
                        <p>Loading questions...</p>
                    </div>
                ) : error ? (
                    <div className="py-12 text-center text-red-500 flex flex-col items-center bg-red-50 rounded-xl">
                        <AlertCircle className="w-8 h-8 mb-2" />
                        <p>{error}</p>
                        <button onClick={() => fetchQuestions()} className="mt-4 text-sm underline">Try Again</button>
                    </div>
                ) : questions.length === 0 ? (
                    <div className="py-16 text-center text-slate-500 flex flex-col items-center bg-white rounded-2xl border border-dashed border-slate-300">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <Filter className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 mb-1">No questions found</h3>
                        <p className="max-w-72 text-sm">
                            {searchTerm
                             ? `No matches for "${searchTerm}"`
                             : "Be the first to ask a question!"}
                        </p>
                    </div>
                ) : (
                    questions.map(q => (
                        <QuestionItem
                            key={q.id}
                            question={q}
                            isAdmin={isAdmin}
                            onAnswer={handleAnswer}
                            onToggleVisibility={handleToggleVisibility}
                        />
                    ))
                )}
            </div>

            {loading && questions.length > 0 && (
                 <div className="flex justify-center py-4">
                     <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
                 </div>
            )}
        </div>
    );
}
