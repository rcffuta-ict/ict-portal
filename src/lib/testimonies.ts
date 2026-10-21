/**
 * Shared testimony types and labels.
 *
 * Client-safe on purpose — no `next/headers`, no service-role client — so both the
 * feed components and the server actions can import it.
 */

import { z } from "zod";

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
    /** Pinned to the top of the feed by a moderator. Only ever true when approved. */
    isFeatured: boolean;
    /** Set when a moderator corrected the text; the author is told. */
    editedAt: string | null;
}

/** Feed page size — small enough for mobile data, big enough to read for a while. */
export const TESTIMONY_PAGE_SIZE = 20;

/** Moderation queue page size. */
export const REVIEW_PAGE_SIZE = 30;

/**
 * What a moderator may change before publishing. Mirrors the CHECK constraints on
 * `testimonies` (title 3-120, body 20-5000, a known category), so a form that passes
 * this never meets a database error. Shared by the edit form and the server action.
 */
export const testimonyEditSchema = z.object({
    title: z.string().trim().min(3, "At least 3 characters.").max(120, "120 characters at most."),
    body: z.string().trim().min(20, "At least 20 characters.").max(5000, "5000 characters at most."),
    category: z.enum(TESTIMONY_CATEGORIES.map((c) => c.id) as [TestimonyCategory, ...TestimonyCategory[]]),
    scriptureReference: z.string().trim().max(80, "80 characters at most.").optional(),
});

export type TestimonyEdit = z.infer<typeof testimonyEditSchema>;

/** First ~180 characters, cut on a word boundary — for cards and link previews. */
export function testimonyExcerpt(body: string, length = 180): string {
    const clean = body.replace(/\s+/g, " ").trim();
    if (clean.length <= length) return clean;

    const cut = clean.slice(0, length);
    const lastSpace = cut.lastIndexOf(" ");
    return `${cut.slice(0, lastSpace > 80 ? lastSpace : length).trimEnd()}…`;
}
