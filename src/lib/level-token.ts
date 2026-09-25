/**
 * Short tokens as people see and type them. Client-safe (no crypto, no db).
 *
 * Two kinds share one shape, a prefix plus five characters from an alphabet with the
 * look-alike glyphs taken out (0/O, 1/l/I), so they survive being read off one phone and
 * typed into another:
 *
 *   rcf-xxxxx  a LEVEL token: register or update your record at /profile.
 *   acd-xxxxx  an academics ROUND token: submit your results at /academics.
 *
 * Different prefixes so neither can be mistaken for the other. Stored lower-case and
 * SHOWN upper-case (`RCF-7KX2P`); matching ignores case, so either works.
 * `src/lib/invites.ts` generates both from the same alphabet.
 */

export const LEVEL_TOKEN_DIGITS = "23456789";
export const LEVEL_TOKEN_LETTERS = "abcdefghjkmnpqrstuvwxyz";
export const LEVEL_TOKEN_BODY_LENGTH = 5;

const BODY = `[${LEVEL_TOKEN_DIGITS}${LEVEL_TOKEN_LETTERS}]{${LEVEL_TOKEN_BODY_LENGTH}}`;

/** Where members register or update their record. */
export const PROFILE_PATH = "/profile";

/** Where members submit a semester's results. */
export const RESULTS_PATH = "/academics";

type ShortPrefix = "rcf" | "acd";

/**
 * How a token is shown and shared: upper-case. Only the short forms: the long one-off
 * invite tokens are case-SENSITIVE and must be passed through untouched.
 */
export function displayLevelToken(token: string): string {
    const t = token.trim();
    return /^(rcf|acd)-/i.test(t) ? t.toUpperCase() : t;
}

/**
 * The canonical (stored) token from whatever was typed or pasted, or null.
 *
 * Forgiving on purpose: any case, stray spaces, the prefix left off, `RCF 7KX2P`, or
 * the whole shared link pasted in (the value of `param` is used).
 */
function parseShortToken(raw: string, prefix: ShortPrefix, param: string): string | null {
    let t = (raw ?? "").trim();
    const fromLink = new RegExp(`[?&]${param}=([^&#\\s]+)`, "i").exec(t);
    if (fromLink) t = decodeURIComponent(fromLink[1]);
    t = t.toLowerCase().replace(/\s+/g, " ").trim();
    const m = new RegExp(`^(?:${prefix}[-_ ]?)?(${BODY})$`).exec(t);
    return m ? `${prefix}-${m[1]}` : null;
}

/** A level token from what was typed or pasted (see parseShortToken). */
export function parseLevelTokenInput(raw: string): string | null {
    return parseShortToken(raw, "rcf", "invite");
}

/** An academics round token from what was typed or pasted (see parseShortToken). */
export function parseRoundTokenInput(raw: string): string | null {
    return parseShortToken(raw, "acd", "round");
}

/** The shareable path for a token: `/profile?invite=RCF-7KX2P&reason=update`. */
export function profilePath(token: string, reason?: "register" | "update"): string {
    const q = new URLSearchParams({ invite: displayLevelToken(token) });
    if (reason) q.set("reason", reason);
    return `${PROFILE_PATH}?${q.toString()}`;
}

/** The shareable path for a results round: `/academics?round=ACD-7KX2P`. */
export function resultsPath(token: string): string {
    return `${RESULTS_PATH}?${new URLSearchParams({ round: displayLevelToken(token) }).toString()}`;
}
