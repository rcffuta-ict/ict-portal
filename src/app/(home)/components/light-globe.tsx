/**
 * The hero illustration: the ICT Team's circuit globe, with a cross of light at its
 * heart — "the Light of the world" at the centre of everything we build.
 *
 * Inline SVG on purpose: no image request, crisp on any screen density, ~3 KB in the
 * HTML, and it inherits the brand tokens (so it stays on-brand if they ever change).
 * Every animation is behind `motion-safe:`, so it is perfectly still for anyone who has
 * asked their phone to reduce motion — and it looks finished that way too.
 */

// Latitude streaks, after the ICT logo's globe: each is an arc of the sphere's surface
// ending in a node. [y offset from centre, how far round the sphere it reaches (0–1)].
const STREAKS: [number, number][] = [
    [-118, 0.55],
    [-92, 0.7],
    [-64, 0.62],
    [-34, 0.78],
    [-4, 0.58],
    [26, 0.74],
    [56, 0.66],
    [86, 0.72],
    [114, 0.5],
];

const C = 240; // centre of the 480×480 canvas
const R = 150; // globe radius

function streakPath(dy: number, reach: number): { d: string; end: [number, number] } {
    // The latitude's half-width at this height, then a gentle curve across it so it
    // reads as wrapping round a sphere rather than a flat line.
    const half = Math.sqrt(Math.max(R * R - dy * dy, 0));
    const x1 = C - half;
    const x2 = x1 + 2 * half * reach;
    const y = C + dy;
    const bow = (1 - Math.abs(dy) / R) * 16 + 4;
    return {
        d: `M ${x1.toFixed(1)} ${y} Q ${((x1 + x2) / 2).toFixed(1)} ${(y + bow).toFixed(1)} ${x2.toFixed(1)} ${(y + bow * 0.5).toFixed(1)}`,
        end: [x2, y + bow * 0.5],
    };
}

// Circuit traces running out from the globe to the edge of the canvas.
const TRACES = [
    "M 372 170 L 410 170 L 440 140",
    "M 385 262 L 452 262",
    "M 350 340 L 392 382 L 440 382",
    "M 118 118 L 84 84 L 40 84",
    "M 96 300 L 40 300",
];

export function LightGlobe({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 480 480"
            className={className}
            role="img"
            aria-label="A globe of circuit lines with a glowing cross at its centre"
        >
            <defs>
                <radialGradient id="lg-halo" cx="50%" cy="46%" r="50%">
                    <stop offset="0%" style={{ stopColor: "var(--color-rcf-gold)", stopOpacity: 0.55 }} />
                    <stop offset="45%" style={{ stopColor: "var(--color-rcf-gold)", stopOpacity: 0.12 }} />
                    <stop offset="100%" style={{ stopColor: "var(--color-rcf-gold)", stopOpacity: 0 }} />
                </radialGradient>
                <linearGradient id="lg-cross" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" style={{ stopColor: "#fff7da" }} />
                    <stop offset="100%" style={{ stopColor: "var(--color-rcf-gold)" }} />
                </linearGradient>
                <radialGradient id="lg-sphere" cx="38%" cy="32%" r="75%">
                    <stop offset="0%" style={{ stopColor: "#ffffff", stopOpacity: 0.14 }} />
                    <stop offset="100%" style={{ stopColor: "#ffffff", stopOpacity: 0 }} />
                </radialGradient>
                <filter id="lg-blur" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="10" />
                </filter>
            </defs>

            {/* The room, lit by the cross. */}
            <circle cx={C} cy={C - 10} r={230} fill="url(#lg-halo)" className="motion-safe:animate-glow" />

            {/* Orbits. Rotated about the canvas centre, very slowly. */}
            <g style={{ transformOrigin: `${C}px ${C}px` }} className="motion-safe:animate-orbit">
                <circle cx={C} cy={C} r={212} fill="none" className="stroke-white/15" strokeDasharray="2 10" />
                <circle cx={C} cy={28} r={5} className="fill-rcf-gold" />
                <circle cx={452} cy={C} r={3} className="fill-white/70" />
            </g>
            <g style={{ transformOrigin: `${C}px ${C}px` }} className="motion-safe:animate-orbit-reverse">
                <circle cx={C} cy={C} r={184} fill="none" className="stroke-white/10" />
                <circle cx={C} cy={424} r={4} className="fill-white/80" />
                <circle cx={56} cy={C} r={3} className="fill-rcf-gold/80" />
            </g>

            {/* Circuit traces: a faint track, and a pulse of light running along it. */}
            <g fill="none" strokeLinecap="round" strokeLinejoin="round">
                {TRACES.map((d, i) => (
                    <g key={d}>
                        <path d={d} className="stroke-white/20" strokeWidth={2} />
                        <path
                            d={d}
                            className="stroke-rcf-gold opacity-0 motion-safe:animate-trace motion-reduce:opacity-60"
                            strokeWidth={2.5}
                            strokeDasharray="60 240"
                            style={{ animationDelay: `${i * 1.3}s` }}
                        />
                    </g>
                ))}
            </g>
            <g className="fill-rcf-gold">
                <circle cx={440} cy={140} r={4} />
                <circle cx={452} cy={262} r={4} />
                <circle cx={440} cy={382} r={4} />
                <circle cx={40} cy={84} r={4} />
                <circle cx={40} cy={300} r={4} />
            </g>

            {/* The sphere and its streaks. */}
            <circle cx={C} cy={C} r={R} fill="url(#lg-sphere)" className="stroke-white/15" />
            <g fill="none" strokeLinecap="round">
                {STREAKS.map(([dy, reach]) => {
                    const { d, end } = streakPath(dy, reach);
                    return (
                        <g key={dy}>
                            <path d={d} className="stroke-white/55" strokeWidth={5} strokeDasharray="34 9" />
                            <circle cx={end[0]} cy={end[1]} r={5.5} className="fill-rcf-navy stroke-white/80" strokeWidth={2.5} />
                        </g>
                    );
                })}
            </g>

            {/* The cross: a soft bloom behind, the bright form in front. */}
            <g filter="url(#lg-blur)" className="fill-rcf-gold motion-safe:animate-glow">
                <rect x={C - 11} y={138} width={22} height={206} rx={11} />
                <rect x={C - 66} y={190} width={132} height={22} rx={11} />
            </g>
            <g fill="url(#lg-cross)">
                <rect x={C - 7} y={146} width={14} height={190} rx={7} />
                <rect x={C - 58} y={194} width={116} height={14} rx={7} />
            </g>
        </svg>
    );
}
