/**
 * Sunday reading cycle calculations for Lo! testimonies.
 *
 * Testimonies are collected in weekly cycles to be read at Sunday service:
 *   - The weekly reading window runs from one Sunday cut-off to the next Sunday cut-off.
 *   - The default cut-off is Sunday at 09:00 AM West Africa Time (WAT, UTC+1).
 *   - The General Secretary or Lo! moderators can temporarily adjust the cut-off for today's service.
 *   - "This Week" continuously represents the reading for the current cycle until Sunday midnight,
 *     after which Monday rolls over to the next Sunday.
 */

export type TestimonyCycleId = "this_week" | "last_week" | "two_weeks_ago" | "older" | "all";

export interface CycleRange {
    id: TestimonyCycleId;
    label: string;
    /** Human-readable description, e.g. "Sunday, Nov 8" */
    sundayLabel: string;
    start: Date | null;
    end: Date | null;
}

export interface TestimonyCycleSettings {
    cutoffTime: string; // "HH:mm" in WAT (e.g. "09:00")
    currentOverrideCutoff: string | null; // ISO string if overridden
}

export const DEFAULT_CYCLE_SETTINGS: TestimonyCycleSettings = {
    cutoffTime: "09:00",
    currentOverrideCutoff: null,
};

const WAT_OFFSET_HOURS = 1;

/**
 * Convert a Date to a date breakdown in West Africa Time (UTC+1).
 */
export function getWatDateBreakdown(date: Date) {
    const watTime = new Date(date.getTime() + WAT_OFFSET_HOURS * 60 * 60 * 1000);
    return {
        year: watTime.getUTCFullYear(),
        month: watTime.getUTCMonth(),
        day: watTime.getUTCDate(),
        dayOfWeek: watTime.getUTCDay(), // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    };
}

/**
 * Construct a UTC Date corresponding to a specific year, month, day, and time in WAT.
 */
export function createWatDate(year: number, month: number, day: number, hours: number, minutes: number): Date {
    // Subtract WAT offset (1 hour) to produce the corresponding UTC Date
    return new Date(Date.UTC(year, month, day, hours - WAT_OFFSET_HOURS, minutes, 0, 0));
}

/**
 * Parse an "HH:mm" time string into hours and minutes.
 */
export function parseTimeString(timeStr?: string | null): { hours: number; minutes: number } {
    if (!timeStr) return { hours: 9, minutes: 0 };
    const parts = timeStr.split(":");
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    return {
        hours: isNaN(hours) ? 9 : hours,
        minutes: isNaN(minutes) ? 0 : minutes,
    };
}

const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatSundayDate(date: Date): string {
    const wat = getWatDateBreakdown(date);
    return `Sun, ${MONTH_NAMES[wat.month]} ${wat.day}`;
}

/**
 * Calculate the Sunday reading cycles for a given moment in time.
 */
export function computeTestimonyCycles(
    now: Date = new Date(),
    settings: TestimonyCycleSettings = DEFAULT_CYCLE_SETTINGS,
): {
    current: CycleRange;
    last: CycleRange;
    twoWeeksAgo: CycleRange;
    older: CycleRange;
    allCycles: CycleRange[];
    effectiveCutoff: Date;
} {
    const wat = getWatDateBreakdown(now);
    const daysToSunday = wat.dayOfWeek === 0 ? 0 : 7 - wat.dayOfWeek;

    // The reference Sunday in WAT
    const refSundayMidnight = new Date(Date.UTC(wat.year, wat.month, wat.day + daysToSunday));
    const refYear = refSundayMidnight.getUTCFullYear();
    const refMonth = refSundayMidnight.getUTCMonth();
    const refDay = refSundayMidnight.getUTCDate();

    const { hours: defaultHours, minutes: defaultMinutes } = parseTimeString(settings.cutoffTime);

    // Compute standard cut-off for the reference Sunday
    const defaultRefCutoff = createWatDate(refYear, refMonth, refDay, defaultHours, defaultMinutes);

    // If an override is set and falls within the reference Sunday (in WAT), use it
    let effectiveRefCutoff = defaultRefCutoff;
    if (settings.currentOverrideCutoff) {
        const overrideDate = new Date(settings.currentOverrideCutoff);
        const overrideWat = getWatDateBreakdown(overrideDate);
        if (
            overrideWat.year === refYear &&
            overrideWat.month === refMonth &&
            overrideWat.day === refDay
        ) {
            effectiveRefCutoff = overrideDate;
        }
    }

    // Previous Sunday cut-off (S - 7 days)
    const prevSundayCutoff = createWatDate(refYear, refMonth, refDay - 7, defaultHours, defaultMinutes);

    // Two Sundays ago cut-off (S - 14 days)
    const twoSundaysAgoCutoff = createWatDate(refYear, refMonth, refDay - 14, defaultHours, defaultMinutes);

    // Three Sundays ago cut-off (S - 21 days)
    const threeSundaysAgoCutoff = createWatDate(refYear, refMonth, refDay - 21, defaultHours, defaultMinutes);

    const refSundayDateObj = createWatDate(refYear, refMonth, refDay, 12, 0);
    const prevSundayDateObj = createWatDate(refYear, refMonth, refDay - 7, 12, 0);
    const twoSundaysAgoDateObj = createWatDate(refYear, refMonth, refDay - 14, 12, 0);

    const current: CycleRange = {
        id: "this_week",
        label: "This Sunday",
        sundayLabel: formatSundayDate(refSundayDateObj),
        start: prevSundayCutoff,
        end: effectiveRefCutoff,
    };

    const last: CycleRange = {
        id: "last_week",
        label: "Last Sunday",
        sundayLabel: formatSundayDate(prevSundayDateObj),
        start: twoSundaysAgoCutoff,
        end: prevSundayCutoff,
    };

    const twoWeeksAgo: CycleRange = {
        id: "two_weeks_ago",
        label: "2 Weeks Ago",
        sundayLabel: formatSundayDate(twoSundaysAgoDateObj),
        start: threeSundaysAgoCutoff,
        end: twoSundaysAgoCutoff,
    };

    const older: CycleRange = {
        id: "older",
        label: "Older",
        sundayLabel: "Previous cycles",
        start: null,
        end: threeSundaysAgoCutoff,
    };

    const all: CycleRange = {
        id: "all",
        label: "All Time",
        sundayLabel: "All testimonies",
        start: null,
        end: null,
    };

    return {
        current,
        last,
        twoWeeksAgo,
        older,
        allCycles: [current, last, twoWeeksAgo, older, all],
        effectiveCutoff: effectiveRefCutoff,
    };
}
