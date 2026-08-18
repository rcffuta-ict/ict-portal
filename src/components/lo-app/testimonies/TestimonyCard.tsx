"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Clock, EyeOff, Hand, ShieldAlert } from "lucide-react";
import { ShareButton } from "./ShareButton";
import { categoryLabel, type Testimony } from "@/lib/testimonies";
import { formatEventDateTime, parseEventDate } from "@/lib/event-utils";

interface TestimonyCardProps {
    testimony: Testimony;
    /** Members can say Amen; everyone else sees the count only. */
    canAmen: boolean;
    onAmen: (id: string) => void;
    onRequestMembership?: () => void;
}

const STATUS_NOTE: Record<string, { label: string; tone: string; hint: string }> = {
    pending: {
        label: "Awaiting review",
        tone: "bg-amber-50 text-amber-700",
        hint: "Only you can see this. A moderator will review it shortly.",
    },
    rejected: {
        label: "Not published",
        tone: "bg-red-50 text-red-700",
        hint: "This testimony wasn't published.",
    },
    hidden: {
        label: "Hidden",
        tone: "bg-slate-100 text-slate-600",
        hint: "This testimony was taken down by a moderator.",
    },
};

export function TestimonyCard({
    testimony,
    canAmen,
    onAmen,
    onRequestMembership,
}: TestimonyCardProps) {
    const [expanded, setExpanded] = useState(false);

    const isLong = testimony.body.length > 320;
    const shownBody =
        isLong && !expanded ? `${testimony.body.slice(0, 320).trimEnd()}…` : testimony.body;

    const statusNote = testimony.status !== "approved" ? STATUS_NOTE[testimony.status] : null;
    const displayDate = parseEventDate(testimony.publishedAt || testimony.createdAt);

    const initials = testimony.isAnonymous
        ? "?"
        : testimony.authorName
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase();

    return (
        <article className="border-b border-slate-100 px-4 py-5 transition-colors hover:bg-slate-50/40">
            {statusNote && (
                <div className={`mb-3 flex items-start gap-2 rounded-xl px-3 py-2 ${statusNote.tone}`}>
                    {testimony.status === "pending" ? (
                        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : testimony.status === "hidden" ? (
                        <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                        <p className="text-xs font-semibold">{statusNote.label}</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">
                            {testimony.reviewNote || statusNote.hint}
                        </p>
                    </div>
                </div>
            )}

            <div className="flex items-start gap-3">
                <div
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rcf-navy text-xs font-bold text-rcf-gold"
                >
                    {initials}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold text-slate-900">
                            {testimony.authorName}
                        </span>
                        {testimony.isOwn && (
                            <span className="rounded-md bg-rcf-navy/5 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-rcf-navy uppercase">
                                You
                            </span>
                        )}
                        <span className="text-xs text-slate-400">
                            {formatEventDateTime(displayDate)}
                        </span>
                    </div>

                    <span className="mt-1.5 inline-block rounded-full bg-rcf-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                        {categoryLabel(testimony.category)}
                    </span>

                    <h3 className="mt-2 text-base leading-snug font-bold text-slate-900">
                        {testimony.status === "approved" ? (
                            <Link
                                href={`/lo-app/testimonies/${testimony.id}`}
                                className="transition-colors hover:text-rcf-navy hover:underline"
                            >
                                {testimony.title}
                            </Link>
                        ) : (
                            testimony.title
                        )}
                    </h3>

                    <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-slate-600">
                        {shownBody}
                    </p>

                    {isLong && (
                        <button
                            type="button"
                            onClick={() => setExpanded((prev) => !prev)}
                            className="mt-1 text-xs font-semibold text-rcf-navy hover:underline"
                        >
                            {expanded ? "Show less" : "Read more"}
                        </button>
                    )}

                    {testimony.scriptureReference && (
                        <p className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
                            <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                            {testimony.scriptureReference}
                        </p>
                    )}

                    {testimony.status === "approved" && (
                        <div className="mt-3 flex flex-wrap items-center gap-1">
                            <button
                                type="button"
                                onClick={() =>
                                    canAmen ? onAmen(testimony.id) : onRequestMembership?.()
                                }
                                aria-pressed={testimony.viewerHasAmened}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                                    testimony.viewerHasAmened
                                        ? "bg-rcf-gold/15 text-amber-700"
                                        : "text-slate-500 hover:bg-slate-100 hover:text-rcf-navy"
                                }`}
                            >
                                <Hand className="h-4 w-4" />
                                Amen
                                {testimony.amenCount > 0 && (
                                    <span className="tabular-nums">{testimony.amenCount}</span>
                                )}
                            </button>

                            <ShareButton
                                testimonyId={testimony.id}
                                title={testimony.title}
                                body={testimony.body}
                                shareCount={testimony.shareCount}
                            />
                        </div>
                    )}
                </div>
            </div>
        </article>
    );
}
