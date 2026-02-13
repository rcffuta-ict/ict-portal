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
    X,
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
    onCluster: (ids: string[]) => void;
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
    onCluster,
}: AdminPanelProps) {
    const [filter, setFilter] = useState<AdminFilter>("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedEvent, setSelectedEvent] = useState<LoEvent | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    const stats = useMemo(() => ({
        total: questions.length,
        visible: questions.filter((q) => q.status === "visible").length,
        answered: questions.filter((q) => q.status === "answered").length,
        hidden: questions.filter((q) => q.status === "hidden").length,
        flagged: questions.filter((q) => q.status === "flagged").length,
    }), [questions]);

    // Handle input change to detect hashtags
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;

        // Check if user is typing a hashtag event
        const match = value.match(/#(\S+)/);
        if (match) {
            const tag = match[1].toLowerCase();
            const foundEvent = events.find(e =>
                e.slug.toLowerCase() === tag ||
                e.title.toLowerCase().replace(/\s+/g, '-').toLowerCase() === tag
            );

            if (foundEvent) {
                setSelectedEvent(foundEvent);
                setSearchTerm(value.replace(match[0], "").trim());
                return;
            }
        }

        setSearchTerm(value);
    };

    const filteredQuestions = useMemo(() => {
        let result = questions;

        // 1. Status Filter
        if (filter !== "all") {
            result = result.filter((q) => q.status === filter);
        }

        // 2. Event Filter (Selected Event)
        if (selectedEvent) {
            result = result.filter((q) => q.event_id === selectedEvent.id);
        }

        // 3. Text Search
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
    }, [questions, filter, searchTerm, selectedEvent, starCounts]);

    const handleEventTagClick = (event: LoEvent) => {
        if (selectedEvent?.id === event.id) {
            setSelectedEvent(null);
        } else {
            setSelectedEvent(event);
        }
        // Focus search input after clicking? Optional.
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleClusterClick = () => {
        onCluster(Array.from(selectedIds));
        setSelectedIds(new Set());
        setIsSelectionMode(false);
    };

    const filters: { id: AdminFilter; label: string; count: number; icon: any; color: string }[] = [
        { id: "all", label: "All", count: stats.total, icon: BarChart3, color: "text-slate-600" },
        { id: "visible", label: "Pending", count: stats.visible, icon: Clock, color: "text-amber-600" },
        { id: "answered", label: "Answered", count: stats.answered, icon: CheckCircle2, color: "text-green-600" },
        { id: "hidden", label: "Hidden", count: stats.hidden, icon: EyeOff, color: "text-slate-500" },
        { id: "flagged", label: "Flagged", count: stats.flagged, icon: AlertTriangle, color: "text-red-600" },
    ];


    return (
        <div className="relative">
            {/* Admin Header */}
            <div className="sticky top-14 z-20 bg-white border-b border-slate-200">
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-rcf-navy" />
                            <h2 className="text-lg font-extrabold text-slate-900">Admin Panel</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Selection Toggle */}
                            <button
                                onClick={() => {
                                    setIsSelectionMode(!isSelectionMode);
                                    setSelectedIds(new Set());
                                }}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors border ${
                                    isSelectionMode
                                        ? "bg-slate-900 text-white border-slate-900"
                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                }`}
                            >
                                {isSelectionMode ? "Cancel Selection" : "Select Questions"}
                            </button>

                            <button
                                onClick={onRefresh}
                                disabled={loading}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rcf-navy bg-rcf-navy/10 rounded-full hover:bg-rcf-navy/20 transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                                Refresh
                            </button>
                        </div>
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

                    {/* Search with Embedded Tag */}
                    <div className="relative mb-3 group">
                        <div className={`flex items-center w-full rounded-full border transition-all overflow-hidden bg-slate-100 border-transparent focus-within:bg-white focus-within:border-rcf-navy focus-within:ring-1 focus-within:ring-rcf-navy/20 ${selectedEvent ? 'pl-2' : 'pl-3'}`}>

                            {/* Icon (only if no tag selected, or maybe always?) */}
                            {!selectedEvent && (
                                <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                            )}

                            {/* Selected Event Tag Badge */}
                            {selectedEvent && (
                                <div className="flex items-center gap-1 pl-2 pr-1.5 py-1 bg-rcf-navy text-white rounded-full text-xs font-bold whitespace-nowrap mr-2 select-none">
                                    <span>#{selectedEvent.slug}</span>
                                    <button
                                        onClick={() => setSelectedEvent(null)}
                                        className="p-0.5 hover:bg-white/20 rounded-full focus:outline-none"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            )}

                            <input
                                type="text"
                                placeholder={selectedEvent ? "Search within this event..." : "Search questions (use # for events)..."}
                                value={searchTerm}
                                onChange={handleSearchChange}
                                onKeyDown={(e) => {
                                    if (e.key === 'Backspace' && !searchTerm && selectedEvent) {
                                        setSelectedEvent(null);
                                    }
                                }}
                                className="flex-1 py-2 pr-4 bg-transparent border-none outline-none text-sm text-slate-900 placeholder:text-slate-500 min-w-12.5"
                            />
                        </div>
                    </div>

                    {/* Event Chips */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {events.map((e) => {
                            const isSelected = selectedEvent?.id === e.id;
                            return (
                                <button
                                    key={e.id}
                                    onClick={() => handleEventTagClick(e)}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                                        isSelected
                                            ? "bg-rcf-navy text-white border-rcf-navy shadow-sm"
                                            : "bg-white text-slate-600 border-slate-200 hover:border-rcf-navy/30 hover:bg-slate-50"
                                    }`}
                                >
                                    #{e.slug}
                                </button>
                            );
                        })}
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

                 {/* Selection Floating Action Bar */}
                 {selectedIds.size > 0 && (
                    <div className="absolute -bottom-12.5 left-0 right-0 z-30 flex justify-center sticky-action-bar-shim">
                         {/* We actually want this fixed relative to viewport or absolute here?
                             Since this component is inside a scrolling container usually, fixed might be better.
                             But 'fixed bottom-6' works best globally.
                             However, AdminPanel is inside a layout. Let's try fixed bottom-20 (above tabs).
                         */}
                    </div>
                )}
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
                <div className="pb-20">
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
                            selectable={isSelectionMode}
                            selected={selectedIds.has(question.id)}
                            onSelect={() => toggleSelection(question.id)}
                        />
                    ))}
                </div>
            )}

             {/* Floating Cluster Button */}
             {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in">
                    <button
                        onClick={handleClusterClick}
                        className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-full shadow-lg shadow-slate-900/20 hover:scale-105 active:scale-95 transition-all font-bold"
                    >
                         <BarChart3 className="w-4 h-4" /> {/* Or a cluster icon */}
                         Cluster {selectedIds.size} Questions
                    </button>
                </div>
            )}
        </div>
    );
}
