import Image from "next/image";
import { ArrowRight, Gem, HandHeart, ShieldCheck } from "lucide-react";

const VALUES = [
    {
        icon: Gem,
        title: "Excellence as worship",
        body: "We build carefully because we build for Him.",
        verse: "Colossians 3:23",
    },
    {
        icon: ShieldCheck,
        title: "Faithful stewardship",
        body: "Members' data is a trust. We guard it, and keep only what serves them.",
        verse: "1 Peter 4:10",
    },
    {
        icon: HandHeart,
        title: "Service first",
        body: "Every screen exists to free leaders for ministry, not paperwork.",
        verse: "Galatians 5:13",
    },
];

/**
 * Who builds this: the ICT Team, shown with both marks — the fellowship's and the
 * team's — as the official banner pairs them.
 */
export function Mission() {
    return (
        <section id="team" aria-labelledby="team-title" className="scroll-mt-20 bg-white py-20 sm:py-28">
            <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
                <Lockup />

                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-rcf-navy/60">The ICT Team</p>
                    <h2 id="team-title" className="mt-3 text-3xl font-bold tracking-tight text-slate-900 text-balance sm:text-5xl">
                        Technology, offered{" "}
                        <span className="font-display font-normal italic text-rcf-navy">as service.</span>
                    </h2>
                    <p className="mt-5 text-base leading-relaxed text-slate-600 sm:text-lg">
                        We are the Information and Communications Team of RCF FUTA. We run the
                        fellowship&rsquo;s infrastructure, its systems and its communications — students
                        building, session after session, for the family we belong to.
                    </p>

                    <ul className="mt-9 space-y-5">
                        {VALUES.map(({ icon: Icon, title, body, verse }) => (
                            <li key={title} className="flex gap-4">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rcf-navy text-rcf-gold shadow-lg shadow-rcf-navy/20">
                                    <Icon className="h-5 w-5" aria-hidden="true" />
                                </span>
                                <div>
                                    <p className="flex flex-wrap items-baseline gap-x-2 font-bold text-slate-900">
                                        {title}
                                        <span className="font-display text-sm font-normal italic text-slate-500">{verse}</span>
                                    </p>
                                    <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{body}</p>
                                </div>
                            </li>
                        ))}
                    </ul>

                    <a
                        href="mailto:ict@rcffuta.com"
                        className="mt-10 inline-flex items-center gap-2 text-sm font-bold text-rcf-navy underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-navy focus-visible:ring-offset-4"
                    >
                        Talk to the ICT Team — ict@rcffuta.com
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                </div>
            </div>
        </section>
    );
}

/** RCF FUTA | ICT Team, lit from behind in gold — after the official banner. */
function Lockup() {
    return (
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-rcf-navy px-6 py-14 shadow-2xl shadow-rcf-navy/25 sm:px-10 sm:py-20">
            <div aria-hidden="true" className="absolute inset-0 -z-10">
                <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rcf-gold/25 blur-3xl motion-safe:animate-glow" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.05)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_70%)]" />
                {/* Circuit traces, after the banner */}
                <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 400 300">
                    <g fill="none" className="stroke-rcf-gold/40" strokeWidth={1}>
                        <path d="M0 40 H90 L120 70 H170" />
                        <path d="M400 250 H320 L290 220 H240" />
                        <path d="M0 260 H60 L80 240" />
                        <path d="M400 50 H340 L320 70" />
                    </g>
                    <g className="fill-rcf-gold/70">
                        <circle cx={170} cy={70} r={2.5} />
                        <circle cx={240} cy={220} r={2.5} />
                        <circle cx={80} cy={240} r={2} />
                        <circle cx={320} cy={70} r={2} />
                    </g>
                </svg>
            </div>

            <div className="flex items-center justify-center gap-5 sm:gap-8">
                {/* The RCF mark is navy with FUTA cut out; brightness-0 + invert turns it
                    white and keeps the cut-out, so it reads on navy. */}
                <Image
                    src="/logo/rcffuta-dark.png"
                    alt="RCF FUTA"
                    width={824}
                    height={303}
                    sizes="(max-width: 640px) 40vw, 220px"
                    className="h-auto w-[40%] max-w-[13rem] brightness-0 invert"
                />
                <span aria-hidden="true" className="h-20 w-px shrink-0 bg-linear-to-b from-transparent via-rcf-gold to-transparent sm:h-28" />
                <Image
                    src="/logo/logo-alt-511x291_.png"
                    alt="ICT Team"
                    width={511}
                    height={291}
                    sizes="(max-width: 640px) 40vw, 220px"
                    className="h-auto w-[40%] max-w-[13rem]"
                />
            </div>
            <p className="mt-10 text-center font-display text-lg italic text-rcf-gold sm:text-xl">
                The Redeemed Christian Fellowship, FUTA Chapter
            </p>
            <p className="mt-1 text-center text-xs font-semibold uppercase tracking-[0.3em] text-white/55">
                ICT Team
            </p>
        </div>
    );
}
