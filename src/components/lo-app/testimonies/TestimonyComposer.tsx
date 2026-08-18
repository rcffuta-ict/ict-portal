"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Send, Sparkles } from "lucide-react";
import { submitTestimony } from "@/app/lo-app/testimonies/actions";
import { TESTIMONY_CATEGORIES, type TestimonyCategory } from "@/lib/testimonies";
import type { LoEvent } from "../LoAppClient";
import type { LoMember } from "@/lib/lo-member";

interface TestimonyComposerProps {
    member: LoMember;
    events: LoEvent[];
    onPosted: () => void;
}

const BODY_MAX = 5000;

export function TestimonyComposer({ member, events, onPosted }: TestimonyComposerProps) {
    const [expanded, setExpanded] = useState(false);
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [category, setCategory] = useState<TestimonyCategory>("answered_prayer");
    const [scripture, setScripture] = useState("");
    const [eventId, setEventId] = useState("");
    const [isAnonymous, setIsAnonymous] = useState(false);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [posted, setPosted] = useState(false);

    const reset = () => {
        setTitle("");
        setBody("");
        setScripture("");
        setEventId("");
        setIsAnonymous(false);
        setCategory("answered_prayer");
        setExpanded(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            const result = await submitTestimony({
                title,
                body,
                category,
                scriptureReference: scripture,
                eventId: eventId || null,
                isAnonymous,
            });

            if (result.success) {
                reset();
                setPosted(true);
                onPosted();
                setTimeout(() => setPosted(false), 6000);
            } else {
                setError(result.error || "We couldn't post that. Please try again.");
            }
        } catch {
            setError("Something went wrong. Check your connection and try again.");
        } finally {
            setSubmitting(false);
        }
    };

    if (posted) {
        return (
            <div className="border-b border-slate-100 px-4 py-6">
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <div>
                        <p className="text-sm font-semibold text-emerald-900">
                            Testimony received — glory to God!
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-emerald-700">
                            A moderator will review it before it appears publicly. Until
                            then you&apos;ll see it at the top of your feed marked
                            &ldquo;Awaiting review&rdquo;.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="border-b border-slate-100 px-4 py-4">
            <form onSubmit={handleSubmit} noValidate>
                <div className="flex items-start gap-3">
                    <div
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rcf-navy text-xs font-bold text-rcf-gold"
                    >
                        {member.firstName[0]}
                        {member.lastName[0]}
                    </div>

                    <div className="min-w-0 flex-1 space-y-3">
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onFocus={() => setExpanded(true)}
                            maxLength={120}
                            placeholder="Share what God did — give it a short title"
                            aria-label="Testimony title"
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all placeholder:font-medium placeholder:text-slate-400 focus:border-rcf-navy focus:ring-4 focus:ring-rcf-navy/10"
                        />

                        {expanded && (
                            <>
                                <div className="space-y-1">
                                    <textarea
                                        value={body}
                                        onChange={(e) => setBody(e.target.value)}
                                        rows={5}
                                        maxLength={BODY_MAX}
                                        placeholder="Tell the story. What were you believing God for, and what did He do?"
                                        aria-label="Testimony"
                                        className="w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-rcf-navy focus:ring-4 focus:ring-rcf-navy/10"
                                    />
                                    <p className="text-right text-[11px] text-slate-400 tabular-nums">
                                        {body.length}/{BODY_MAX}
                                    </p>
                                </div>

                                <div>
                                    <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                                        Category
                                    </p>
                                    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                                        {TESTIMONY_CATEGORIES.map((option) => (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => setCategory(option.id)}
                                                aria-pressed={category === option.id}
                                                title={option.hint}
                                                className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                                                    category === option.id
                                                        ? "border-rcf-navy bg-rcf-navy text-white"
                                                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                                }`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <label
                                            htmlFor="testimony-scripture"
                                            className="block text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                        >
                                            Scripture (optional)
                                        </label>
                                        <input
                                            id="testimony-scripture"
                                            value={scripture}
                                            onChange={(e) => setScripture(e.target.value)}
                                            placeholder="Psalm 34:1"
                                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-rcf-navy focus:ring-4 focus:ring-rcf-navy/10"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label
                                            htmlFor="testimony-event"
                                            className="block text-xs font-semibold tracking-wide text-slate-500 uppercase"
                                        >
                                            Related event (optional)
                                        </label>
                                        <select
                                            id="testimony-event"
                                            value={eventId}
                                            onChange={(e) => setEventId(e.target.value)}
                                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-rcf-navy focus:ring-4 focus:ring-rcf-navy/10"
                                        >
                                            <option value="">None</option>
                                            {events.map((event) => (
                                                <option key={event.id} value={event.id}>
                                                    {event.title}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                                    <input
                                        type="checkbox"
                                        checked={isAnonymous}
                                        onChange={(e) => setIsAnonymous(e.target.checked)}
                                        className="peer sr-only"
                                    />
                                    <span className="relative h-5 w-9 shrink-0 rounded-full bg-slate-200 transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-rcf-navy peer-checked:after:translate-x-4 peer-focus-visible:ring-4 peer-focus-visible:ring-rcf-navy/20" />
                                    <span>
                                        <span className="block text-sm font-semibold text-slate-900">
                                            Post anonymously
                                        </span>
                                        <span className="block text-xs text-slate-500">
                                            Your name is hidden from the feed. Moderators still
                                            see it.
                                        </span>
                                    </span>
                                </label>

                                {error && (
                                    <div
                                        role="alert"
                                        className="flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 p-3"
                                    >
                                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                                        <p className="text-xs font-medium text-red-700">{error}</p>
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                                        <Sparkles className="h-3.5 w-3.5" />
                                        Reviewed by a moderator before it goes public
                                    </p>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={reset}
                                            disabled={submitting}
                                            className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={
                                                submitting ||
                                                title.trim().length < 3 ||
                                                body.trim().length < 20
                                            }
                                            className="inline-flex items-center gap-2 rounded-2xl bg-rcf-navy px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rcf-navy-light disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {submitting ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Posting...
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="h-4 w-4" />
                                                    Post testimony
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </form>
        </div>
    );
}
