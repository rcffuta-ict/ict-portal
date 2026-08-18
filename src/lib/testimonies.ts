/**
 * Shared testimony types and labels.
 *
 * Client-safe on purpose — no `next/headers`, no service-role client — so both the
 * feed components and the server actions can import it.
 */

export type TestimonyStatus = "pending" | "approved" | "rejected" | "hidden";

export type TestimonyCategory =
    | "healing"
    | "provision"
    | "academics"
    | "salvation"
    | "protection"
    | "family"
    | "answered_prayer"
    | "other";

export const TESTIMONY_CATEGORIES: {
    id: TestimonyCategory;
    label: string;
    /** Shown in the composer to help someone pick quickly. */
    hint: string;
}[] = [
    { id: "answered_prayer", label: "Answered prayer", hint: "A prayer God answered" },
    { id: "academics", label: "Academics", hint: "Exams, projects, results" },
    { id: "provision", label: "Provision", hint: "Fees, needs, open doors" },
    { id: "healing", label: "Healing", hint: "Health restored" },
    { id: "protection", label: "Protection", hint: "Kept safe from harm" },
    { id: "salvation", label: "Salvation", hint: "A life given to Christ" },
    { id: "family", label: "Family", hint: "Home and relationships" },
    { id: "other", label: "Other", hint: "Anything else God did" },
];

export function categoryLabel(category: string): string {
    return TESTIMONY_CATEGORIES.find((c) => c.id === category)?.label || "Other";
}

/** What the client receives — never the raw row (see `toPublicTestimony`). */
export interface Testimony {
    id: string;
    title: string;
    body: string;
    category: TestimonyCategory;
    scriptureReference: string | null;
    /** "Anonymous" unless the viewer is the author or a moderator. */
    authorName: string;
    isAnonymous: boolean;
    /** True when the viewer posted this — unlocks seeing its pending/rejected state. */
    isOwn: boolean;
    eventId: string | null;
    status: TestimonyStatus;
    /** A moderator's note; only ever sent to the author or a moderator. */
    reviewNote: string | null;
    publishedAt: string | null;
    createdAt: string;
    shareCount: number;
    amenCount: number;
    viewerHasAmened: boolean;
}

/** First ~180 characters, cut on a word boundary — for cards and link previews. */
export function testimonyExcerpt(body: string, length = 180): string {
    const clean = body.replace(/\s+/g, " ").trim();
    if (clean.length <= length) return clean;

    const cut = clean.slice(0, length);
    const lastSpace = cut.lastIndexOf(" ");
    return `${cut.slice(0, lastSpace > 80 ? lastSpace : length).trimEnd()}…`;
}
