"use client";

import { useState, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import {
    MessageCircle,
    BookOpen,
    Eye,
    EyeOff,
    CheckCircle2,
    Flag,
    MoreHorizontal,
    Send,
    Clock,
    Ghost,
    Share2,
} from "lucide-react";
import { type Question } from "./QAPageClient";

// Scripture highlighting regex
const SCRIPTURE_REGEX =
    /\b(Genesis|Gen|Exodus|Exod|Ex|Leviticus|Lev|Numbers|Num|Deuteronomy|Deut|Joshua|Josh|Judges|Judg|Ruth|1\s*Samuel|1\s*Sam|2\s*Samuel|2\s*Sam|1\s*Kings|1\s*Kgs|2\s*Kings|2\s*Kgs|1\s*Chronicles|1\s*Chr|2\s*Chronicles|2\s*Chr|Ezra|Nehemiah|Neh|Esther|Est|Job|Psalms?|Ps|Proverbs|Prov|Ecclesiastes|Eccl|Song\s*of\s*Solomon|Songs?|Isaiah|Isa|Jeremiah|Jer|Lamentations|Lam|Ezekiel|Ezek|Daniel|Dan|Hosea|Hos|Joel|Amos|Obadiah|Obad|Jonah|Micah|Mic|Nahum|Nah|Habakkuk|Hab|Zephaniah|Zeph|Haggai|Hag|Zechariah|Zech|Malachi|Mal|Matthew|Matt|Mark|Luke|John|Jn|Acts|Romans|Rom|1\s*Corinthians|1\s*Cor|2\s*Corinthians|2\s*Cor|Galatians|Gal|Ephesians|Eph|Philippians|Phil|Colossians|Col|1\s*Thessalonians|1\s*Thess|2\s*Thessalonians|2\s*Thess|1\s*Timothy|1\s*Tim|2\s*Timothy|2\s*Tim|Titus|Philemon|Phlm|Hebrews|Heb|James|Jas|1\s*Peter|1\s*Pet|2\s*Peter|2\s*Pet|1\s*John|1\s*Jn|2\s*John|2\s*Jn|3\s*John|3\s*Jn|Jude|Revelation|Rev)\s*\d+(?:\s*:\s*\d+)?(?:\s*[-–]\s*\d+)?/gi;

function highlightScripture(text: string): string {
    return text.replace(
        SCRIPTURE_REGEX,
        '<span class="text-rcf-navy font-semibold hover:underline cursor-pointer">$&</span>'
    );
}

// Deterministic avatar color from name
function getAvatarGradient(name: string): string {
    const gradients = [
        "from-violet-500 to-purple-600",
        "from-blue-500 to-indigo-600",
        "from-emerald-500 to-teal-600",
        "from-orange-500 to-red-500",
        "from-pink-500 to-rose-600",
        "from-cyan-500 to-blue-600",
        "from-amber-500 to-orange-600",
        "from-fuchsia-500 to-pink-600",
    ];
    const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return gradients[hash % gradients.length];
}

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}

interface QuestionCardProps {
    question: Question;
    isAdmin: boolean;
    onAnswer: (id: string, text: string) => Promise<void>;
    onToggleVisibility: (
        id: string,
        status: "visible" | "hidden"
    ) => Promise<void>;
    animationDelay?: number;
}

export function QuestionCard({
    question,
    isAdmin,
    onAnswer,
    onToggleVisibility,
    animationDelay = 0,
}: QuestionCardProps) {
    const [isAnswering, setIsAnswering] = useState(false);
    const [answerText, setAnswerText] = useState(question.answer_text || "");
    const [showMenu, setShowMenu] = useState(false);

    const isAnonymous =
        !question.asker_name || question.asker_name === "Anonymous";
    const isAnswered = question.status === "answered" && question.answer_text;
    const isHidden = question.status === "hidden";
    const isFlagged = question.status === "flagged";

    const displayName = isAnonymous ? "Anonymous" : question.asker_name!;

    const highlightedQuestionText = useMemo(
        () => highlightScripture(question.question_text),
        [question.question_text]
    );

    const highlightedAnswerText = useMemo(
        () =>
            question.answer_text
                ? highlightScripture(question.answer_text)
                : "",
        [question.answer_text]
    );

    const handleSubmitAnswer = async () => {
        if (!answerText.trim()) return;
        await onAnswer(question.id, answerText);
        setIsAnswering(false);
    };

    const timeAgo = formatDistanceToNow(new Date(question.created_at), {
        addSuffix: false,
    });
    // Shorten "about X hours" to "Xh", etc.
    const shortTime = timeAgo
        .replace("about ", "")
        .replace(" seconds", "s")
        .replace(" second", "s")
        .replace(" minutes", "m")
        .replace(" minute", "m")
        .replace(" hours", "h")
        .replace(" hour", "h")
        .replace(" days", "d")
        .replace(" day", "d")
        .replace(" months", "mo")
        .replace(" month", "mo")
        .replace(" years", "y")
        .replace(" year", "y")
        .replace("less than a", "<1");

    return (
        <article
            className={`px-4 py-3 border-b border-slate-200/80 hover:bg-slate-50/50 transition-colors cursor-default ${
                isHidden ? "opacity-50" : ""
            }`}
            style={{ animationDelay: `${animationDelay}ms` }}
        >
            <div className="flex gap-3">
                {/* Avatar */}
                <div className="shrink-0">
                    {isAnonymous ? (
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                            <Ghost className="w-5 h-5 text-slate-500" />
                        </div>
                    ) : (
                        <div
                            className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarGradient(displayName)} text-white flex items-center justify-center text-xs font-bold`}
                        >
                            {getInitials(displayName)}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                            <span className="font-bold text-[15px] text-slate-900 truncate">
                                {displayName}
                            </span>
                            {!isAnonymous && (
                                <span className="text-slate-500 text-sm truncate">
                                    @{displayName.toLowerCase().replace(/\s+/g, "")}
                                </span>
                            )}
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-500 text-sm whitespace-nowrap">
                                {shortTime}
                            </span>
                            {isHidden && isAdmin && (
                                <span className="text-[10px] font-semibold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">
                                    Hidden
                                </span>
                            )}
                            {isFlagged && isAdmin && (
                                <span className="text-[10px] font-semibold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                    <Flag className="w-2.5 h-2.5" />
                                    Flagged
                                </span>
                            )}
                        </div>

                        {/* Menu */}
                        {isAdmin && (
                            <div className="relative shrink-0">
                                <button
                                    onClick={() => setShowMenu(!showMenu)}
                                    className="p-1.5 -m-1.5 rounded-full text-slate-400 hover:text-rcf-navy hover:bg-rcf-navy/5 transition-all"
                                >
                                    <MoreHorizontal className="w-4 h-4" />
                                </button>

                                {showMenu && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-10"
                                            onClick={() => setShowMenu(false)}
                                        />
                                        <div className="absolute right-0 top-7 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-20 w-48 animate-in fade-in zoom-in-95 duration-150">
                                            <button
                                                onClick={() => {
                                                    setIsAnswering(!isAnswering);
                                                    setShowMenu(false);
                                                }}
                                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-2.5 text-slate-700"
                                            >
                                                <MessageCircle className="w-4 h-4" />
                                                {question.answer_text
                                                    ? "Edit Answer"
                                                    : "Write Answer"}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    onToggleVisibility(
                                                        question.id,
                                                        isHidden ? "visible" : "hidden"
                                                    );
                                                    setShowMenu(false);
                                                }}
                                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-2.5 text-slate-700"
                                            >
                                                {isHidden ? (
                                                    <>
                                                        <Eye className="w-4 h-4" />
                                                        Make Visible
                                                    </>
                                                ) : (
                                                    <>
                                                        <EyeOff className="w-4 h-4" />
                                                        Hide Question
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Question Text */}
                    <div
                        className="text-[15px] text-slate-900 leading-relaxed mt-0.5 whitespace-pre-wrap break-words"
                        dangerouslySetInnerHTML={{
                            __html: highlightedQuestionText,
                        }}
                    />

                    {/* Scripture ref badge */}
                    {question.scripture_reference && (
                        <div className="mt-2">
                            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg text-xs font-medium border border-amber-200/60">
                                <BookOpen className="w-3 h-3" />
                                {question.scripture_reference}
                            </span>
                        </div>
                    )}

                    {/* Answer Block */}
                    {isAnswered && (
                        <div className="mt-3 rounded-xl border border-green-200/70 overflow-hidden">
                            {/* Answer header */}
                            <div className="bg-green-50 px-3 py-2 flex items-center gap-2 border-b border-green-200/50">
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                <span className="text-[12px] font-bold text-green-700">
                                    Answer
                                </span>
                                {question.answer_author_name && (
                                    <span className="text-[12px] text-green-600">
                                        by {question.answer_author_name}
                                    </span>
                                )}
                                {question.answered_at && (
                                    <>
                                        <span className="text-green-400">·</span>
                                        <span className="text-[11px] text-green-500">
                                            {formatDistanceToNow(
                                                new Date(question.answered_at),
                                                { addSuffix: true }
                                            )}
                                        </span>
                                    </>
                                )}
                            </div>
                            <div className="px-3 py-3">
                                <div
                                    className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap"
                                    dangerouslySetInnerHTML={{
                                        __html: highlightedAnswerText,
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex items-center justify-between mt-3 max-w-[400px]">
                        {isAdmin ? (
                            <button
                                onClick={() => setIsAnswering(!isAnswering)}
                                className="flex items-center gap-1.5 text-slate-500 hover:text-rcf-navy group transition-colors"
                            >
                                <div className="p-1.5 rounded-full group-hover:bg-rcf-navy/5 transition-colors">
                                    <MessageCircle className="w-4 h-4" />
                                </div>
                                <span className="text-xs">
                                    {question.answer_text ? "Edit" : "Answer"}
                                </span>
                            </button>
                        ) : isAnswered ? (
                            <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium">Answered</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 text-amber-500">
                                <Clock className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium">Pending</span>
                            </div>
                        )}

                        <button
                            onClick={() => {
                                if (navigator.share) {
                                    navigator.share({
                                        title: "Q&A - RCF FUTA",
                                        text: question.question_text,
                                    });
                                }
                            }}
                            className="flex items-center gap-1.5 text-slate-500 hover:text-rcf-navy group transition-colors"
                        >
                            <div className="p-1.5 rounded-full group-hover:bg-rcf-navy/5 transition-colors">
                                <Share2 className="w-4 h-4" />
                            </div>
                        </button>
                    </div>

                    {/* Admin Answer Input */}
                    {isAnswering && isAdmin && (
                        <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex gap-3">
                                <div className="w-0.5 bg-rcf-navy/20 rounded-full shrink-0 ml-4" />
                                <div className="flex-1">
                                    <textarea
                                        value={answerText}
                                        onChange={(e) => setAnswerText(e.target.value)}
                                        placeholder="Write your answer... Scripture references will be highlighted automatically."
                                        className="w-full text-sm text-slate-900 leading-relaxed resize-none outline-none placeholder:text-slate-400 min-h-[60px] bg-transparent"
                                        autoFocus
                                    />
                                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                        <button
                                            onClick={() => setIsAnswering(false)}
                                            className="text-xs font-semibold px-3 py-1.5 rounded-full text-slate-500 hover:bg-slate-100 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSubmitAnswer}
                                            disabled={!answerText.trim()}
                                            className="text-xs font-bold px-4 py-1.5 rounded-full bg-rcf-navy text-white hover:bg-rcf-navy-light disabled:opacity-40 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1.5"
                                        >
                                            <Send className="w-3 h-3" />
                                            {question.answer_text ? "Update" : "Post"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </article>
    );
}
