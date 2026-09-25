/**
 * Pull email addresses out of whatever somebody pasted.
 *
 * Leaders add workers from lists they already have: a WhatsApp message, a column
 * copied out of a spreadsheet, an email's To: line ("Ada Obi <ada@x.com>, ..."). So
 * this doesn't ask for one address per line. It splits on anything that can't be part
 * of an address (spaces, commas, semicolons, angle brackets, quotes, newlines, tabs)
 * and keeps the tokens that contain an "@". Words without an "@" are names and are
 * dropped quietly. Tokens with an "@" that still aren't addresses come back in
 * `invalid`, so a typo is reported instead of silently skipped.
 *
 * Addresses are lower-cased and de-duplicated: the same person pasted twice is added
 * once. Shared by the form's live count and the server action; the server parses the
 * raw text again itself rather than trusting the client's list.
 */

/** A bulk add larger than this is almost certainly a paste of the wrong thing. */
export const MAX_EMAILS_PER_ADD = 200;

// Deliberately plain: letters, digits and . _ + ' - before the @; a dotted domain
// after. `%` is excluded because the lookup uses ILIKE, where it's a wildcard.
const EMAIL_RE = /^[a-z0-9._+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

export interface ParsedEmails {
    emails: string[];
    invalid: string[];
}

export function parseEmailList(raw: string): ParsedEmails {
    const emails = new Set<string>();
    const invalid = new Set<string>();
    for (const token of (raw ?? "").split(/[\s,;<>()[\]"`|]+/)) {
        // "mailto:" from a copied link, and a sentence's full stop or colon.
        const t = token.replace(/^mailto:/i, "").replace(/^[.:]+|[.:]+$/g, "").toLowerCase();
        if (!t.includes("@")) continue;
        if (EMAIL_RE.test(t)) emails.add(t);
        else invalid.add(t);
    }
    return { emails: [...emails], invalid: [...invalid] };
}
