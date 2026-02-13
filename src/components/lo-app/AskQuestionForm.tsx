"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
    Send,
    BookOpen,
    Hash,
    X,
    User,
    Loader2,
    AlertCircle,
    CheckCircle2,
} from "lucide-react";
import type { LoEvent, AuthUser } from "./LoAppClient";
import { askQuestion } from "@/app/lo-app/actions";

// ─── Scripture Detection ───
const SCRIPTURE_PATTERN =
    /\b(Genesis|Gen|Exodus|Exod|Ex|Leviticus|Lev|Numbers|Num|Deuteronomy|Deut|Joshua|Josh|Judges|Judg|Ruth|1\s*Samuel|1\s*Sam|2\s*Samuel|2\s*Sam|1\s*Kings|2\s*Kings|1\s*Chronicles|1\s*Chr|2\s*Chronicles|2\s*Chr|Ezra|Nehemiah|Neh|Esther|Est|Job|Psalms?|Ps|Proverbs?|Prov|Ecclesiastes|Eccl|Song\s*of\s*Solomon|Song|Isaiah|Isa|Jeremiah|Jer|Lamentations|Lam|Ezekiel|Ezek|Daniel|Dan|Hosea|Joel|Amos|Obadiah|Obad|Jonah|Micah|Nahum|Habakkuk|Hab|Zephaniah|Zeph|Haggai|Hag|Zechariah|Zech|Malachi|Mal|Matthew|Matt|Mark|Luke|John|Acts|Romans|Rom|1\s*Corinthians|1\s*Cor|2\s*Corinthians|2\s*Cor|Galatians|Gal|Ephesians|Eph|Philippians|Phil|Colossians|Col|1\s*Thessalonians|1\s*Thess|2\s*Thessalonians|2\s*Thess|1\s*Timothy|1\s*Tim|2\s*Timothy|2\s*Tim|Titus|Philemon|Phlm|Hebrews|Heb|James|Jas|1\s*Peter|1\s*Pet|2\s*Peter|2\s*Pet|1\s*John|2\s*John|3\s*John|Jude|Revelation|Rev)\s+\d+(?::\d+)?(?:\s*[-–]\s*\d+)?/gi;

function detectScriptures(text: string): string[] {
    const matches = text.match(SCRIPTURE_PATTERN);
    return matches ? [...new Set(matches)] : [];
}

// ─── Event Tag Detection ───
function detectEventTags(text: string): string[] {
    const matches = text.match(/#(\S+)/g);
    return matches ? [...new Set(matches.map((m) => m.slice(1).toLowerCase()))] : [];
}

interface AskQuestionFormProps {
    events: LoEvent[];
    authenticatedUser: AuthUser | null;
    onQuestionSubmitted: () => void;
}

export function AskQuestionForm({
    events,
    authenticatedUser,
    onQuestionSubmitted,
}: AskQuestionFormProps) {
    const [text, setText] = useState("");
    const [guestName, setGuestName] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(false);

    // Event autocomplete state
    const [showEventDropdown, setShowEventDropdown] = useState(false);
    const [eventSearchQuery, setEventSearchQuery] = useState("");
    const [dropdownIndex, setDropdownIndex] = useState(0);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Detected references
    const detectedScriptures = useMemo(() => detectScriptures(text), [text]);
    const detectedEventTags = useMemo(() => detectEventTags(text), [text]);

    // Match detected tags to actual events
    const taggedEvents = useMemo(() => {
        return events.filter((e) =>
            detectedEventTags.some(
                (tag) =>
                    e.slug.toLowerCase() === tag ||
                    e.title.toLowerCase().replace(/\s+/g, "-") === tag
            )
        );
    }, [events, detectedEventTags]);

    // Unmatched tags (typed but no event found)
    const unmatchedTags = useMemo(() => {
        return detectedEventTags.filter(
            (tag) =>
                !events.some(
                    (e) =>
                        e.slug.toLowerCase() === tag ||
                        e.title.toLowerCase().replace(/\s+/g, "-") === tag
                )
        );
    }, [events, detectedEventTags]);

    const hasValidEvent = taggedEvents.length > 0;

    // Event search filtering for autocomplete
    const filteredEvents = useMemo(() => {
        if (!eventSearchQuery) return events.slice(0, 6);
        const q = eventSearchQuery.toLowerCase();
        return events
            .filter(
                (e) =>
                    e.title.toLowerCase().includes(q) ||
                    e.slug.toLowerCase().includes(q)
            )
            .slice(0, 6);
    }, [events, eventSearchQuery]);

    // Watch for # being typed
    const handleTextChange = useCallback(
        (value: string) => {
            setText(value);

            const cursorPos = textareaRef.current?.selectionStart || value.length;
            const textBeforeCursor = value.slice(0, cursorPos);
            const lastHashIndex = textBeforeCursor.lastIndexOf("#");

            if (lastHashIndex !== -1) {
                const charBefore =
                    lastHashIndex > 0 ? textBeforeCursor[lastHashIndex - 1] : " ";
                if (
                    charBefore === " " ||
                    charBefore === "\n" ||
                    lastHashIndex === 0
                ) {
                    const tagFragment = textBeforeCursor.slice(lastHashIndex + 1);
                    if (!tagFragment.includes(" ")) {
                        setEventSearchQuery(tagFragment);
                        setShowEventDropdown(true);
                        setDropdownIndex(0);
                        return;
                    }
                }
            }

            setShowEventDropdown(false);
        },
        []
    );

    // Insert event tag from autocomplete
    const insertEventTag = useCallback(
        (event: LoEvent) => {
            const cursorPos = textareaRef.current?.selectionStart || text.length;
            const textBeforeCursor = text.slice(0, cursorPos);
            const textAfterCursor = text.slice(cursorPos);

            const lastHashIndex = textBeforeCursor.lastIndexOf("#");
            if (lastHashIndex === -1) return;

            const newText =
                textBeforeCursor.slice(0, lastHashIndex) +
                `#${event.slug} ` +
                textAfterCursor;

            setText(newText);
            setShowEventDropdown(false);
            setEventSearchQuery("");

            setTimeout(() => {
                if (textareaRef.current) {
                    const newCursorPos = lastHashIndex + event.slug.length + 2;
                    textareaRef.current.focus();
                    textareaRef.current.setSelectionRange(
                        newCursorPos,
                        newCursorPos
                    );
                }
            }, 0);
        },
        [text]
    );

    // Keyboard nav for dropdown
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (!showEventDropdown) return;

            if (e.key === "ArrowDown") {
                e.preventDefault();
                setDropdownIndex((prev) =>
                    prev < filteredEvents.length - 1 ? prev + 1 : 0
                );
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setDropdownIndex((prev) =>
                    prev > 0 ? prev - 1 : filteredEvents.length - 1
                );
            } else if (e.key === "Enter" && filteredEvents[dropdownIndex]) {
                e.preventDefault();
                insertEventTag(filteredEvents[dropdownIndex]);
            } else if (e.key === "Escape") {
                setShowEventDropdown(false);
            }
        },
        [showEventDropdown, filteredEvents, dropdownIndex, insertEventTag]
    );

    // Close dropdown on click outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node)
            ) {
                setShowEventDropdown(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(
                textareaRef.current.scrollHeight,
                200
            )}px`;
        }
    }, [text]);

    const displayName = authenticatedUser
        ? `${authenticatedUser.firstName} ${authenticatedUser.lastName}`
        : guestName || "Guest";

    const displayInitials = authenticatedUser
        ? `${authenticatedUser.firstName[0]}${authenticatedUser.lastName[0] || ''}`
        : guestName
        ? guestName
              .split(" ")
              .slice(0, 2)
              .map((n) => n[0])
              .join("")
              .toUpperCase()
        : "?";

    const handleSubmit = async () => {
        if (!text.trim() || !hasValidEvent || submitting) return;

        setSubmitting(true);
        setError(null);

        try {
            const result = await askQuestion({
                event_id: taggedEvents[0].id,
                question_text: text.trim(),
                scripture_reference: detectedScriptures.join(", ") || undefined,
                asker_name: authenticatedUser
                    ? undefined
                    : guestName.trim() || "Guest",
            });

            if (result.success) {
                setText("");
                setGuestName("");
                setSuccess(true);
                setTimeout(() => {
                    setSuccess(false);
                    setExpanded(false);
                }, 2500);
                onQuestionSubmitted();
            } else {
                setError(result.error || "Failed to submit question");
            }
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="border-b border-slate-100 px-4 py-5">
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-green-50 border border-green-200">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-green-800">
                            Question submitted!
                        </p>
                        <p className="text-xs text-green-600">
                            It&apos;ll appear once reviewed.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="border-b border-slate-100">
            <div className="px-4 py-3">
                <div className="flex gap-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-rcf-navy to-rcf-navy-light text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {displayInitials}
                    </div>

                    {/* Input Area */}
                    <div className="flex-1 min-w-0">
                        {!expanded ? (
                            <button
                                onClick={() => {
                                    setExpanded(true);
                                    setTimeout(
                                        () => textareaRef.current?.focus(),
                                        100
                                    );
                                }}
                                className="w-full text-left py-2.5 px-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-500 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                            >
                                Ask a question... use{" "}
                                <span className="text-rcf-navy font-semibold">
                                    #
                                </span>{" "}
                                to tag an event
                            </button>
                        ) : (
                            <div className="space-y-2">
                                {/* Guest name input (only for unauthenticated) */}
                                {!authenticatedUser && (
                                    <div className="flex items-center gap-2">
                                        <User className="w-4 h-4 text-slate-400 shrink-0" />
                                        <input
                                            type="text"
                                            value={guestName}
                                            onChange={(e) =>
                                                setGuestName(e.target.value)
                                            }
                                            placeholder="Your name (optional)"
                                            className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent border-b border-slate-200 focus:border-rcf-navy pb-1 transition-colors"
                                        />
                                    </div>
                                )}

                                {/* Textarea with dropdown */}
                                <div className="relative">
                                    <textarea
                                        ref={textareaRef}
                                        value={text}
                                        onChange={(e) =>
                                            handleTextChange(e.target.value)
                                        }
                                        onKeyDown={handleKeyDown}
                                        placeholder={
                                            authenticatedUser
                                                ? `What's on your mind, ${authenticatedUser.firstName}? Use # to tag an event...`
                                                : "What's your question? Use # to tag an event..."
                                        }
                                        className="w-full min-h-20 max-h-50 resize-none text-[15px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
                                        autoFocus
                                    />

                                    {/* Event Autocomplete Dropdown */}
                                    {showEventDropdown &&
                                        filteredEvents.length > 0 && (
                                            <div
                                                ref={dropdownRef}
                                                className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden"
                                            >
                                                <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                        Tag an event
                                                    </span>
                                                </div>
                                                {filteredEvents.map(
                                                    (event, i) => (
                                                        <button
                                                            key={event.id}
                                                            onClick={() =>
                                                                insertEventTag(
                                                                    event
                                                                )
                                                            }
                                                            onMouseEnter={() =>
                                                                setDropdownIndex(
                                                                    i
                                                                )
                                                            }
                                                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                                                                i ===
                                                                dropdownIndex
                                                                    ? "bg-rcf-navy/5"
                                                                    : "hover:bg-slate-50"
                                                            }`}
                                                        >
                                                            <div
                                                                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                                                                    event.is_active
                                                                        ? "bg-green-100"
                                                                        : "bg-slate-100"
                                                                }`}
                                                            >
                                                                <Hash
                                                                    className={`w-3.5 h-3.5 ${
                                                                        event.is_active
                                                                            ? "text-green-600"
                                                                            : "text-slate-500"
                                                                    }`}
                                                                />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm font-semibold text-slate-900 truncate">
                                                                    {
                                                                        event.title
                                                                    }
                                                                </p>
                                                                <p className="text-[11px] text-slate-500 truncate">
                                                                    #
                                                                    {event.slug}
                                                                    {event.is_active && (
                                                                        <span className="ml-2 text-green-600">
                                                                            •
                                                                            Live
                                                                        </span>
                                                                    )}
                                                                </p>
                                                            </div>
                                                            {i ===
                                                                dropdownIndex && (
                                                                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono shrink-0">
                                                                    Enter ↵
                                                                </span>
                                                            )}
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        )}
                                </div>

                                {/* Detected Tags Display */}
                                {(taggedEvents.length > 0 ||
                                    unmatchedTags.length > 0 ||
                                    detectedScriptures.length > 0) && (
                                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                        {taggedEvents.map((event) => (
                                            <span
                                                key={event.id}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-rcf-navy/10 text-rcf-navy"
                                            >
                                                <Hash className="w-3 h-3" />
                                                {event.slug}
                                                {event.is_active && (
                                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                                )}
                                            </span>
                                        ))}

                                        {unmatchedTags.map((tag) => (
                                            <span
                                                key={tag}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-600"
                                            >
                                                <Hash className="w-3 h-3" />
                                                {tag}
                                                <X className="w-3 h-3" />
                                            </span>
                                        ))}

                                        {detectedScriptures.map((ref) => (
                                            <span
                                                key={ref}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700"
                                            >
                                                <BookOpen className="w-3 h-3" />
                                                {ref}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Error */}
                                {error && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100">
                                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                                        <p className="text-xs text-red-700">
                                            {error}
                                        </p>
                                    </div>
                                )}

                                {/* Bottom Bar */}
                                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                        {!hasValidEvent && text.trim() && (
                                            <span className="flex items-center gap-1 text-rcf-navy font-medium">
                                                <Hash className="w-3 h-3" />
                                                Tag at least one event with #
                                            </span>
                                        )}
                                        {hasValidEvent && (
                                            <span className="flex items-center gap-1 text-green-600">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Event tagged
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                setExpanded(false);
                                                setText("");
                                                setGuestName("");
                                                setError(null);
                                            }}
                                            className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSubmit}
                                            disabled={
                                                !text.trim() ||
                                                !hasValidEvent ||
                                                submitting
                                            }
                                            className="flex items-center gap-1.5 px-4 py-2 bg-rcf-navy text-white rounded-full text-xs font-bold hover:bg-rcf-navy-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                                        >
                                            {submitting ? (
                                                <>
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    Asking...
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="w-3 h-3" />
                                                    Ask
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
