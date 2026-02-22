"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useProfileStore } from "@/src/lib/stores/profile.store";

export default function UserDashboard() {
    const router = useRouter();
    const session = useProfileStore((state) => state.session);
    const clearSession = useProfileStore((state) => state.clearSession);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 50);
        return () => clearTimeout(t);
    }, []);

    async function handleLogout() {
        await fetch("/api/auth/logout", { method: "POST" });
        clearSession();
        router.push("/login");
        router.refresh();
    }

    if (!session) return null;

    const { profile, raffleId, eventTitle, eventDate } = session;
    const firstName = profile.profile.firstName;
    const lastName = profile.profile.lastName;
    const fullName = `${firstName} ${lastName}`;
    const initials =
        `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
    const level = profile.academics?.currentLevel ?? "?";
    const unit = profile.unit?.name ?? profile.teams?.[0]?.name ?? null;
    const raffleStr = raffleId ? String(raffleId) : "——";
    const formattedDate = eventDate
        ? new Date(eventDate).toLocaleDateString("en-NG", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
          })
        : "";

    return (
        <div className={`dashboard ${visible ? "dashboard--visible" : ""}`}>
            <div className="dash-glow dash-glow--purple" />
            <div className="dash-glow dash-glow--blue" />
            <div className="dash-glow dash-glow--gold" />

            {/* Sticky Header */}
            <header className="dash-header">
                <div className="dash-logo">
                    <img
                        src="/images/Logo/logo.png"
                        alt="RCF FUTA"
                        width={70}
                        height={60}
                    />
                </div>
                <button className="dash-logout ml-auto" onClick={handleLogout}>
                    Sign Out
                </button>
            </header>

            <main className="dash-main">
                {/* Event Banner */}
                <div className="event-banner">
                    <span className="event-banner__bolt">⚡</span>
                    <div className="event-banner__content">
                        <p className="event-banner__eyebrow">
                            You&apos;re registered for
                        </p>
                        <h1 className="event-banner__title">
                            {eventTitle || "Combined Family Meeting"}
                        </h1>
                        {formattedDate && (
                            <p className="event-banner__date">
                                {formattedDate}
                            </p>
                        )}
                    </div>
                    <span className="event-banner__bolt">⚡</span>
                </div>

                {/* Player Card */}
                <div className="player-card">
                    <div className="player-card__header">
                        <div className="player-avatar">{initials}</div>
                        <div className="player-info">
                            <p className="player-info__name">{fullName}</p>
                            <div className="player-info__badges">
                                <span className="player-badge player-badge--level">
                                    ⚡ {level} Level
                                </span>
                                {unit && (
                                    <span className="player-badge player-badge--unit">
                                        {unit}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="player-hype">
                        🏆 <strong>You&apos;re in the running!</strong> The
                        Oracle picks from all registered members — stay glued to
                        the screen!
                    </div>
                </div>

                {/* Raffle Ticket */}
                <div className="raffle-ticket">
                    <div className="raffle-ticket__header">
                        <span>🎫</span>
                        <span className="raffle-ticket__label">
                            YOUR Oracle ID
                        </span>
                    </div>
                    <div className="raffle-ticket__number">
                        {raffleStr.split("").map((digit, i) => (
                            <span
                                key={i}
                                className="raffle-ticket__digit"
                                style={{ animationDelay: `${i * 0.07}s` }}
                            >
                                {digit}
                            </span>
                        ))}
                    </div>
                    <div className="raffle-ticket__tear" />
                    <p className="raffle-ticket__caption">
                        May the odds be ever in your favour 🙏
                    </p>
                </div>

                {/* Quick Links */}
                <div className="dash-links">
                    <a href="/oracle" className="dash-link dash-link--oracle">
                        <span className="dash-link__icon">🎰</span>
                        <span className="dash-link__text">
                            <strong>Oracle Screen</strong>
                            <br />
                            <small>Watch live picks</small>
                        </span>
                    </a>
                    <a
                        href="/oracle/stats"
                        className="dash-link dash-link--stats"
                    >
                        <span className="dash-link__icon">📊</span>
                        <span className="dash-link__text">
                            <strong>Live Stats</strong>
                            <br />
                            <small>See scoreboard</small>
                        </span>
                    </a>
                </div>
            </main>
        </div>
    );
}
