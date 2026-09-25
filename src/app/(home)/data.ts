import { cache } from "react";
import { connection } from "next/server";
import { getActiveTenure } from "@/utils/action";
import { getEvents } from "@/app/events/actions";
import { isCoronated } from "@/lib/tenure";
import { parsePalette, type Palette } from "@/lib/palette";
import {
    formatLocationLine,
    getEventLocation,
    isEventUpcoming,
    parseEventDate,
    type EventRecord,
} from "@/lib/event-utils";

/**
 * What the landing page reads, and nothing more.
 *
 * Deliberately NOT a "use server" file: these are plain server functions called by the
 * page's server components, so they add no new callable endpoint. Each one narrows the
 * rows to the handful of display fields the page shows — only those are rendered, and
 * only those can ever be serialised into a client component's props.
 */

/** Where the fellowship is in its year. Drives the tenure cycle on the page. */
export type TenureStage = "between" | "awaiting" | "serving" | "closing";

export interface LandingTenure {
    session: string;
    theme: string | null;
    themeText: string | null;
    bannerUrl: string | null;
    iconUrl: string | null;
    palette: Palette | null;
    coronatedOn: string | null;
    crowned: boolean;
    /** 1-based day of the session, counted from its start date. */
    day: number;
    /** 0–1 through the session, or null when it has no end date to measure against. */
    progress: number | null;
    stage: TenureStage;
}

/** Past this share of the session, the page starts talking about handover. */
const CLOSING_AT = 0.85;

export const getLandingTenure = cache(async (): Promise<LandingTenure | null> => {
    // Read per request: the tenure changes at handover and coronation, and a cached
    // landing page would keep announcing the old session.
    await connection();

    const tenure = await getActiveTenure();
    if (!tenure) return null;

    const now = Date.now();
    const start = new Date(tenure.start_date).getTime();
    const end = tenure.end_date ? new Date(tenure.end_date).getTime() : null;
    const day = Math.max(1, Math.floor((now - start) / 86_400_000) + 1);
    const progress =
        end && end > start ? Math.min(1, Math.max(0, (now - start) / (end - start))) : null;
    const crowned = isCoronated(tenure);

    return {
        session: tenure.session,
        theme: crowned ? tenure.theme!.trim() : null,
        themeText: tenure.theme_text?.trim() || null,
        bannerUrl: tenure.theme_banner_url || null,
        iconUrl: tenure.theme_icon_url || null,
        // parsePalette re-validates every value as strict #rrggbb, which is what makes
        // it safe to hand to inline styles.
        palette: parsePalette(tenure.theme_palette),
        coronatedOn: tenure.coronated_on || null,
        crowned,
        day,
        progress,
        stage: !crowned
            ? "awaiting"
            : progress !== null && progress >= CLOSING_AT
                ? "closing"
                : "serving",
    };
});

export interface LandingEvent {
    slug: string;
    title: string;
    /** ISO timestamp; formatted in Lagos time by the card. */
    date: string;
    location: string;
    isRecurring: boolean;
}

export type LandingEvents =
    | { ok: true; events: LandingEvent[] }
    | { ok: false };

/** The next few events that haven't started yet, soonest first. */
export async function getUpcomingEvents(limit = 3): Promise<LandingEvents> {
    await connection();

    const result = await getEvents();
    if (!result.success) return { ok: false };

    const now = new Date();
    const events = ((result.data ?? []) as EventRecord[])
        .map((event) => ({ event, at: parseEventDate(event.date) }))
        .filter(({ at }) => isEventUpcoming(at, now))
        .sort((a, b) => a.at!.getTime() - b.at!.getTime())
        .slice(0, limit)
        .map(({ event, at }) => ({
            slug: event.slug,
            title: event.title,
            date: at!.toISOString(),
            location: formatLocationLine(getEventLocation(event.config)),
            isRecurring: event.is_recurring,
        }));

    return { ok: true, events };
}
