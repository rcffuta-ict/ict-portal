"use client";

import { useState } from "react";
import Image from "next/image";
import { CalendarDays, Clock, Crown, Edit3, BookOpen } from "lucide-react";
import type { Tenure } from "@/lib/types/portal";
import { isCoronated } from "@/lib/tenure";
import { DEFAULT_TENURE_BANNER } from "@/config/tenure-branding";
import { imageLoaderFor } from "@/lib/cloudinary";

/**
 * The session's identity, at the top of the Tenure page.
 *
 * The banner is the coronation banner when there is one, and the fellowship's generic
 * banner otherwise — so the page always looks like a place, never like a form.
 *
 * It is shown WHOLE, at its own 3:1, on every screen. Banners are lettered edge to edge
 * (the theme is usually written across them), so any crop cuts words: the old 2:1 phone
 * crop lost the ends of the lettering, and the 4:1 desktop crop plus a fade lost the
 * bottom line. Nothing is laid over the artwork either.
 *
 * The "feel" comes from the banner itself: the hero's backdrop is a blurred copy of it,
 * so every session's hero glows in its own banner's colours, deepened toward the
 * session's primary colour so the white text keeps its contrast. The copy is fetched as
 * a ~64px thumbnail — blurred that heavily, nothing more is visible, and a small image
 * is both a tiny download and cheap for a mid-range phone to blur.
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
    // A banner that fails to load (a dropped connection, a deleted upload) falls back
    // to the generic one rather than leaving an empty frame. Remembered by URL, so a
    // newly uploaded banner always gets its own attempt.
    const [brokenBanner, setBrokenBanner] = useState<string | null>(null);
    const own = tenure.theme_banner_url && tenure.theme_banner_url !== brokenBanner ? tenure.theme_banner_url : null;
    const banner = own || DEFAULT_TENURE_BANNER;
    const onBannerError = () => {
        if (own) setBrokenBanner(own);
    };
    // Cloudinary images are resized by Cloudinary itself (see cloudinaryLoader);
    // local SVG placeholders aren't run through the optimizer at all.
    const loader = imageLoaderFor(banner);
    const unoptimized = banner.endsWith(".svg");
    // Read the clock once, when the hero mounts — not on every render.
    const [now] = useState(() => Date.now());
    const daysActive = Math.max(
        0,
        Math.floor((now - new Date(tenure.start_date).getTime()) / 86_400_000),
    );

    return (
        <section
            aria-label="Current session"
            className="relative isolate overflow-hidden rounded-3xl bg-rcf-navy text-white shadow-xl"
        >
            {/* --- Ambient backdrop: the banner, blurred into light ---------------- */}
            <div aria-hidden="true" className="absolute inset-0 -z-10">
                <Image
                    src={banner}
                    alt=""
                    fill
                    sizes="64px"
                    loader={loader}
                    unoptimized={unoptimized}
                    className="scale-125 object-cover opacity-80 blur-2xl saturate-150"
                />
                {/* Deepens toward the session's primary: light at the top where the
                    banner sits, solid behind the text so contrast never depends on
                    what colours the banner happens to have. */}
                <div className="absolute inset-0 bg-gradient-to-b from-rcf-navy/30 via-rcf-navy/80 to-rcf-navy" />
                {/* A faint gold wash from the top edge: the room lit by the banner. */}
                <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,var(--color-rcf-gold)_0%,transparent_70%)] opacity-15" />
            </div>

            {/* --- The banner, framed and uncovered --------------------------------- */}
            <div className="p-2 sm:p-4 lg:p-5">
                <div className="relative aspect-[3/1] w-full overflow-hidden rounded-2xl bg-white/5 shadow-2xl ring-1 ring-white/15">
                    <Image
                        src={banner}
                        alt={crowned && tenure.theme_banner_url ? `${tenure.theme} banner` : ""}
                        fill
                        // First thing on the page, so fetched eagerly; `sizes` lets a
                        // phone download a phone-sized image rather than the desktop one.
                        priority
                        sizes="(max-width: 1152px) 100vw, 1152px"
                        loader={loader}
                        unoptimized={unoptimized}
                        onError={onBannerError}
                        className="object-cover"
                    />
                </div>
            </div>

            {/* --- Identity -------------------------------------------------------- */}
            {/* One set of actions, placed by the grid: at the bottom on a phone, where
                a thumb reaches, and beside the icon on a wide screen, where a separate
                row would push the hero taller than the viewport. */}
            <div className="grid gap-5 px-5 pb-6 pt-3 sm:px-8 sm:pb-8 sm:pt-4 lg:grid-cols-[1fr_auto]">
                <div className="flex items-center gap-3.5 sm:gap-4">
                    <div
                        className={`relative h-14 w-14 shrink-0 overflow-hidden shadow-lg   sm:h-16 sm:w-16 ${
                            tenure.theme_icon_url ? "bg-transparent" : "ring-2 ring-white/20 rounded-2xl flex items-center justify-center bg-rcf-gold text-rcf-navy"
                        }`}
                    >
                        {tenure.theme_icon_url ? (
                            <Image src={tenure.theme_icon_url} loader={imageLoaderFor(tenure.theme_icon_url)} alt="" fill sizes="64px" className="object-contain" />
                        ) : (
                            <Crown className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
                        )}
                    </div>
                    <div className="min-w-0 space-y-1.5">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-rcf-gold">
                            {crowned ? `${tenure.session} session` : "Awaiting coronation"}
                        </p>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-200 ring-1 ring-emerald-300/25">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 motion-safe:animate-pulse" aria-hidden="true" />
                            Active session
                        </span>
                    </div>
                </div>

                <div className="flex flex-col gap-6 lg:col-span-2 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0 max-w-3xl">
                        <h2 className="font-serif text-3xl font-bold leading-[1.1] text-balance sm:text-4xl md:text-5xl">
                            {crowned ? tenure.theme : tenure.session}
                        </h2>
                        {crowned ? (
                            tenure.theme_text && (
                                <p className="mt-3 flex items-start gap-2 text-sm font-medium text-white/85 sm:text-base">
                                    <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-rcf-gold sm:h-5 sm:w-5" aria-hidden="true" />
                                    <span className="sr-only">Drawn from </span>
                                    <span>{tenure.theme_text}</span>
                                </p>
                            )
                        ) : (
                            // Not a warning: nothing really begins until the retreat, so
                            // this is worded as what happens next.
                            <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/75">
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

                {canWrite && (
                    <div className="order-last flex gap-2 border-t border-white/10 pt-5 lg:order-none lg:col-start-2 lg:row-start-1 lg:self-center lg:border-0 lg:pt-0">
                        <button
                            type="button"
                            onClick={onEditSession}
                            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        >
                            <Edit3 className="h-4 w-4" aria-hidden="true" /> Session
                        </button>
                        <button
                            type="button"
                            onClick={onCoronate}
                            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-rcf-gold px-5 text-sm font-bold text-rcf-navy shadow-lg shadow-black/20 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-rcf-navy sm:flex-none"
                        >
                            <Crown className="h-4 w-4" aria-hidden="true" />
                            {crowned ? "Edit coronation" : "Record coronation"}
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}

function Fact({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
    return (
        <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.07] px-3 py-2.5 ring-1 ring-white/10 sm:gap-3 sm:px-4">
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
