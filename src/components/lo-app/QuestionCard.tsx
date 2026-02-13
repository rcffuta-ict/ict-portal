"use client";

import { useState } from "react";
import Link from "next/link";
import {
    Star,
    MessageSquare,
    BookOpen,
    Eye,
    EyeOff,
    MoreHorizontal,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Shield,
    Hash,
    Send,
    Loader2,
    X,
} from "lucide-react";
import type { Question, LoEvent } from "./LoAppClient";

// ─── Scripture Highlight ───
const SCRIPTURE_PATTERN =
    /\b(Genesis|Gen|Exodus|Exod|Ex|Leviticus|Lev|Numbers|Num|Deuteronomy|Deut|Joshua|Josh|Judges|Judg|Ruth|1\s*Samuel|1\s*Sam|2\s*Samuel|2\s*Sam|1\s*Kings|2\s*Kings|1\s*Chronicles|1\s*Chr|2\s*Chronicles|2\s*Chr|Ezra|Nehemiah|Neh|Esther|Est|Job|Psalms?|Ps|Proverbs?|Prov|Ecclesiastes|Eccl|Song\s*of\s*Solomon|Song|Isaiah|Isa|Jeremiah|Jer|Lamentations|Lam|Ezekiel|Ezek|Daniel|Dan|Hosea|Joel|Amos|Obadiah|Obad|Jonah|Micah|Nahum|Habakkuk|Hab|Zephaniah|Zeph|Haggai|Hag|Zechariah|Zech|Malachi|Mal|Matthew|Matt|Mark|Luke|John|Acts|Romans|Rom|1\s*Corinthians|1\s*Cor|2\s*Corinthians|2\s*Cor|Galatians|Gal|Ephesians|Eph|Philippians|Phil|Colossians|Col|1\s*Thessalonians|1\s*Thess|2\s*Thessalonians|2\s*Thess|1\s*Timothy|1\s*Tim|2\s*Timothy|2\s*Tim|Titus|Philemon|Phlm|Hebrews|Heb|James|Jas|1\s*Peter|1\s*Pet|2\s*Peter|2\s*Pet|1\s*John|2\s*John|3\s*John|Jude|Revelation|Rev)\s+\d+(?::\d+)?(?:\s*[-–]\s*\d+)?/gi;

function highlightText(
    text: string,
    events: LoEvent[]
) {
    const parts: {
        type: "text" | "scripture" | "event-tag" | "event-tag-invalid";
        content: string;
        event?: LoEvent;
    }[] = [];
    let lastIndex = 0;

    const combined = new RegExp(
        `(${SCRIPTURE_PATTERN.source})|(#\\S+)`,
        "gi"
    );
    let match;

    while ((match = combined.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push({
                type: "text",
                content: text.slice(lastIndex, match.index),
            });
        }

        if (match[0].startsWith("#")) {
            const tag = match[0].slice(1).toLowerCase();
            const matchedEvent = events.find(
                (e) =>
                    e.slug.toLowerCase() === tag ||
                    e.title.toLowerCase().replace(/\s+/g, "-") === tag
            );
            parts.push({
                type: matchedEvent ? "event-tag" : "event-tag-invalid",
                content: match[0],
                event: matchedEvent,
            });
        } else {
            parts.push({ type: "scripture", content: match[0] });
        }

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        parts.push({ type: "text", content: text.slice(lastIndex) });
    }

    return parts;
}

interface QuestionCardProps {
    question: Question;
    isAdmin: boolean;
    onAnswer?: (id: string, text: string) => void;
    onToggleVisibility?: (id: string, status: "visible" | "hidden") => void;
    starCount: number;
    isStarred: boolean;
    onToggleStar: (id: string) => void;
    isAuthenticated: boolean;
    events: LoEvent[];
    index?: number;
    selectable?: boolean;
    selected?: boolean;
    onSelect?: () => void;
}

export function QuestionCard({
    question,
    isAdmin,
    onAnswer,
    onToggleVisibility,
    starCount,
    isStarred,
    onToggleStar,
    isAuthenticated,
    events,
    index = 0,
    selectable = false,
    selected = false,
    onSelect,
}: QuestionCardProps) {
    const [showAnswer, setShowAnswer] = useState(false);
    const [answerText, setAnswerText] = useState("");
    const [showMenu, setShowMenu] = useState(false);
    const [answering, setAnswering] = useState(false);
    const [showFullAnswer, setShowFullAnswer] = useState(false);

    const isAnswered =
        question.status === "answered" && question.answer_text;
    const isHidden = question.status === "hidden";
    const isFlagged = question.status === "flagged";

    const displayName =
        question.author_full_name ||
        question.asker_name ||
        "Anonymous";

    const nameInitials = displayName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase();

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "now";
        if (mins < 60) return `${mins}m`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d`;
        return new Date(dateStr).toLocaleDateString("en-NG", {
            month: "short",
            day: "numeric",
        });
    };

    const highlightedQuestion = highlightText(
        question.question_text,
        events
    );
    const highlightedAnswer = question.answer_text
        ? highlightText(question.answer_text, events)
        : [];

    const handleAnswer = async () => {
        if (!answerText.trim() || !onAnswer) return;
        setAnswering(true);
        await onAnswer(question.id, answerText.trim());
        setAnswerText("");
        setShowAnswer(false);
        setAnswering(false);
    };

    return (
        <article
            className={`border-b border-slate-200/60 hover:bg-slate-50/30 transition-colors ${
                isHidden ? "opacity-60" : ""
            }`}
            style={{ animationDelay: `${index * 40}ms` }}
        >
            <div className={`px-4 py-3.5 transition-colors ${selected ? 'bg-rcf-navy/5' : ''}`}>
                <div className="flex gap-3">
                    {/* Selection Checkbox */}
                    {selectable && (
                        <div className="shrink-0 pt-1">
                            <input
                                type="checkbox"
                                checked={selected}
                                onChange={onSelect}
                                className="w-4 h-4 rounded border-slate-300 text-rcf-navy focus:ring-rcf-navy/20 cursor-pointer"
                            />
                        </div>
                    )}

                    {/* Avatar */}
                    <div className="shrink-0">
                        <div className="w-10 h-10 rounded-full bg-linear-to-br from-rcf-navy to-rcf-navy-light text-white flex items-center justify-center text-xs font-bold relative">
                            {nameInitials || "?"}
                            {/* Answered indicator dot on avatar */}
                            {isAnswered && (
                                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center ring-2 ring-white">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-bold text-slate-900 truncate">
                                {displayName}
                            </span>
                            <span className="text-xs text-slate-400">
                                ·
                            </span>
                            <span className="text-xs text-slate-500">
                                {timeAgo(question.created_at)}
                            </span>

                            {/* Status pill — always show answered, show others for admin */}
                            {isAnswered && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white bg-green-500">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    answered
                                </span>
                            )}
                            {isAdmin && !isAnswered && (
                                <span
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white ${
                                        question.status === "visible"
                                            ? "bg-amber-500"
                                            : question.status === "hidden"
                                            ? "bg-slate-400"
                                            : question.status === "flagged"
                                            ? "bg-red-500"
                                            : "bg-slate-400"
                                    }`}
                                >
                                    {question.status === "visible" && (
                                        <Clock className="w-2.5 h-2.5" />
                                    )}
                                    {question.status === "hidden" && (
                                        <EyeOff className="w-2.5 h-2.5" />
                                    )}
                                    {question.status === "flagged" && (
                                        <AlertTriangle className="w-2.5 h-2.5" />
                                    )}
                                    {question.status}
                                </span>
                            )}

                            {/* Admin menu */}
                            {isAdmin && (
                                <div className="relative ml-auto">
                                    <button
                                        onClick={() =>
                                            setShowMenu(!showMenu)
                                        }
                                        className="p-1 rounded-full hover:bg-slate-200 transition-colors"
                                    >
                                        <MoreHorizontal className="w-4 h-4 text-slate-400" />
                                    </button>
                                    {showMenu && (
                                        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-30 overflow-hidden">
                                            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                                                <div className="flex items-center gap-1.5">
                                                    <Shield className="w-3 h-3 text-rcf-navy" />
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                        Admin Actions
                                                    </span>
                                                </div>
                                            </div>
                                            {!isAnswered && (
                                                <button
                                                    onClick={() => {
                                                        setShowAnswer(true);
                                                        setShowMenu(false);
                                                    }}
                                                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                                >
                                                    <MessageSquare className="w-4 h-4 text-green-600" />
                                                    Answer Question
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    onToggleVisibility?.(
                                                        question.id,
                                                        isHidden
                                                            ? "visible"
                                                            : "hidden"
                                                    );
                                                    setShowMenu(false);
                                                }}
                                                className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                            >
                                                {isHidden ? (
                                                    <>
                                                        <Eye className="w-4 h-4 text-blue-600" />
                                                        Make Visible
                                                    </>
                                                ) : (
                                                    <>
                                                        <EyeOff className="w-4 h-4 text-slate-500" />
                                                        Hide Question
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Question text with highlights */}
                        <div className="text-[15px] leading-relaxed text-slate-900 mb-2 break-words">
                            {highlightedQuestion.map((part, i) => {
                                if (part.type === "scripture") {
                                    return (
                                        <span
                                            key={i}
                                            className="text-indigo-600 font-semibold bg-indigo-50 px-1 rounded"
                                        >
                                            {part.content}
                                        </span>
                                    );
                                }
                                if (part.type === "event-tag") {
                                    return (
                                        <span
                                            key={i}
                                            className="text-rcf-navy font-semibold cursor-pointer hover:underline"
                                        >
                                            {part.content}
                                        </span>
                                    );
                                }
                                if (part.type === "event-tag-invalid") {
                                    return (
                                        <span
                                            key={i}
                                            className="text-slate-500"
                                        >
                                            {part.content}
                                        </span>
                                    );
                                }
                                return (
                                    <span key={i}>{part.content}</span>
                                );
                            })}
                        </div>

                        {/* Scripture reference badge */}
                        {question.scripture_reference && (
                            <div className="mb-2">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium">
                                    <BookOpen className="w-3 h-3" />
                                    {question.scripture_reference}
                                </span>
                            </div>
                        )}

                        {/* Event tag (moved to bottom) */}
                        {question.event_title && (
                            <div className="mb-2">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rcf-navy/10 text-rcf-navy">
                                    <Hash className="w-3 h-3" />
                                    {question.event_slug ||
                                        question.event_title}
                                </span>
                            </div>
                        )}

                        {/* Answer */}
                        {isAnswered && question.answer_text && (
                            <div className="mt-3 pl-3 border-l-2 border-green-400 bg-green-50/50 rounded-r-xl py-2.5 px-3">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center">
                                        <CheckCircle2 className="w-3 h-3 text-white" />
                                    </div>
                                    <span className="text-xs font-bold text-green-800">
                                        {question.answerer_full_name ||
                                            question.answer_author_name ||
                                            "Admin"}
                                    </span>
                                    {question.answered_at && (
                                        <span className="text-[10px] text-green-600">
                                            ·{" "}
                                            {timeAgo(question.answered_at)}
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm leading-relaxed text-green-900">
                                    {question.answer_text.length > 300 &&
                                    !showFullAnswer ? (
                                        <>
                                            {highlightText(
                                                question.answer_text.slice(
                                                    0,
                                                    300
                                                ),
                                                events
                                            ).map((part, i) => {
                                                if (
                                                    part.type ===
                                                    "scripture"
                                                ) {
                                                    return (
                                                        <span
                                                            key={i}
                                                            className="text-indigo-600 font-semibold bg-indigo-50/60 px-0.5 rounded"
                                                        >
                                                            {part.content}
                                                        </span>
                                                    );
                                                }
                                                return (
                                                    <span key={i}>
                                                        {part.content}
                                                    </span>
                                                );
                                            })}
                                            <span>...</span>
                                            <button
                                                onClick={() =>
                                                    setShowFullAnswer(true)
                                                }
                                                className="ml-1 text-green-700 font-semibold hover:underline text-xs"
                                            >
                                                Show more
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            {highlightedAnswer.map(
                                                (part, i) => {
                                                    if (
                                                        part.type ===
                                                        "scripture"
                                                    ) {
                                                        return (
                                                            <span
                                                                key={i}
                                                                className="text-indigo-600 font-semibold bg-indigo-50/60 px-0.5 rounded"
                                                            >
                                                                {
                                                                    part.content
                                                                }
                                                            </span>
                                                        );
                                                    }
                                                    return (
                                                        <span key={i}>
                                                            {part.content}
                                                        </span>
                                                    );
                                                }
                                            )}
                                            {question.answer_text.length >
                                                300 && (
                                                <button
                                                    onClick={() =>
                                                        setShowFullAnswer(
                                                            false
                                                        )
                                                    }
                                                    className="ml-1 text-green-700 font-semibold hover:underline text-xs"
                                                >
                                                    Show less
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Actions Bar — stars and reply count */}
                        <div className="flex items-center gap-4 mt-2.5 -ml-2">
                             {/* Star / Login Prompt */}
                            {isAuthenticated ? (
                                <button
                                    onClick={() => onToggleStar(question.id)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all group ${
                                        isStarred
                                            ? "text-rcf-gold"
                                            : "text-slate-400 hover:text-rcf-gold"
                                    } hover:bg-rcf-gold/10`}
                                    title={isStarred ? "Unstar" : "Star this question"}
                                >
                                    <Star
                                        className={`w-4 h-4 transition-transform ${
                                            isStarred
                                                ? "fill-rcf-gold scale-110"
                                                : "group-hover:scale-110"
                                        }`}
                                    />
                                    <span className="font-semibold">
                                        {starCount > 0 ? starCount : ""}
                                    </span>
                                </button>
                            ) : (
                                <Link
                                    href="/login"
                                    className="px-2 py-1 text-xs text-slate-400 hover:text-rcf-navy transition-colors font-medium"
                                >
                                    Login to star
                                </Link>
                            )}

                            {/* Answered indicator in action bar */}
                            {isAnswered && (
                                <span className="flex items-center gap-1 px-2 py-1 text-xs text-green-600">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span className="font-semibold">
                                        Answered
                                    </span>
                                </span>
                            )}
                        </div>

                        {/* Admin Answer Box */}
                        {showAnswer && isAdmin && (
                            <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden">
                                <div className="bg-rcf-navy/5 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <Shield className="w-3.5 h-3.5 text-rcf-navy" />
                                        <span className="text-xs font-bold text-rcf-navy">
                                            Write Answer
                                        </span>
                                    </div>
                                    <button
                                        onClick={() =>
                                            setShowAnswer(false)
                                        }
                                        className="p-1 rounded-full hover:bg-slate-200"
                                    >
                                        <X className="w-3 h-3 text-slate-400" />
                                    </button>
                                </div>
                                <div className="p-3">
                                    <textarea
                                        value={answerText}
                                        onChange={(e) =>
                                            setAnswerText(e.target.value)
                                        }
                                        placeholder="Type your answer..."
                                        className="w-full min-h-20 resize-none text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
                                        autoFocus
                                    />
                                    <div className="flex justify-end pt-2 border-t border-slate-100">
                                        <button
                                            onClick={handleAnswer}
                                            disabled={
                                                !answerText.trim() ||
                                                answering
                                            }
                                            className="flex items-center gap-1.5 px-4 py-2 bg-rcf-navy text-white rounded-full text-xs font-bold hover:bg-rcf-navy-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {answering ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                                <Send className="w-3 h-3" />
                                            )}
                                            Submit Answer
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </article>
    );
}
