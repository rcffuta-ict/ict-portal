
"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle, BookOpen, MoreVertical, Flag, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
// Actually I don't see dropdown-menu in the list from `src/components/ui` earlier.
// I'll check if it's available or if I should build a simple one or use a library one.
// The package.json has framer-motion, maybe I can use that for a nice reveal.
// For now, I'll stick to standard UI elements I can find or build simple ones.
// Given the user wants "cool", I should try to use what's there or make it nice.

interface Question {
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
}

interface QuestionItemProps {
    question: Question;
    isAdmin: boolean;
    onAnswer?: (id: string, text: string) => Promise<void>;
    onToggleVisibility?: (id: string, status: 'visible' | 'hidden') => Promise<void>;
    onFlag?: (id: string) => Promise<void>;
}

export function QuestionItem({ question, isAdmin, onAnswer, onToggleVisibility, onFlag }: QuestionItemProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [answerText, setAnswerText] = useState("");
    const [isAnswering, setIsAnswering] = useState(false);

    const handleSubmitAnswer = async () => {
        if (!onAnswer || !answerText.trim()) return;
        await onAnswer(question.id, answerText);
        setIsAnswering(false);
        setAnswerText("");
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group">
            <div className="p-5">
                <div className="flex justify-between items-start gap-4 mb-3">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 text-xs font-bold">
                                {question.asker_name ? question.asker_name.charAt(0).toUpperCase() : "?"}
                            </span>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-900">
                                    {question.asker_name || "Anonymous"}
                                </span>
                                <span className="text-xs text-slate-500">
                                    {formatDistanceToNow(new Date(question.created_at), { addSuffix: true })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {question.scripture_reference && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />
                            {question.scripture_reference}
                        </Badge>
                    )}
                </div>

                <h3 className="text-slate-800 text-lg font-medium leading-relaxed mb-4">
                    {question.question_text}
                </h3>

                {question.answer_text && (
                    <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-100 relative">
                        <div className="absolute top-4 left-4">
                            <MessageCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="pl-8">
                            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {question.answer_text}
                            </p>
                            <div className="mt-2 text-xs text-green-700 font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Answered by {question.answer_author_name || "Admin"}
                            </div>
                        </div>
                    </div>
                )}

                {/* Admin Controls */}
                {isAdmin && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => setIsAnswering(!isAnswering)}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                            {question.answer_text ? "Edit Answer" : "Answer"}
                        </button>

                        <button
                            onClick={() => onToggleVisibility?.(question.id, question.status === 'hidden' ? 'visible' : 'hidden')}
                            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                                question.status === 'hidden'
                                ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                : "bg-red-50 text-red-600 hover:bg-red-100"
                            }`}
                        >
                            {question.status === 'hidden' ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            {question.status === 'hidden' ? "Show" : "Hide"}
                        </button>
                    </div>
                )}

                {/* Answer Input for Admin */}
                {isAnswering && isAdmin && (
                    <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                        <textarea
                            value={answerText}
                            onChange={(e) => setAnswerText(e.target.value)}
                            placeholder="Write your answer..."
                            className="w-full p-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-hidden min-h-[100px] text-sm mb-2"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setIsAnswering(false)}
                                className="text-xs px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitAnswer}
                                className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium"
                            >
                                Post Answer
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
