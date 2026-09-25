"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, LayoutDashboard, LogIn, Menu, X } from "lucide-react";
import { useProfileStore } from "@/lib/stores/profile.store";

const LINKS = [
    { href: "#session", label: "This session" },
    { href: "#portal", label: "The portal" },
    { href: "#events", label: "Events" },
    { href: "#team", label: "ICT Team" },
];

// False during SSR and the first client render, true after — so a signed-in member's
// "Dashboard" button (read from the persisted store) never causes a hydration mismatch.
const noopSubscribe = () => () => {};
function useHydrated() {
    return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/**
 * The landing header. It is the only part of the page that needs the browser: it
 * swaps "Sign in" for "Dashboard" when the device already holds a session, and owns
 * the phone menu. Everything else on the page is server-rendered.
 *
 * The session check here is cosmetic — the button just points somewhere different.
 * Whether the dashboard opens is decided on the server, as always.
 */
export function LandingNav() {
    const hydrated = useHydrated();
    const { user, userId } = useProfileStore();
    const signedIn = hydrated && (!!user || !!userId);
    const firstName = hydrated ? user?.profile?.firstName : undefined;

    const [open, setOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 12);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    return (
        <header
            className={`safe-top fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
                scrolled || open
                    ? "bg-rcf-navy/90 shadow-lg shadow-black/10 backdrop-blur-md"
                    : "bg-transparent"
            }`}
        >
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-20 lg:px-8">
                <Link
                    href="/"
                    className="shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-gold"
                    aria-label="RCF FUTA ICT Team — home"
                >
                    <Image
                        src="/logo/logo-alt-511x291_.png"
                        alt=""
                        width={511}
                        height={291}
                        priority
                        sizes="112px"
                        className="h-11 w-auto lg:h-14"
                    />
                </Link>

                <nav aria-label="Page sections" className="hidden items-center gap-1 md:flex">
                    {LINKS.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            className="rounded-full px-4 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-gold"
                        >
                            {link.label}
                        </a>
                    ))}
                </nav>

                <div className="flex items-center gap-2">
                    {signedIn ? (
                        <Link
                            href="/dashboard"
                            className="inline-flex h-10 items-center gap-2 rounded-full bg-rcf-gold px-4 text-sm font-bold text-rcf-navy shadow-lg shadow-black/20 transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-rcf-navy"
                        >
                            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                            <span className="hidden sm:inline">
                                {firstName ? `Hi, ${firstName}` : "Dashboard"}
                            </span>
                            <span className="sm:hidden">Dashboard</span>
                        </Link>
                    ) : (
                        <>
                            <Link
                                href="/login"
                                className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-gold"
                            >
                                <LogIn className="h-4 w-4" aria-hidden="true" />
                                Sign in
                            </Link>
                            <Link
                                href="/profile"
                                className="hidden h-10 items-center gap-1.5 rounded-full bg-rcf-gold px-4 text-sm font-bold text-rcf-navy shadow-lg shadow-black/20 transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-rcf-navy sm:inline-flex"
                            >
                                Join
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </Link>
                        </>
                    )}

                    <button
                        type="button"
                        onClick={() => setOpen((o) => !o)}
                        aria-expanded={open}
                        aria-controls="landing-menu"
                        aria-label={open ? "Close menu" : "Open menu"}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white ring-1 ring-white/25 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-gold md:hidden"
                    >
                        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
                    </button>
                </div>
            </div>

            {/* Phone menu: plain anchors, so it works before JS arrives too (the
                button just can't open it until then — the sections are a scroll away). */}
            <nav
                id="landing-menu"
                aria-label="Page sections"
                hidden={!open}
                className="border-t border-white/10 px-4 pb-5 pt-2 md:hidden"
            >
                <ul className="grid gap-1">
                    {LINKS.map((link) => (
                        <li key={link.href}>
                            <a
                                href={link.href}
                                onClick={() => setOpen(false)}
                                className="flex h-12 items-center rounded-xl px-3 text-base font-medium text-white/85 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-rcf-gold"
                            >
                                {link.label}
                            </a>
                        </li>
                    ))}
                    {!signedIn && (
                        <li className="pt-2">
                            <Link
                                href="/profile"
                                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-rcf-gold text-base font-bold text-rcf-navy"
                            >
                                Register as a member
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </Link>
                        </li>
                    )}
                </ul>
            </nav>
        </header>
    );
}
