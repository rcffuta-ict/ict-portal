"use client";

import { useState, useRef, useMemo } from "react";
import {
    Send,
    User,
    Ghost,
    ChevronDown,
    AlertCircle,
    CheckCircle2,
    BookOpen,
    Sparkles,
    X,
} from "lucide-react";
import { askQuestion } from "@/app/qa/actions";
import { type AuthUser } from "./QAPageClient";

interface Event {
    id: string;
    title: string;
}

interface AskQuestionFormProps {
    events: Event[];
    authenticatedUser: AuthUser | null;
    onQuestionSubmitted: () => void;
}

// Scripture reference regex
const SCRIPTURE_REGEX =
    /\b(Genesis|Gen|Exodus|Exod|Ex|Leviticus|Lev|Numbers|Num|Deuteronomy|Deut|Joshua|Josh|Judges|Judg|Ruth|1\s*Samuel|1\s*Sam|2\s*Samuel|2\s*Sam|1\s*Kings|1\s*Kgs|2\s*Kings|2\s*Kgs|1\s*Chronicles|1\s*Chr|2\s*Chronicles|2\s*Chr|Ezra|Nehemiah|Neh|Esther|Est|Job|Psalms?|Ps|Proverbs|Prov|Ecclesiastes|Eccl|Song\s*of\s*Solomon|Songs?|Isaiah|Isa|Jeremiah|Jer|Lamentations|Lam|Ezekiel|Ezek|Daniel|Dan|Hosea|Hos|Joel|Amos|Obadiah|Obad|Jonah|Micah|Mic|Nahum|Nah|Habakkuk|Hab|Zephaniah|Zeph|Haggai|Hag|Zechariah|Zech|Malachi|Mal|Matthew|Matt|Mark|Luke|John|Jn|Acts|Romans|Rom|1\s*Corinthians|1\s*Cor|2\s*Corinthians|2\s*Cor|Galatians|Gal|Ephesians|Eph|Philippians|Phil|Colossians|Col|1\s*Thessalonians|1\s*Thess|2\s*Thessalonians|2\s*Thess|1\s*Timothy|1\s*Tim|2\s*Timothy|2\s*Tim|Titus|Philemon|Phlm|Hebrews|Heb|James|Jas|1\s*Peter|1\s*Pet|2\s*Peter|2\s*Pet|1\s*John|1\s*Jn|2\s*John|2\s*Jn|3\s*John|3\s*Jn|Jude|Revelation|Rev)\s*\d+(?:\s*:\s*\d+)?(?:\s*[-–]\s*\d+)?/gi;

function detectScriptureReferences(text: string): string[] {
    const matches = text.match(SCRIPTURE_REGEX);
    return matches ? [...new Set(matches.map((m) => m.trim()))] : [];
}

type IdentityMode = "authenticated" | "named" | "anonymous";

export function AskQuestionForm({
    events,
    authenticatedUser,
    onQuestionSubmitted,
}: AskQuestionFormProps) {
    const [question, setQuestion] = useState("");
    const [selectedEventId, setSelectedEventId] = useState<string>(
        events.length > 0 ? events[0].id : ""
    );
    const [identityMode, setIdentityMode] = useState<IdentityMode>(
        authenticatedUser ? "authenticated" : "anonymous"
    );
    const [guestName, setGuestName] = useState("");
    const [guestEmail, setGuestEmail] = useState("");
    const [guestPhone, setGuestPhone] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [feedback, setFeedback] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const detectedScriptures = useMemo(
        () => detectScriptureReferences(question),
        [question]
    );

    // Auto-resize textarea
    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setQuestion(e.target.value);
        // Auto-resize
        const ta = e.target;
        ta.style.height = "auto";
        ta.style.height = ta.scrollHeight + "px";
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFeedback(null);

        if (!question.trim() || !selectedEventId) {
            setFeedback({
                type: "error",
                message: "Please select an event and enter your question.",
            });
            return;
        }

        if (identityMode === "named" && !guestName.trim()) {
            setFeedback({ type: "error", message: "Please enter your name." });
            return;
        }

        setIsSubmitting(true);

        try {
            const result = await askQuestion({
                event_id: selectedEventId,
                question_text: question,
                scripture_reference:
                    detectedScriptures.length > 0
                        ? detectedScriptures.join(", ")
                        : undefined,
                is_anonymous: identityMode === "anonymous",
                asker_name:
                    identityMode === "authenticated"
                        ? `${authenticatedUser?.firstName} ${authenticatedUser?.lastName}`
                        : identityMode === "named"
                          ? guestName
                          : "Anonymous",
            });

            if (result && result.success === false) {
                setFeedback({
                    type: "error",
                    message: result.error || "Failed to submit question.",
                });
            } else {
                setFeedback({
                    type: "success",
                    message: "Your question has been posted! ✨",
                });
                setQuestion("");
                if (textareaRef.current) {
                    textareaRef.current.style.height = "auto";
                }
                onQuestionSubmitted();
                setTimeout(() => {
                    setIsExpanded(false);
                    setFeedback(null);
                }, 2500);
            }
        } catch {
            setFeedback({
                type: "error",
                message: "Something went wrong. Please try again.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Character count
    const charCount = question.length;
    const maxChars = 1000;
    const charPercentage = (charCount / maxChars) * 100;

    return (
        <div className="border-b border-slate-200/80">
            {!isExpanded ? (
                /* ─── Collapsed Compose Prompt ─── */
                <button
                    onClick={() => setIsExpanded(true)}
                    className="w-full text-left px-4 py-4 hover:bg-slate-50/50 transition-colors flex items-center gap-3 cursor-text"
                >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-rcf-navy to-rcf-navy-light text-white text-xs font-bold">
                        {authenticatedUser ? (
                            <>
                                {authenticatedUser.firstName[0]}
                                {authenticatedUser.lastName[0]}
                            </>
                        ) : (
                            <Ghost className="w-5 h-5" />
                        )}
                    </div>
                    <span className="text-slate-400 text-[15px] font-normal flex-1">
                        What&apos;s your question?
                    </span>
                </button>
            ) : (
                /* ─── Expanded Compose Form ─── */
                <form onSubmit={handleSubmit} className="px-4 pt-4 pb-3">
                    {/* Feedback */}
                    {feedback && (
                        <div
                            className={`mb-3 p-3 rounded-xl flex items-center gap-2 text-sm animate-in fade-in slide-in-from-top-1 ${
                                feedback.type === "success"
                                    ? "bg-green-50 text-green-700 border border-green-100"
                                    : "bg-red-50 text-red-700 border border-red-100"
                            }`}
                        >
                            {feedback.type === "success" ? (
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                            ) : (
                                <AlertCircle className="w-4 h-4 shrink-0" />
                            )}
                            <p className="text-xs font-medium">{feedback.message}</p>
                            <button
                                type="button"
                                onClick={() => setFeedback(null)}
                                className="ml-auto"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

                    <div className="flex gap-3">
                        {/* Avatar Column */}
                        <div className="shrink-0">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-rcf-navy to-rcf-navy-light text-white text-xs font-bold">
                                {authenticatedUser ? (
                                    <>
                                        {authenticatedUser.firstName[0]}
                                        {authenticatedUser.lastName[0]}
                                    </>
                                ) : identityMode === "anonymous" ? (
                                    <Ghost className="w-5 h-5" />
                                ) : (
                                    <User className="w-5 h-5" />
                                )}
                            </div>
                        </div>

                        {/* Content Column */}
                        <div className="flex-1 min-w-0">
                            {/* Posting as indicator */}
                            <div className="mb-2 flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        // Cycle: authenticated -> named -> anonymous
                                        if (identityMode === "authenticated") setIdentityMode("named");
                                        else if (identityMode === "named") setIdentityMode("anonymous");
                                        else setIdentityMode(authenticatedUser ? "authenticated" : "named");
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-rcf-navy/20 text-rcf-navy text-[11px] font-semibold hover:bg-rcf-navy/5 transition-colors"
                                >
                                    {identityMode === "authenticated" && (
                                        <>
                                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                                            {authenticatedUser?.firstName} {authenticatedUser?.lastName}
                                        </>
                                    )}
                                    {identityMode === "named" && (
                                        <>
                                            <User className="w-3 h-3" />
                                            {guestName || "Named"}
                                        </>
                                    )}
                                    {identityMode === "anonymous" && (
                                        <>
                                            <Ghost className="w-3 h-3" />
                                            Anonymous
                                        </>
                                    )}
                                    <ChevronDown className="w-3 h-3" />
                                </button>

                                {/* Event selector */}
                                <select
                                    value={selectedEventId}
                                    onChange={(e) => setSelectedEventId(e.target.value)}
                                    className="text-[11px] font-semibold text-rcf-navy bg-transparent border border-rcf-navy/20 rounded-full px-2.5 py-1 outline-none hover:bg-rcf-navy/5 transition-colors cursor-pointer appearance-none"
                                >
                                    {events.map((event) => (
                                        <option key={event.id} value={event.id}>
                                            # {event.title}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Named guest fields */}
                            {identityMode === "named" && (
                                <div className="mb-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                                    <input
                                        type="text"
                                        placeholder="Your name *"
                                        value={guestName}
                                        onChange={(e) => setGuestName(e.target.value)}
                                        required
                                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:border-rcf-navy focus:ring-1 focus:ring-rcf-navy/20 transition-all placeholder:text-slate-400"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="email"
                                            placeholder="Email (optional)"
                                            value={guestEmail}
                                            onChange={(e) => setGuestEmail(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs outline-none focus:border-rcf-navy focus:ring-1 focus:ring-rcf-navy/20 transition-all placeholder:text-slate-400"
                                        />
                                        <input
                                            type="tel"
                                            placeholder="Phone (optional)"
                                            value={guestPhone}
                                            onChange={(e) => setGuestPhone(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs outline-none focus:border-rcf-navy focus:ring-1 focus:ring-rcf-navy/20 transition-all placeholder:text-slate-400"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 pl-1">
                                        Contact info helps the team follow up with you.
                                    </p>
                                </div>
                            )}

                            {/* Textarea */}
                            <textarea
                                ref={textareaRef}
                                value={question}
                                onChange={handleTextareaChange}
                                placeholder="What's your question? Type scripture references like 'John 3:16' and they'll be highlighted..."
                                className="w-full text-[15px] text-slate-900 leading-relaxed resize-none outline-none placeholder:text-slate-400 min-h-[60px] bg-transparent"
                                autoFocus
                                required
                                maxLength={maxChars}
                            />

                            {/* Scripture detection */}
                            {detectedScriptures.length > 0 && (
                                <div className="mt-1 mb-3 animate-in fade-in slide-in-from-bottom-1 duration-200">
                                    <div className="flex items-center gap-1 mb-1.5">
                                        <Sparkles className="w-3 h-3 text-amber-500" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                                            Scripture detected
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {detectedScriptures.map((ref, i) => (
                                            <span
                                                key={i}
                                                className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md text-xs font-semibold border border-amber-200/60"
                                            >
                                                <BookOpen className="w-2.5 h-2.5" />
                                                {ref}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Bottom toolbar */}
                            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        className="p-2 rounded-full text-rcf-navy hover:bg-rcf-navy/5 transition-colors"
                                        title="Scripture references are auto-detected"
                                    >
                                        <BookOpen className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (identityMode === "anonymous" && !authenticatedUser) {
                                                setIdentityMode("named");
                                            } else if (identityMode === "anonymous" && authenticatedUser) {
                                                setIdentityMode("authenticated");
                                            } else if (identityMode === "authenticated") {
                                                setIdentityMode("anonymous");
                                            } else {
                                                setIdentityMode("anonymous");
                                            }
                                        }}
                                        className="p-2 rounded-full text-rcf-navy hover:bg-rcf-navy/5 transition-colors"
                                        title="Toggle identity"
                                    >
                                        {identityMode === "anonymous" ? (
                                            <Ghost className="w-4 h-4" />
                                        ) : (
                                            <User className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>

                                <div className="flex items-center gap-3">
                                    {/* Character counter */}
                                    {charCount > 0 && (
                                        <div className="flex items-center gap-2">
                                            <div className="relative w-5 h-5">
                                                <svg className="w-5 h-5 -rotate-90" viewBox="0 0 20 20">
                                                    <circle
                                                        cx="10"
                                                        cy="10"
                                                        r="8"
                                                        fill="none"
                                                        stroke="#e2e8f0"
                                                        strokeWidth="2"
                                                    />
                                                    <circle
                                                        cx="10"
                                                        cy="10"
                                                        r="8"
                                                        fill="none"
                                                        stroke={charPercentage > 90 ? "#ef4444" : charPercentage > 70 ? "#f59e0b" : "#181240"}
                                                        strokeWidth="2"
                                                        strokeDasharray={`${charPercentage * 0.5026} 50.26`}
                                                        strokeLinecap="round"
                                                    />
                                                </svg>
                                            </div>
                                            {charPercentage > 85 && (
                                                <span className={`text-[11px] font-medium ${charPercentage > 95 ? "text-red-500" : "text-amber-500"}`}>
                                                    {maxChars - charCount}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <div className="w-px h-6 bg-slate-200" />

                                    {/* Cancel */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsExpanded(false);
                                            setFeedback(null);
                                        }}
                                        className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                                    >
                                        Cancel
                                    </button>

                                    {/* Submit */}
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || !question.trim() || !selectedEventId}
                                        className="inline-flex items-center gap-1.5 px-5 py-2 bg-rcf-navy text-white rounded-full text-sm font-bold hover:bg-rcf-navy-light active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Posting...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-3.5 h-3.5" />
                                                Post
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            )}
        </div>
    );
}
