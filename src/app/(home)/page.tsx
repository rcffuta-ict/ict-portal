import type { Metadata } from "next";
import { Suspense } from "react";
import { Instrument_Serif } from "next/font/google";
import { LandingNav } from "./components/landing-nav";
import { Hero, HeroTenureChip, HeroTenureChipSkeleton } from "./components/hero";
import { TenureSection, TenureSectionSkeleton } from "./components/tenure-section";
import { PortalFeatures } from "./components/portal-features";
import { EventsPreview, EventsPreviewSkeleton } from "./components/events-preview";
import { Mission } from "./components/mission";
import { ClosingCta } from "./components/closing-cta";

// The editorial serif, loaded for this page only (self-hosted by next/font, one weight,
// latin subset). The `font-display` token in globals.css points at this variable.
const displaySerif = Instrument_Serif({
    weight: "400",
    style: ["normal", "italic"],
    subsets: ["latin"],
    display: "swap",
    variable: "--font-instrument-serif",
});

export const metadata: Metadata = {
    title: { absolute: "RCF FUTA ICT Portal — One Family. One Faith. One Digital Community." },
    description:
        "The official portal of the Redeemed Christian Fellowship, FUTA, built by the ICT Team: membership, units and zones, events and QR check-in, and Lo! — all shaped around each session.",
};

/**
 * The front door.
 *
 * A server component: the page's words and layout arrive as HTML in the first
 * response, so a student on a slow connection sees the whole page before any
 * JavaScript runs (the old page showed a full-screen loader until it hydrated).
 * The two pieces that read the database — the session and upcoming events — stream in
 * behind their own skeletons, so a slow query never holds the page up.
 */
export default function Home() {
    return (
        <div className={`${displaySerif.variable} bg-white`}>
            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-rcf-gold focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-rcf-navy"
            >
                Skip to content
            </a>
            <LandingNav />
            <main id="main">
                <Hero
                    tenureChip={
                        <Suspense fallback={<HeroTenureChipSkeleton />}>
                            <HeroTenureChip />
                        </Suspense>
                    }
                />
                <Suspense fallback={<TenureSectionSkeleton />}>
                    <TenureSection />
                </Suspense>
                <PortalFeatures />
                <Suspense fallback={<EventsPreviewSkeleton />}>
                    <EventsPreview />
                </Suspense>
                <Mission />
                <ClosingCta />
            </main>
        </div>
    );
}
