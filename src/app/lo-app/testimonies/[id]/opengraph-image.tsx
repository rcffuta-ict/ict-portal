import { ImageResponse } from "next/og";
import { getPublicTestimonyForCard } from "../actions";
import { categoryLabel, testimonyExcerpt } from "@/lib/testimonies";

/**
 * The preview card a testimony link shows in WhatsApp, X and friends.
 *
 * Only an APPROVED testimony gets its own card, and only what its public page shows:
 * an anonymous testimony reads "Anonymous" here too. Anything else (pending, hidden,
 * a mistyped id) gets a plain Lo! card, so an unpublished post can never leak through
 * its image URL. Crawlers fetch this without cookies, so it never looks at a session.
 */
export const alt = "A testimony shared on Lo! — RCF FUTA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Re-drawn at most hourly; an edit or a hide shows on the next crawl after that.
export const revalidate = 3600;

// The brand tokens from globals.css (--color-rcf-navy / -navy-light / -gold). An image
// route can't read CSS variables, so they are repeated here — keep them in step.
const NAVY = "#181240";
const NAVY_LIGHT = "#2a2257";
const GOLD = "#fbbf24";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const testimony = await getPublicTestimonyForCard(id).catch(() => null);

    const title = testimony?.title ?? "Testimonies on Lo!";
    const excerpt = testimony
        ? testimonyExcerpt(testimony.body, 220)
        : "What God has done among us at RCF FUTA — shared by members.";

    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "64px 72px",
                    background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_LIGHT} 100%)`,
                    color: "white",
                    fontFamily: "sans-serif",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                        <span style={{ fontSize: 52, fontWeight: 800, color: GOLD }}>Lo!</span>
                        <span style={{ fontSize: 24, color: "rgba(255,255,255,0.7)" }}>Testimony</span>
                    </div>
                    {testimony && (
                        <span
                            style={{
                                fontSize: 22,
                                fontWeight: 700,
                                color: NAVY,
                                background: GOLD,
                                padding: "8px 20px",
                                borderRadius: 999,
                            }}
                        >
                            {categoryLabel(testimony.category)}
                        </span>
                    )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    <div style={{ fontSize: title.length > 60 ? 52 : 64, fontWeight: 800, lineHeight: 1.1 }}>
                        {title}
                    </div>
                    <div style={{ fontSize: 28, lineHeight: 1.4, color: "rgba(255,255,255,0.82)" }}>
                        {excerpt}
                    </div>
                </div>

                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 24,
                        color: "rgba(255,255,255,0.7)",
                        borderTop: "1px solid rgba(255,255,255,0.15)",
                        paddingTop: 24,
                    }}
                >
                    <span>
                        {testimony
                            ? `${testimony.authorName}${testimony.scriptureReference ? ` · ${testimony.scriptureReference}` : ""}`
                            : "RCF FUTA"}
                    </span>
                    <span style={{ color: GOLD, fontWeight: 700 }}>ict.rcffuta.com/lo-app</span>
                </div>
            </div>
        ),
        size,
    );
}
