"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@/src/lib/supabase/client";

interface LevelCount {
    level: string;
    count: number;
}
interface StatsData {
    total: number;
    levels: LevelCount[];
    eventTitle: string;
    brothers: number;
    sisters: number;
}

const LEVEL_LABELS: Record<string, string> = {
    "100": "100 Level",
    "200": "200 Level",
    "300": "300 Level",
    "400": "400 Level",
    "500": "500 Level",
};
const MEDALS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];

function AnimatedNumber({ value }: { value: number }) {
    const [display, setDisplay] = useState(0);
    const prevRef = useRef(0);
    useEffect(() => {
        const start = prevRef.current;
        const diff = value - start;
        if (diff === 0) return;
        const duration = 900;
        const startTime = Date.now();
        const step = () => {
            const p = Math.min((Date.now() - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplay(Math.round(start + diff * eased));
            if (p < 1) requestAnimationFrame(step);
            else prevRef.current = value;
        };
        requestAnimationFrame(step);
    }, [value]);
    return <>{display}</>;
}

function SkeletonCard({ delay = 0 }: { delay?: number }) {
    return (
        <div className="skel-card" style={{ animationDelay: `${delay}s` }} />
    );
}

export default function StatsPage() {
    const [stats, setStats] = useState<StatsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    async function fetchStats() {
        const res = await fetch("/api/stats", { cache: "no-store" });
        if (res.ok) {
            setStats(await res.json());
            setLastUpdated(new Date());
            setIsLoading(false);
        }
    }

    useEffect(() => {
        fetchStats();
        intervalRef.current = setInterval(fetchStats, 30_000);
        const supabase = createBrowserClient();
        const channel = supabase
            .channel("oracle-channel")
            .on("broadcast", { event: "stats:update" }, fetchStats)
            .subscribe();
        return () => {
            clearInterval(intervalRef.current!);
            supabase.removeChannel(channel);
        };
    }, []);

    const sortedLevels = stats
        ? [...stats.levels].sort((a, b) => b.count - a.count)
        : [];
    const leadingLevel = sortedLevels[0];
    const total = stats?.total ?? 0;
    const brothers = stats?.brothers ?? 0;
    const sisters = stats?.sisters ?? 0;
    const brotherPct = total ? Math.round((brothers / total) * 100) : 50;
    const sisterPct = total ? Math.round((sisters / total) * 100) : 50;

    return (
        <div className="stats-page">
            <div className="stats-glow stats-glow--purple" />
            <div className="stats-glow stats-glow--blue" />

            {/* Header */}
            <div className="stats-header">
                <div className="stats-header__logo">
                    <img
                        src="/images/Logo/logo.png"
                        alt="RCF FUTA"
                        width={56}
                        height={56}
                        className="mx-auto"
                        style={{ width: "auto", height: "56px" }}
                    />
                </div>
                <h1 className="stats-header__title">
                    {stats?.eventTitle || "Combined Family Meeting"}
                </h1>
                <p className="stats-header__sub">
                    Live Registration Scoreboard
                </p>
                <div className="stats-live-badge">
                    <span className="stats-live-badge__dot" /> LIVE
                </div>
            </div>

            {isLoading ? (
                <div className="stats-skel-wrap">
                    {[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6].map((d, i) => (
                        <SkeletonCard key={i} delay={d} />
                    ))}
                </div>
            ) : (
                <div className="stats-content-grid">
                    {/* Total Counter */}

                    {/* Level Leaderboard */}
                    <section className="stats-section">
                        <h2 className="stats-section__title">
                            🏆 Level Leaderboard
                        </h2>
                        <div className="stats-leaderboard">
                            {sortedLevels.map(({ level, count }, i) => {
                                const pct = total
                                    ? Math.round((count / total) * 100)
                                    : 0;
                                return (
                                    <div
                                        key={level}
                                        className={`stats-level-row${i === 0 ? " stats-level-row--leader" : ""}`}
                                        style={{
                                            animationDelay: `${i * 0.08}s`,
                                        }}
                                    >
                                        <div className="stats-level-row__medal mr-2">
                                            {MEDALS[i] ?? "·"}
                                        </div>
                                        <div className="stats-level-row__info">
                                            <div className="stats-level-row__name">
                                                {LEVEL_LABELS[level] ?? level}
                                                {i === 0 && (
                                                    <span className="stats-level-row__crown">
                                                        {" "}
                                                        👑
                                                    </span>
                                                )}
                                            </div>
                                            <div className="stats-level-row__bar-track">
                                                <div
                                                    className="stats-level-row__bar-fill"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="stats-level-row__right">
                                            <span className="stats-level-row__count">
                                                <AnimatedNumber value={count} />
                                            </span>
                                            <span className="stats-level-row__pct">
                                                {pct}%
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="stats-total">
                                <div className="stats-total__number">
                                    <AnimatedNumber value={total} />
                                </div>
                                <div className="stats-total__label">
                                    Members Registered 🎉
                                </div>
                                {leadingLevel && leadingLevel.count > 0 && (
                                    <div className="stats-total__leading">
                                        🔥{" "}
                                        <strong>
                                            {LEVEL_LABELS[leadingLevel.level]}
                                        </strong>{" "}
                                        is leading with {leadingLevel.count}{" "}
                                        registrations!
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* Gender Stats */}
                    <section className="stats-section">
                        <h2 className="stats-section__title">
                            Gender Breakdown
                        </h2>
                        <div className="stats-battle">
                            <div className="stats-battle__side">
                                <div className="stats-battle__icon">👨</div>
                                <div className="stats-battle__name">
                                    Brothers
                                </div>
                                <div className="stats-battle__count">
                                    <AnimatedNumber value={brothers} />
                                </div>
                                <div className="stats-battle__pct">
                                    {brotherPct}%
                                </div>
                            </div>

                            <div className="stats-battle__center">
                                <div className="stats-battle__bar-track">
                                    <div
                                        className="stats-battle__bar-brothers"
                                        style={{ width: `${brotherPct}%` }}
                                    />
                                </div>
                            </div>

                            <div className="stats-battle__side stats-battle__side--right">
                                <div className="stats-battle__icon">👩</div>
                                <div className="stats-battle__name">
                                    Sisters
                                </div>
                                <div className="stats-battle__count">
                                    <AnimatedNumber value={sisters} />
                                </div>
                                <div className="stats-battle__pct">
                                    {sisterPct}%
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {lastUpdated && (
                <p className="stats-updated">
                    Updated{" "}
                    {lastUpdated.toLocaleTimeString("en-NG", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                    })}
                </p>
            )}
        </div>
    );
}
