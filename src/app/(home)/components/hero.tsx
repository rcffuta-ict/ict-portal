import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, Crown, UserPlus } from "lucide-react";
import { LoLogo } from "@/components/lo-app/LoLogo";
import { getLandingTenure } from "../data";
import { LightGlobe } from "./light-globe";

/**
 * The first screen. Server-rendered, so the headline and both calls to action are in
 * the very first bytes — nothing waits on JavaScript, which is what a student on a slow
 * connection sees first. The only live piece (the session chip) streams in after.
 */
export function Hero({ tenureChip }: { tenureChip: React.ReactNode }) {
    return (
        <section
            aria-labelledby="hero-title"
            className="relative isolate overflow-hidden bg-rcf-navy pb-20 pt-28 text-white sm:pb-24 lg:pb-32 lg:pt-36"
        >
            <Backdrop />

            <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:px-8">
                <div className="max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/80 ring-1 ring-white/15">
                            <span className="h-1.5 w-1.5 rounded-full bg-rcf-gold" aria-hidden="true" />
                            RCF FUTA · ICT Team
                        </span>
                        {tenureChip}
                    </div>

                    <h1
                        id="hero-title"
                        className="mt-7 text-[2.6rem] font-bold leading-[1.04] tracking-tight text-balance sm:text-6xl lg:text-7xl"
                    >
                        Building the digital home of{" "}
                        <span className="font-display font-normal italic text-rcf-gold">our fellowship.</span>
                    </h1>

                    <p className="mt-6 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
                        The official portal of the Redeemed Christian Fellowship, FUTA — your
                        membership, units, events and check-in, and the Lo! community, all shaped
                        around the session God has given us.
                    </p>

                    <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                        <Link
                            href="/dashboard"
                            className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-rcf-gold px-7 text-base font-bold text-rcf-navy shadow-xl shadow-black/25 transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-rcf-navy"
                        >
                            Open the portal
                            <ArrowRight className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
                        </Link>
                        <Link
                            href="/profile"
                            className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-base font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-gold"
                        >
                            <UserPlus className="h-4 w-4" aria-hidden="true" />
                            Register as a member
                        </Link>
                    </div>

                    <figure className="mt-12 max-w-md border-l-2 border-rcf-gold/60 pl-4">
                        <blockquote className="font-display text-lg italic leading-snug text-white/85 sm:text-xl">
                            &ldquo;For we are labourers together with God.&rdquo;
                        </blockquote>
                        <figcaption className="mt-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                            1 Corinthians 3:9
                        </figcaption>
                    </figure>
                </div>

                <HeroArt />
            </div>
        </section>
    );
}

function Backdrop() {
    return (
        <div aria-hidden="true" className="absolute inset-0 -z-10">
            {/* A faint engineering grid, fading out toward the edges. */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />
            <div className="absolute -right-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-rcf-gold/15 blur-3xl" />
            <div className="absolute -bottom-48 -left-32 h-[30rem] w-[30rem] rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-rcf-gold/40 to-transparent" />
        </div>
    );
}

/** The globe, with two glimpses of the product floating over it. Decorative. */
function HeroArt() {
    return (
        <div aria-hidden="true" className="relative mx-auto w-full max-w-[26rem] sm:max-w-[30rem] lg:max-w-none">
            <LightGlobe className="h-auto w-full" />

            <div className="absolute left-0 top-[10%] z-10 w-44 rounded-2xl bg-rcf-navy-light/95 p-3 shadow-2xl ring-1 ring-white/15 sm:-left-4 sm:w-52 motion-safe:animate-float">
                <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                        <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-xs font-bold text-white">Checked in</p>
                        <p className="truncate text-[11px] text-white/60">Sunday service · QR</p>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-[8%] right-0 z-10 w-48 rounded-2xl bg-white p-3 text-rcf-navy shadow-2xl sm:-right-2 sm:w-56 motion-safe:animate-float-delayed">
                <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rcf-navy">
                        <LoLogo size="sm" variant="dark" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-xs font-bold">New testimony</p>
                        <p className="truncate text-[11px] text-slate-500">&ldquo;God came through for me…&rdquo;</p>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-[30%] left-[4%] z-10 hidden items-center gap-2 rounded-full bg-rcf-navy-light/90 px-3 py-1.5 text-[11px] font-semibold text-white/85 shadow-xl ring-1 ring-white/15 sm:flex">
                <CalendarDays className="h-3.5 w-3.5 text-rcf-gold" />
                Unit meeting · Thu
            </div>
        </div>
    );
}

/** "2026/2027 · Arise and Shine" — streamed into the hero once the tenure is read. */
export async function HeroTenureChip() {
    const tenure = await getLandingTenure();
    if (!tenure) return null;

    return (
        <a
            href="#session"
            className="inline-flex max-w-full items-center gap-2 rounded-full bg-rcf-gold/15 px-3.5 py-1.5 text-xs font-semibold text-rcf-gold ring-1 ring-rcf-gold/30 transition hover:bg-rcf-gold/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-gold"
        >
            <Crown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">
                {tenure.session}
                <span className="text-rcf-gold/60"> · </span>
                {tenure.crowned ? tenure.theme : "Awaiting coronation"}
            </span>
        </a>
    );
}

export function HeroTenureChipSkeleton() {
    return <span className="h-7 w-44 rounded-full bg-white/10 motion-safe:animate-pulse" aria-hidden="true" />;
}
