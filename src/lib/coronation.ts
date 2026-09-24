/**
 * What a coronation records, and the rules it must satisfy — one schema, used by the
 * coronation form (inline errors as you type) and by the server action (the real check).
 *
 * Coronation is the retreat where the session's theme is unveiled. It is NOT an event
 * the portal manages; the portal only records its outcome.
 */
import { z } from "zod";
import { checkPalette, isHexColour, parsePalette } from "@/lib/palette";

/**
 * `John 1:1-3`, `Isaiah 1:2-3`, `1 John 4:7`, `Song of Solomon 2:4`, `Psalm 23:1`.
 *
 * Loose on purpose: book, chapter, verse or verse range. Not checked against a canon
 * list — abbreviations and spellings vary, and a form that argues about how to spell
 * "Song of Solomon" is worse than one that accepts it. Stored as typed.
 */
export const BIBLE_REFERENCE = /^(?:[1-3]\s?)?[A-Za-z][A-Za-z .']*\s\d{1,3}:\d{1,3}(?:\s?[-–]\s?\d{1,3})?$/;

/**
 * Only images in this project's own Cloudinary cloud. The upload is unsigned and
 * happens in the browser, so without this anyone who reached the action could make
 * every dashboard load an image from a server of their choosing.
 */
export function isOwnCloudinaryUrl(url: string): boolean {
    const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    if (!cloud) return false;
    try {
        const u = new URL(url);
        return (
            u.protocol === "https:" &&
            u.hostname === "res.cloudinary.com" &&
            u.pathname.startsWith(`/${cloud}/`)
        );
    } catch {
        return false;
    }
}

const optionalImage = z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined)
    .refine((v) => v === undefined || isOwnCloudinaryUrl(v), {
        message: "Upload the image here rather than pasting a link.",
    });

const hex = z.string().refine(isHexColour, { message: "Pick a colour." });

export const coronationSchema = z
    .object({
        theme: z
            .string()
            .trim()
            .min(2, "Enter the theme.")
            .max(80, "Keep the theme under 80 characters."),
        themeText: z
            .string()
            .trim()
            .min(1, "Enter the Bible reference the theme is drawn from.")
            .max(60, "That reference is too long.")
            .regex(BIBLE_REFERENCE, "Write it as a reference, e.g. John 1:1-3."),
        coronatedOn: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the day of the retreat.")
            .refine((d) => !Number.isNaN(Date.parse(d)), "Pick the day of the retreat."),
        bannerUrl: optionalImage,
        iconUrl: optionalImage,
        usePalette: z.boolean(),
        primary: hex,
        accent: hex,
    })
    .superRefine((v, ctx) => {
        if (!v.usePalette) return;
        const palette = parsePalette({ primary: v.primary, accent: v.accent });
        if (!palette) return;
        const { checks } = checkPalette(palette);
        for (const c of checks.filter((c) => !c.ok)) {
            ctx.addIssue({
                code: "custom",
                // The accent pair is the accent's fault; the other two are the primary's.
                path: [c.pair.startsWith("Accent") ? "accent" : "primary"],
                message: `${c.pair} is ${c.ratio}:1 — needs at least ${c.needed}:1 to be readable.`,
            });
        }
    });

export type CoronationInput = z.input<typeof coronationSchema>;
export type CoronationValues = z.output<typeof coronationSchema>;
