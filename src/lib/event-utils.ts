/**
 * Shared helpers for the generic `events` feature.
 *
 * Every date/time shown for an event is rendered in **Africa/Lagos**, not in the
 * viewer's local timezone. Events happen physically on FUTA campus, so "10:00 AM"
 * must mean 10:00 AM in Akure regardless of where the phone thinks it is — and
 * pinning the zone also keeps server-rendered and client-rendered output identical,
 * which avoids hydration mismatches.
 */

export const EVENT_TIME_ZONE = "Africa/Lagos";
export const EVENT_TIME_ZONE_LABEL = "WAT";

/** Location lives inside the event's `config` JSONB — no schema migration needed. */
export interface EventLocation {
    venue: string;
    address?: string;
    mapUrl?: string;
}

export interface EventRegistrationConfig {
    enabled: boolean;
    fields: string[];
    allowGuest?: boolean;
    allowAlumni?: boolean;
    allowStudents?: boolean;
}

export interface EventConfig {
    registration?: Partial<EventRegistrationConfig>;
    location?: Partial<EventLocation>;
    /**
     * The unit running the event, by its immutable slug. Its leadership (every holder of
     * `EXCO:<slug>`, lead or assistant) gets the event's admin console alongside the
     * System Admin, the VPs and the President. See src/lib/event-access.ts.
     */
    unit?: string | null;
    [key: string]: unknown;
}

export interface EventRecord {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    date: string;
    is_active: boolean;
    is_recurring: boolean;
    is_exclusive: boolean;
    created_at: string;
    config: Record<string, unknown> | null;
}

/* -------------------------------------------------------------------------- */
/* Config readers                                                             */
/* -------------------------------------------------------------------------- */

export function getRegistrationConfig(
    config: Record<string, unknown> | null | undefined,
): EventRegistrationConfig {
    const raw = (config as EventConfig | null | undefined)?.registration;
    return {
        enabled: !!raw?.enabled,
        fields: Array.isArray(raw?.fields) ? raw.fields : [],
        allowGuest: raw?.allowGuest ?? true,
        allowAlumni: raw?.allowAlumni ?? true,
        allowStudents: raw?.allowStudents ?? true,
    };
}

/** The slug of the unit running the event, or null when none is assigned. */
export function getEventUnitSlug(config: Record<string, unknown> | null | undefined): string | null {
    const raw = (config as EventConfig | null | undefined)?.unit;
    return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

/** Returns null when no venue has been set, so callers can hide the block entirely. */
export function getEventLocation(
    config: Record<string, unknown> | null | undefined,
): EventLocation | null {
    const raw = (config as EventConfig | null | undefined)?.location;
    const venue = raw?.venue?.trim();
    if (!venue) return null;

    return {
        venue,
        address: raw?.address?.trim() || undefined,
        mapUrl: raw?.mapUrl?.trim() || undefined,
    };
}

/** One-line rendering of a location, for cards and compact summaries. */
export function formatLocationLine(location: EventLocation | null): string {
    if (!location) return "Venue to be announced";
    return location.address
        ? `${location.venue} — ${location.address}`
        : location.venue;
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                       */
/* -------------------------------------------------------------------------- */

/** A bare "YYYY-MM-DD" with no time component. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `events.date` used to be a Postgres `date` column, so rows written before
 * migration 0009 come back as a bare "YYYY-MM-DD". `new Date("2026-09-12")`
 * parses that as UTC midnight, which renders as 1:00 AM in Lagos — the phantom
 * time this project kept showing. Read a date-only value as Lagos midnight
 * instead, so a legacy row reads 12:00 AM and re-saving it doesn't drift.
 */
export function parseEventDate(value: string | null | undefined): Date | null {
    if (!value) return null;

    const normalized = DATE_ONLY.test(value)
        ? fromDateTimeLocalValue(`${value}T00:00`)
        : value;

    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** True when the stored value carries no time of day (legacy date-only row). */
export function isDateOnlyEventValue(value: string | null | undefined): boolean {
    return !!value && DATE_ONLY.test(value);
}

function formatIn(date: Date, options: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat("en-NG", {
        timeZone: EVENT_TIME_ZONE,
        ...options,
    }).format(date);
}

/** "Saturday, 12 September 2026" */
export function formatEventDate(date: Date | null): string {
    if (!date) return "Date to be announced";
    return formatIn(date, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

/** "12 Sep 2026" — for cards and tables. */
export function formatEventShortDate(date: Date | null): string {
    if (!date) return "TBA";
    return formatIn(date, { day: "numeric", month: "short", year: "numeric" });
}

/** "10:00 AM" (always Lagos wall-clock). */
export function formatEventTime(date: Date | null): string {
    if (!date) return "Time to be announced";
    return formatIn(date, { hour: "numeric", minute: "2-digit", hour12: true });
}

/** "10:00 AM WAT" */
export function formatEventTimeWithZone(date: Date | null): string {
    if (!date) return "Time to be announced";
    return `${formatEventTime(date)} ${EVENT_TIME_ZONE_LABEL}`;
}

/** "12 Sep 2026, 10:00 AM" — compact single line. */
export function formatEventDateTime(date: Date | null): string {
    if (!date) return "Date to be announced";
    return `${formatEventShortDate(date)}, ${formatEventTime(date)}`;
}

/** Pieces for the little calendar-tile on a card. */
export function getEventDateParts(date: Date | null) {
    if (!date) return { weekday: "TBA", day: "--", month: "---" };
    return {
        weekday: formatIn(date, { weekday: "short" }).toUpperCase(),
        day: formatIn(date, { day: "2-digit" }),
        month: formatIn(date, { month: "short" }).toUpperCase(),
    };
}

/**
 * Upcoming means "has not started yet". The old check compared against the start
 * of today, which kept an event that finished this morning labelled "Upcoming".
 */
export function isEventUpcoming(date: Date | null, now: Date = new Date()): boolean {
    if (!date) return false;
    return date.getTime() > now.getTime();
}

/** True while the event day is the current day in Lagos. */
export function isEventToday(date: Date | null, now: Date = new Date()): boolean {
    if (!date) return false;
    const key = (d: Date) => formatIn(d, { year: "numeric", month: "2-digit", day: "2-digit" });
    return key(date) === key(now);
}

/* -------------------------------------------------------------------------- */
/* <input type="datetime-local"> bridging                                      */
/* -------------------------------------------------------------------------- */

/** Milliseconds that `timeZone` is ahead of UTC at the given instant. */
function zoneOffsetMs(date: Date, timeZone: string): number {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).formatToParts(date);

    const get = (type: Intl.DateTimeFormatPartTypes) =>
        Number(parts.find((p) => p.type === type)?.value ?? "0");

    const asUtc = Date.UTC(
        get("year"),
        get("month") - 1,
        get("day"),
        get("hour") % 24,
        get("minute"),
        get("second"),
    );

    return asUtc - date.getTime();
}

/**
 * ISO instant -> "YYYY-MM-DDTHH:mm" as Lagos wall-clock.
 *
 * The previous implementation used `toISOString().slice(0, 16)`, which fed the
 * input a *UTC* clock. Every edit-and-save round trip therefore walked the event
 * an hour earlier.
 */
export function toDateTimeLocalValue(value: string | Date | null | undefined): string {
    const date = value instanceof Date ? value : parseEventDate(value);
    if (!date) return "";

    const shifted = new Date(date.getTime() + zoneOffsetMs(date, EVENT_TIME_ZONE));
    return shifted.toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" typed as Lagos wall-clock -> ISO instant. */
export function fromDateTimeLocalValue(value: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
    if (!match) return new Date(value).toISOString();

    const [, y, m, d, h, min] = match;
    const naive = Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h), Number(min));
    // Lagos has no DST, so a single offset lookup is exact.
    const offset = zoneOffsetMs(new Date(naive), EVENT_TIME_ZONE);
    return new Date(naive - offset).toISOString();
}

/* -------------------------------------------------------------------------- */
/* Levels                                                                      */
/* -------------------------------------------------------------------------- */

/** Canonical ordering for anything that groups registrants by level. */
export const EVENT_LEVEL_ORDER = [
    "100L",
    "200L",
    "300L",
    "400L",
    "500L",
    "Postgraduate",
    "Alumni",
    "Guest",
] as const;

export type EventLevel = (typeof EVENT_LEVEL_ORDER)[number];

export function levelOptionsFor(config: EventRegistrationConfig): string[] {
    const levels: string[] = [];
    if (config.allowStudents) {
        levels.push("100L", "200L", "300L", "400L", "500L", "Postgraduate");
    }
    if (config.allowAlumni) levels.push("Alumni");
    if (config.allowGuest) levels.push("Guest");
    return levels;
}

/** Human label for a stored level value. */
export function levelLabel(level: string | null | undefined): string {
    if (!level) return "Unspecified";
    switch (level) {
        case "100L":
            return "100 Level";
        case "200L":
            return "200 Level";
        case "300L":
            return "300 Level";
        case "400L":
            return "400 Level";
        case "500L":
            return "500 Level";
        default:
            return level;
    }
}

/** Sorts level keys by `EVENT_LEVEL_ORDER`, unknown values last (alphabetical). */
export function compareLevels(a: string, b: string): number {
    const order = EVENT_LEVEL_ORDER as readonly string[];
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
}
