import Link from "next/link";
import {
    ArrowUpRight,
    BadgeCheck,
    CheckCircle2,
    Crown,
    GraduationCap,
    MessageCircleHeart,
    QrCode,
    ScanLine,
    Users,
} from "lucide-react";
import { FELLOWSHIP_UNITS, isGenderCategoryUnit } from "@/config/fellowship-units";
import { LoLogo } from "@/components/lo-app/LoLogo";

// Counted from the same config the database is seeded from, so it can't drift. The
// Brothers' and Sisters' units are categories, not units anybody joins.
const JOINABLE = FELLOWSHIP_UNITS.filter((u) => !isGenderCategoryUnit(u.slug));
const SAMPLE_UNITS = JOINABLE.slice(0, 7).map((u) => u.name.replace(/ (Unit|Team)$/, ""));

/**
 * What the portal does, as a bento grid. Each tile carries a small drawing of the
 * product itself (HTML and inline SVG — no screenshots to download), so a first-time
 * visitor sees what they get rather than reading a list of features.
 */
export function PortalFeatures() {
    return (
        <section id="portal" aria-labelledby="portal-title" className="scroll-mt-20 bg-white py-20 sm:py-28">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                    <div className="max-w-2xl">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-rcf-navy/60">The portal</p>
                        <h2 id="portal-title" className="mt-3 text-3xl font-bold tracking-tight text-slate-900 text-balance sm:text-5xl">
                            One portal.{" "}
                            <span className="font-display font-normal italic text-rcf-navy">The whole fellowship.</span>
                        </h2>
                    </div>
                    <p className="max-w-md text-base leading-relaxed text-slate-600">
                        Built for the phone in your pocket and the data plan you actually have — light,
                        fast, and ready when the network isn&rsquo;t.
                    </p>
                </div>

                <div className="mt-12 grid gap-4 sm:mt-14 sm:gap-5 lg:grid-cols-3">
                    {/* Membership — the wide tile */}
                    <Tile className="lg:col-span-2" href="/profile" cta="Register or update your profile">
                        <div className="grid items-center gap-8 sm:grid-cols-[1fr_auto]">
                            <div>
                                <TileText
                                    icon={BadgeCheck}
                                    title="Your membership, in your pocket"
                                    body="Your profile, academics, unit and zone in one place — with a digital member ID that goes wherever you do."
                                />
                                <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                                    {["Bio-data & contacts", "Department & level", "Unit & zone", "Service history"].map((item) => (
                                        <li key={item} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <IdCard />
                        </div>
                    </Tile>

                    <Tile href="/events" cta="See events">
                        <TileText
                            icon={ScanLine}
                            title="Events & QR check-in"
                            body="Register once, then walk in with a scan. No queues, no paper lists."
                        />
                        <QrArt />
                    </Tile>

                    <Tile>
                        <TileText
                            icon={Users}
                            title="Units, teams & zones"
                            body={`${JOINABLE.length} units and teams, and the residential zones — each with its own leaders and roster.`}
                        />
                        <ul aria-label="Some of the units" className="mt-6 flex flex-wrap gap-1.5">
                            {SAMPLE_UNITS.map((name) => (
                                <li key={name} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                                    {name}
                                </li>
                            ))}
                            <li className="rounded-full bg-rcf-navy px-2.5 py-1 text-xs font-semibold text-white">
                                +{JOINABLE.length - SAMPLE_UNITS.length} more
                            </li>
                        </ul>
                    </Tile>

                    <Tile>
                        <TileText
                            icon={Crown}
                            title="Leadership & handover"
                            body="Offices, cabinet and unit leaders for every session — and a handover that carries the fellowship forward intact."
                        />
                        <Handover />
                    </Tile>

                    <Tile href="/lo-app" cta="Open Lo!" dark>
                        <div className="flex items-center gap-3">
                            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                                <LoLogo size="sm" variant="dark" />
                            </span>
                            <MessageCircleHeart className="h-5 w-5 text-rcf-gold" aria-hidden="true" />
                        </div>
                        <h3 className="mt-5 text-lg font-bold text-white">Lo! — ask, share, testify</h3>
                        <p className="mt-2 text-sm leading-relaxed text-white/70">
                            Bring your questions to the fellowship, and tell of what God has done. Open to
                            everyone — no sign-in to read.
                        </p>
                    </Tile>

                    <Tile className="lg:col-span-3" href="/academics" cta="Submit results">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rcf-navy/[0.06] text-rcf-navy">
                                <GraduationCap className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Academics, taken seriously</h3>
                                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                                    The Academic Unit collects each semester&rsquo;s results with a round token, so
                                    the fellowship can stand with every student — excellence is part of our witness.
                                </p>
                            </div>
                        </div>
                    </Tile>
                </div>
            </div>
        </section>
    );
}

function Tile({
    children,
    className = "",
    href,
    cta,
    dark,
}: {
    children: React.ReactNode;
    className?: string;
    href?: string;
    cta?: string;
    dark?: boolean;
}) {
    return (
        <article
            className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl p-6 ring-1 transition-shadow sm:p-8 ${
                dark
                    ? "bg-rcf-navy ring-rcf-navy hover:shadow-2xl hover:shadow-rcf-navy/25"
                    : "bg-slate-50 ring-slate-200/70 hover:shadow-xl hover:shadow-slate-200/70"
            } ${className}`}
        >
            <div>{children}</div>
            {href && cta && (
                <Link
                    href={href}
                    className={`mt-7 inline-flex w-fit items-center gap-1.5 rounded-full text-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-4 ${
                        dark
                            ? "text-rcf-gold focus-visible:ring-rcf-gold focus-visible:ring-offset-rcf-navy"
                            : "text-rcf-navy focus-visible:ring-rcf-navy focus-visible:ring-offset-slate-50"
                    }`}
                >
                    {cta}
                    <ArrowUpRight className="h-4 w-4 transition-transform motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
            )}
        </article>
    );
}

function TileText({ icon: Icon, title, body }: { icon: typeof Users; title: string; body: string }) {
    return (
        <div>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rcf-navy/[0.06] text-rcf-navy">
                <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="mt-5 text-lg font-bold text-slate-900">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Drawings                                                                    */
/* -------------------------------------------------------------------------- */

/** A member ID card, drawn. Decorative — nobody's real details. */
function IdCard() {
    return (
        <div aria-hidden="true" className="mx-auto w-full max-w-[17rem] sm:w-64">
            <div className="relative rotate-2 overflow-hidden rounded-2xl bg-rcf-navy p-4 text-white shadow-2xl shadow-rcf-navy/30 transition-transform duration-500 motion-safe:group-hover:rotate-0">
                <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-rcf-gold/20 blur-2xl" />
                <div className="relative flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-rcf-gold">Member ID</span>
                    <span className="text-[10px] font-semibold text-white/60">RCF FUTA</span>
                </div>
                <div className="relative mt-4 flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-rcf-gold to-amber-500 text-base font-black text-rcf-navy">
                        TA
                    </span>
                    <div className="min-w-0 space-y-1.5">
                        <span className="block h-2.5 w-24 rounded bg-white/80" />
                        <span className="block h-2 w-16 rounded bg-white/35" />
                    </div>
                </div>
                <div className="relative mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-[9px] uppercase tracking-wider text-white/50">
                    <span>Unit<span className="mt-1 block h-1.5 w-8 rounded bg-white/40" /></span>
                    <span>Zone<span className="mt-1 block h-1.5 w-7 rounded bg-white/40" /></span>
                    <span>Level<span className="mt-1 block h-1.5 w-5 rounded bg-white/40" /></span>
                </div>
            </div>
        </div>
    );
}

// A QR-shaped drawing: three finder squares and a fixed scatter of modules. Not a
// real code (nothing to scan) — generated once at module load, identically everywhere.
const QR_SIZE = 21;
const QR_PATH = (() => {
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const inFinder = (x: number, y: number) =>
        (x < 8 && y < 8) || (x > QR_SIZE - 9 && y < 8) || (x < 8 && y > QR_SIZE - 9);
    let d = "";
    for (let y = 0; y < QR_SIZE; y++) {
        for (let x = 0; x < QR_SIZE; x++) {
            if (!inFinder(x, y) && rand() > 0.52) d += `M${x} ${y}h1v1h-1z`;
        }
    }
    return d;
})();

function QrArt() {
    const finders: [number, number][] = [[0, 0], [QR_SIZE - 7, 0], [0, QR_SIZE - 7]];
    return (
        <div aria-hidden="true" className="relative mx-auto mt-7 w-36">
            {/* Scanner frame corners */}
            <span className="absolute -inset-3 rounded-2xl border-2 border-dashed border-rcf-navy/15" />
            <svg viewBox={`-1 -1 ${QR_SIZE + 2} ${QR_SIZE + 2}`} className="relative w-full rounded-lg bg-white shadow-lg ring-1 ring-slate-200">
                <path d={QR_PATH} className="fill-rcf-navy" />
                {finders.map(([x, y]) => (
                    <g key={`${x}-${y}`}>
                        <rect x={x + 0.5} y={y + 0.5} width={6} height={6} rx={1.2} className="fill-none stroke-rcf-navy" strokeWidth={1} />
                        <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.6} className="fill-rcf-navy" />
                    </g>
                ))}
            </svg>
            <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-rcf-gold shadow-[0_0_12px_2px_var(--color-rcf-gold)] motion-safe:animate-glow" />
            <span className="absolute -bottom-3 -right-3 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg ring-4 ring-slate-50">
                <QrCode className="h-4 w-4" />
            </span>
        </div>
    );
}

/** Two sessions, and the baton passing between them. */
function Handover() {
    return (
        <div aria-hidden="true" className="mt-7 flex items-center gap-2">
            <SessionPill label="Outgoing" muted />
            <span className="relative h-px flex-1 bg-linear-to-r from-slate-300 to-rcf-gold">
                <span className="absolute -right-1 -top-[3px] h-[7px] w-[7px] rotate-45 border-r border-t border-rcf-gold" />
            </span>
            <SessionPill label="Incoming" />
        </div>
    );
}

function SessionPill({ label, muted }: { label: string; muted?: boolean }) {
    return (
        <span
            className={`flex flex-col items-center rounded-2xl px-3.5 py-2.5 ${
                muted ? "bg-white text-slate-500 ring-1 ring-slate-200" : "bg-rcf-navy text-white shadow-lg shadow-rcf-navy/25"
            }`}
        >
            <Crown className={`h-4 w-4 ${muted ? "text-slate-400" : "text-rcf-gold"}`} />
            <span className="mt-1 text-[10px] font-bold uppercase tracking-wider">{label}</span>
        </span>
    );
}
