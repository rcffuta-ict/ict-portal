/**
 * What a coronation records, and the rules it must satisfy — one schema, used by the
 * coronation form (inline errors as you type) and by the server action (the real check).
 *
 * Coronation is the retreat where the session's theme is unveiled. It is NOT an event
 * the portal manages; the portal only records its outcome.
 */
import { z } from "zod";
import { checkPalette, isHexColour, parsePalette } from "@/lib/palette";
import { isOwnCloudinaryUrl } from "@/lib/cloudinary";

/**
 * `John 1:1-3`, `Isaiah 1:2-3`, `1 John 4:7`, `Song of Solomon 2:4`, `Psalm 23:1`.
 *
 * Loose on purpose: book, chapter, verse or verse range. Not checked against a canon
 * list — abbreviations and spellings vary, and a form that argues about how to spell
 * "Song of Solomon" is worse than one that accepts it. Stored as typed.
 */
export const BIBLE_REFERENCE = /^(?:[1-3]\s?)?[A-Za-z][A-Za-z .']*\s\d{1,3}:\d{1,3}(?:\s?[-–]\s?\d{1,3})?$/;

/**
 * A theme can be drawn from several passages: `Isaiah 60:1-3, Romans 8:19`. Each part
 * is a whole reference on its own — `John 1:1, 14` is not read as `John 1:14`, because
 * guessing the book and chapter is how a stored reference ends up wrong.
 */
export function splitReferences(text: string): string[] {
    return text
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
}

const optionalImage = z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined)
    .refine((v) => v === undefined || isOwnCloudinaryUrl(v), {
        message: "Upload the image, or import it with Paste link.",
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
            .max(160, "That is too long — keep it to the references themselves.")
            .superRefine((text, ctx) => {
                const refs = splitReferences(text);
                if (refs.length === 0) {
                    ctx.addIssue({ code: "custom", message: "Enter the Bible reference the theme is drawn from." });
                    return;
                }
                const bad = refs.find((r) => !BIBLE_REFERENCE.test(r));
                if (bad) {
                    ctx.addIssue({
                        code: "custom",
                        message: `"${bad}" isn't a full reference — write each one like John 1:1-3, separated by commas.`,
                    });
                }
            })
            // Stored as typed, apart from the separators: `a,b ,  c` becomes `a, b, c`.
            .transform((text) => splitReferences(text).join(", ")),
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
