import Image from "next/image";
import {
    ArrowRightLeft,
    BookOpen,
    Briefcase,
    CalendarCheck,
    CalendarDays,
    Crown,
    HandHeart,
    History,
    MapPin,
    Palette as PaletteIcon,
    Sprout,
    Users,
    type LucideIcon,
} from "lucide-react";
import { imageLoaderFor } from "@/lib/cloudinary";
import { getLandingTenure, type LandingTenure, type TenureStage } from "../data";
import { TenureBanner } from "./tenure-banner";

/**
 * "This session" — the portal's organising idea, made visible.
 *
 * Everything in the portal belongs to a tenure: offices, unit leadership, zones,
 * generations, events and their attendance. So the front page leads with the session
 * itself (its theme, scripture, banner and colours as recorded at coronation), shows
 * where the fellowship is in its year, and explains what follows the session.
 *
 * Public pages keep the brand (AGENTS.md), so the session's palette is SHOWN here as
 * swatches rather than repainting the page.
 */
export async function TenureSection() {
    const tenure = await getLandingTenure();

    return (
        <SectionShell>
            {tenure ? <SessionCard tenure={tenure} /> : <BetweenSessions />}
            <TenureCycle stage={tenure?.stage ?? "between"} />
            <TenureAware />
        </SectionShell>
    );
}

function SectionShell({ children }: { children: React.ReactNode }) {
    return (
        <section id="session" aria-labelledby="session-title" className="scroll-mt-20 bg-slate-50 py-20 sm:py-28">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="max-w-3xl">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-rcf-navy/60">
                        Tenure-aware, by design
                    </p>
                    <h2 id="session-title" className="mt-3 text-3xl font-bold tracking-tight text-slate-900 text-balance sm:text-5xl">
                        Every session has its own story.{" "}
                        <span className="font-display font-normal italic text-rcf-navy">The portal keeps it.</span>
                    </h2>
                    <p className="mt-5 text-base leading-relaxed text-slate-600 sm:text-lg">
                        Leadership changes every year, but the fellowship&rsquo;s memory shouldn&rsquo;t.
                        The portal is built around the tenure — each session&rsquo;s theme, offices,
                        units and records live together, and nothing is lost at handover.
                    </p>
                </div>
                <div className="mt-12 space-y-10 sm:mt-14">{children}</div>
            </div>
        </section>
    );
}

/* -------------------------------------------------------------------------- */
/* The session                                                                 */
/* -------------------------------------------------------------------------- */

function SessionCard({ tenure }: { tenure: LandingTenure }) {
    return (
        <article
            aria-label={`The ${tenure.session} session`}
            className="relative isolate overflow-hidden rounded-3xl bg-rcf-navy text-white shadow-2xl shadow-rcf-navy/20"
        >
            <div aria-hidden="true" className="absolute inset-0 -z-10">
                <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,var(--color-rcf-gold)_0%,transparent_70%)] opacity-20" />
                <div className="absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
            </div>

            <div className="p-2 sm:p-4 lg:p-5">
                <TenureBanner src={tenure.bannerUrl} alt={tenure.theme ? `${tenure.theme} banner` : ""} />
            </div>

            <div className="grid gap-8 px-5 pb-7 pt-3 sm:px-8 sm:pb-9 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-12">
                <div className="min-w-0">
                    <div className="flex items-center gap-3">
                        <SessionIcon url={tenure.iconUrl} />
                        <div className="space-y-1">
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-rcf-gold">
                                {tenure.session} session
                            </p>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-200 ring-1 ring-emerald-300/25">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 motion-safe:animate-pulse" aria-hidden="true" />
                                Active now
                            </span>
                        </div>
                    </div>

                    {tenure.crowned ? (
                        <>
                            <h3 className="mt-6 font-display text-4xl leading-[1.05] text-balance sm:text-5xl lg:text-6xl">
                                {tenure.theme}
                            </h3>
                            {tenure.themeText && (
                                <p className="mt-4 flex items-start gap-2 text-sm font-medium text-white/85 sm:text-base">
                                    <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-rcf-gold sm:h-5 sm:w-5" aria-hidden="true" />
                                    <span className="sr-only">Drawn from </span>
                                    <span>{tenure.themeText}</span>
                                </p>
                            )}
                        </>
                    ) : (
                        <>
                            <h3 className="mt-6 font-display text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
                                Awaiting <span className="italic text-rcf-gold">coronation</span>
                            </h3>
                            {/* Not a warning — nothing really begins until the retreat. */}
                            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
                                The {tenure.session} session has begun. Its theme is unveiled at the
                                coronation retreat — and from that day the portal carries it everywhere.
                            </p>
                        </>
                    )}
                </div>

                <dl className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3 lg:max-w-md lg:justify-end">
                    <Fact icon={CalendarDays} label="Coronation">
                        {!tenure.crowned ? "At the retreat" : tenure.coronatedOn ? formatDay(tenure.coronatedOn) : "Recorded"}
                    </Fact>
                    <Fact icon={Sprout} label="Session">
                        Day {tenure.day.toLocaleString("en-NG")}
                    </Fact>
                    {tenure.crowned && tenure.palette && (
                        <Fact icon={PaletteIcon} label="Colours" wide>
                            <span className="mt-1 flex gap-1.5">
                                {[tenure.palette.primary, tenure.palette.primaryLight, tenure.palette.accent].map((hex) => (
                                    <span
                                        key={hex}
                                        title={hex}
                                        className="h-5 w-5 rounded-full ring-2 ring-white/30"
                                        style={{ backgroundColor: hex }}
                                    />
                                ))}
                                <span className="sr-only">The session&rsquo;s palette, worn by the members&rsquo; dashboard</span>
                            </span>
                        </Fact>
                    )}
                </dl>

                {tenure.progress !== null && (
                    <div className="lg:col-span-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-white/60">
                            <span>Through the session</span>
                            <span className="text-white">{Math.round(tenure.progress * 100)}%</span>
                        </div>
                        <div
                            role="progressbar"
                            aria-label="How far through the session we are"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(tenure.progress * 100)}
                            className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
                        >
                            <div
                                className="h-full rounded-full bg-linear-to-r from-rcf-gold/70 to-rcf-gold"
                                style={{ width: `${Math.max(2, tenure.progress * 100)}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </article>
    );
}

function SessionIcon({ url }: { url: string | null }) {
    if (url) {
        return (
            <span className="relative h-14 w-14 shrink-0 overflow-hidden">
                <Image src={url} loader={imageLoaderFor(url)} alt="" fill sizes="56px" className="object-contain" />
            </span>
        );
    }
    return (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rcf-gold text-rcf-navy shadow-lg ring-2 ring-white/20">
            <Crown className="h-6 w-6" aria-hidden="true" />
        </span>
    );
}

function Fact({
    icon: Icon,
    label,
    wide,
    children,
}: {
    icon: LucideIcon;
    label: string;
    wide?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div
            className={`flex items-center gap-3 rounded-xl bg-white/[0.07] px-3.5 py-3 ring-1 ring-white/10 sm:px-4 ${wide ? "col-span-2 sm:col-span-1" : ""}`}
        >
            <Icon className="h-4 w-4 shrink-0 text-rcf-gold sm:h-5 sm:w-5" aria-hidden="true" />
            <div className="min-w-0">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-white/60">{label}</dt>
                <dd className="text-sm font-bold leading-snug">{children}</dd>
            </div>
        </div>
    );
}

function BetweenSessions() {
    return (
        <div className="relative overflow-hidden rounded-3xl bg-rcf-navy px-6 py-12 text-center text-white shadow-2xl shadow-rcf-navy/20 sm:px-12 sm:py-16">
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top,var(--color-rcf-gold)_0%,transparent_70%)] opacity-20" />
            <div className="relative mx-auto max-w-xl">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                    <ArrowRightLeft className="h-6 w-6 text-rcf-gold" aria-hidden="true" />
                </span>
                <h3 className="mt-6 font-display text-4xl sm:text-5xl">Between sessions</h3>
                <p className="mt-4 text-sm leading-relaxed text-white/75 sm:text-base">
                    The next session is being prepared. Its theme, leaders and structure appear
                    here the moment it opens — and every past session stays on record.
                </p>
            </div>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* The year, as a cycle                                                        */
/* -------------------------------------------------------------------------- */

const STEPS: { stage: TenureStage; title: string; body: string; icon: LucideIcon }[] = [
    {
        stage: "between",
        title: "Handover",
        body: "The outgoing leaders hand over, and the new session opens with its structure already in place.",
        icon: ArrowRightLeft,
    },
    {
        stage: "awaiting",
        title: "Coronation",
        body: "At the retreat the theme is unveiled, and the session takes on its name, scripture and colours.",
        icon: Crown,
    },
    {
        stage: "serving",
        title: "Serving",
        body: "Offices, units and zones serve under the theme — every meeting and check-in recorded to the session.",
        icon: HandHeart,
    },
    {
        stage: "closing",
        title: "Legacy",
        body: "The session's records are kept whole, and the baton passes to the next generation.",
        icon: History,
    },
];

function TenureCycle({ stage }: { stage: TenureStage | null }) {
    // null while loading: no step is claimed as "now" until the session is known.
    const current = stage ? STEPS.findIndex((s) => s.stage === stage) : -1;

    return (
        <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">The life of a session</h3>
            <ol className="relative mt-6 grid gap-4 md:grid-cols-4 md:gap-5">
                {/* The thread joining the steps: down the side on a phone, across on wider screens. */}
                <span aria-hidden="true" className="absolute bottom-6 left-[1.6rem] top-6 w-px bg-slate-200 md:hidden" />
                <span aria-hidden="true" className="absolute left-8 right-8 top-[1.6rem] hidden h-px bg-slate-200 md:block" />

                {STEPS.map((step, i) => {
                    const isNow = i === current;
                    const done = i < current;
                    const Icon = step.icon;
                    return (
                        <li
                            key={step.stage}
                            aria-current={isNow ? "step" : undefined}
                            className="relative flex gap-4 rounded-2xl p-2 md:flex-col md:gap-5 md:p-0"
                        >
                            <span
                                className={`relative z-10 flex h-[3.2rem] w-[3.2rem] shrink-0 items-center justify-center rounded-2xl ring-4 ring-slate-50 transition-colors ${
                                    isNow
                                        ? "bg-rcf-navy text-rcf-gold shadow-lg shadow-rcf-navy/30"
                                        : done
                                            ? "bg-rcf-navy/10 text-rcf-navy"
                                            : "bg-white text-slate-400 ring-slate-50 [box-shadow:inset_0_0_0_1px_rgb(226_232_240)]"
                                }`}
                            >
                                <Icon className="h-5 w-5" aria-hidden="true" />
                                {isNow && (
                                    <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-3.5 w-3.5">
                                        <span className="absolute inline-flex h-full w-full rounded-full bg-rcf-gold opacity-75 motion-safe:animate-ping" />
                                        <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-rcf-gold ring-2 ring-slate-50" />
                                    </span>
                                )}
                            </span>
                            <div className="min-w-0 pt-1 md:pt-0">
                                <p className="flex flex-wrap items-center gap-2">
                                    <span className={`text-base font-bold ${isNow ? "text-rcf-navy" : "text-slate-800"}`}>
                                        {step.title}
                                    </span>
                                    {isNow && (
                                        <span className="rounded-full bg-rcf-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                                            We are here
                                        </span>
                                    )}
                                </p>
                                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.body}</p>
                            </div>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* What follows the session                                                   */
/* -------------------------------------------------------------------------- */

const FOLLOWS: { icon: LucideIcon; title: string; body: string }[] = [
    { icon: Briefcase, title: "Offices & cabinet", body: "Who serves where, appointed to this session." },
    { icon: Users, title: "Units & teams", body: "Each unit's leaders and workforce, per session." },
    { icon: MapPin, title: "Zones", body: "Residential zones and their coordinators." },
    { icon: Sprout, title: "Generations", body: "Every class set, named and carried forward." },
    { icon: CalendarCheck, title: "Events & attendance", body: "Every check-in counted to its session." },
    { icon: History, title: "Handover records", body: "A clean, kept record of every transition." },
];

function TenureAware() {
    return (
        <div className="rounded-3xl bg-white p-6 ring-1 ring-slate-200/70 sm:p-8">
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">What follows the session</h3>
            <ul className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                {FOLLOWS.map(({ icon: Icon, title, body }) => (
                    <li key={title} className="flex gap-3.5">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rcf-navy/[0.06] text-rcf-navy">
                            <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div>
                            <p className="font-bold text-slate-900">{title}</p>
                            <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{body}</p>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/* -------------------------------------------------------------------------- */

export function TenureSectionSkeleton() {
    return (
        <SectionShell>
            <div role="status" aria-label="Loading this session" className="overflow-hidden rounded-3xl bg-rcf-navy p-2 sm:p-4">
                <div className="aspect-[3/1] w-full rounded-2xl bg-white/5 motion-safe:animate-pulse" />
                <div className="space-y-4 p-4 sm:p-6">
                    <div className="h-4 w-40 rounded bg-white/10 motion-safe:animate-pulse" />
                    <div className="h-10 w-3/4 max-w-md rounded bg-white/10 motion-safe:animate-pulse" />
                </div>
            </div>
            <TenureCycle stage={null} />
            <TenureAware />
        </SectionShell>
    );
}

/** "12 Nov 2026" from a Postgres date, without a timezone shifting the day. */
function formatDay(isoDate: string): string {
    const [y, m, d] = isoDate.split("-").map(Number);
    return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
        .format(new Date(Date.UTC(y, m - 1, d)));
}
