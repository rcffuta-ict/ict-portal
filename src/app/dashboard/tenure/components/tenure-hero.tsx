"use client";

import { useState } from "react";
import Image from "next/image";
import { CalendarDays, Clock, Crown, Edit3, Sparkles } from "lucide-react";
import type { Tenure } from "@/lib/types/portal";
import { isCoronated } from "@/lib/tenure";
import { DEFAULT_TENURE_BANNER } from "@/config/tenure-branding";

/**
 * The session's identity, at the top of the Tenure page.
 *
 * The banner is the coronation banner when there is one, and the fellowship's generic
 * banner otherwise — so the page always looks like a place, never like a form. It is
 * shown uncovered in its own band; the session's identity sits on a panel below it in
 * the session's own primary colour, so the hero changes with the palette.
 *
 * Before coronation the hero says so plainly: "Awaiting coronation" is the honest state
 * of a young session, not an error, so it is worded as an invitation.
 */
export function TenureHero({
    tenure,
    canWrite,
    onEditSession,
    onCoronate,
}: {
    tenure: Tenure;
    canWrite: boolean;
    onEditSession: () => void;
    onCoronate: () => void;
}) {
    const crowned = isCoronated(tenure);
    const banner = tenure.theme_banner_url || DEFAULT_TENURE_BANNER;
    // Read the clock once, when the hero mounts — not on every render.
    const [now] = useState(() => Date.now());
    const daysActive = Math.max(
        0,
        Math.floor((now - new Date(tenure.start_date).getTime()) / 86_400_000),
    );

    return (
        <section
            aria-label="Current session"
            className="overflow-hidden rounded-3xl bg-rcf-navy text-white shadow-xl"
        >
            {/* The banner gets its own band, uncovered: a real banner carries its own
                artwork and lettering, and text laid over it would fight it. Wide on a
                desktop, a shallower crop on a phone so the identity stays above the fold. */}
            <div className="relative aspect-[2/1] w-full sm:aspect-[16/5] lg:aspect-[16/4]">
                <Image
                    src={banner}
                    alt={crowned && tenure.theme_banner_url ? `${tenure.theme} banner` : ""}
                    fill
                    // First thing on the page, so fetched eagerly; `sizes` lets a phone
                    // download a phone-sized image rather than the desktop one.
                    priority
                    sizes="(max-width: 1152px) 100vw, 1152px"
                    className="object-cover"
                    // Local SVG placeholders aren't run through the optimizer.
                    unoptimized={banner.endsWith(".svg")}
                />
                {/* Only the bottom edge fades into the panel; the banner itself stays clear. */}
                <div
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-rcf-navy to-transparent"
                />

                {/* Only the status floats on the banner — the actions live in the panel,
                    so on a phone they never cover the artwork. */}
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1 text-xs font-bold text-emerald-200 backdrop-blur-md sm:left-5 sm:top-5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 motion-safe:animate-pulse" aria-hidden="true" />
                    Active session
                </span>
            </div>

            {/* Identity panel, in the session's primary colour. */}
            <div className="relative px-5 pb-5 sm:px-8 sm:pb-8">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex min-w-0 items-end gap-4">
                        {/* The icon straddles the seam between banner and panel. */}
                        <div
                            className={`relative -mt-8 h-16 w-16 shrink-0 overflow-hidden rounded-2xl ring-4 ring-rcf-navy sm:-mt-10 sm:h-20 sm:w-20 ${
                                tenure.theme_icon_url ? "bg-white" : "flex items-center justify-center bg-rcf-gold text-rcf-navy"
                            }`}
                        >
                            {tenure.theme_icon_url ? (
                                <Image src={tenure.theme_icon_url} alt="" fill sizes="80px" className="object-cover" />
                            ) : (
                                <Crown className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden="true" />
                            )}
                        </div>
                        <p className="min-w-0 pb-1 text-xs font-bold uppercase tracking-[0.2em] text-rcf-gold">
                            {crowned ? `${tenure.session} session` : "Awaiting coronation"}
                        </p>
                    </div>

                    {canWrite && (
                        <div className="flex gap-2 lg:pb-1">
                            <button
                                type="button"
                                onClick={onEditSession}
                                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-4 text-xs font-semibold text-white transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                            >
                                <Edit3 className="h-3.5 w-3.5" aria-hidden="true" /> Session
                            </button>
                            <button
                                type="button"
                                onClick={onCoronate}
                                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-rcf-gold px-4 text-xs font-bold text-rcf-navy shadow-md transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:flex-none"
                            >
                                <Crown className="h-3.5 w-3.5" aria-hidden="true" />
                                {crowned ? "Edit coronation" : "Record coronation"}
                            </button>
                        </div>
                    )}
                </div>

                <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0 space-y-2">
                        <h2 className="font-serif text-3xl font-bold leading-tight text-balance sm:text-4xl md:text-5xl">
                            {crowned ? tenure.theme : tenure.session}
                        </h2>
                        {crowned ? (
                            tenure.theme_text && (
                                <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white/90">
                                    <Sparkles className="h-4 w-4 text-rcf-gold" aria-hidden="true" />
                                    {tenure.theme_text}
                                </p>
                            )
                        ) : (
                            // Not a warning: nothing really begins until the retreat, so
                            // this is worded as what happens next.
                            <p className="max-w-lg text-sm leading-relaxed text-white/75">
                                The theme is unveiled at the coronation retreat. Record it here
                                once it is, and the portal takes on the session&rsquo;s identity.
                            </p>
                        )}
                    </div>

                    {/* Facts. Side by side even on a phone. */}
                    <dl className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:gap-3">
                        <Fact icon={Clock} label="Running" value={`${daysActive} day${daysActive === 1 ? "" : "s"}`} />
                        <Fact
                            icon={CalendarDays}
                            label="Coronation"
                            value={
                                !crowned
                                    ? "Not yet"
                                    : tenure.coronated_on
                                        ? formatDay(tenure.coronated_on)
                                        : "Date not recorded"
                            }
                        />
                    </dl>
                </div>
            </div>
        </section>
    );
}

function Fact({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
    return (
        <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2.5 sm:gap-3 sm:px-3">
            <Icon className="h-4 w-4 shrink-0 text-rcf-gold sm:h-5 sm:w-5" aria-hidden="true" />
            <div className="min-w-0">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-white/60">{label}</dt>
                {/* Wraps rather than truncating: a date cut to "18 Oct 20…" is worse than two lines. */}
                <dd className="text-sm font-bold leading-snug">{value}</dd>
            </div>
        </div>
    );
}

/** "12 Nov 2026" from a Postgres date, without a timezone shifting the day. */
function formatDay(isoDate: string): string {
    const [y, m, d] = isoDate.split("-").map(Number);
    return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
        .format(new Date(Date.UTC(y, m - 1, d)));
}
