/**
 * Level tokens as people see and type them. Client-safe (no crypto, no db).
 *
 * A level token is `rcf-` plus five characters from an alphabet with the look-alike
 * glyphs taken out (0/O, 1/l/I), so it survives being read off one phone and typed into
 * another. It's stored lower-case and SHOWN upper-case (`RCF-7KX2P`); matching ignores
 * case, so either works. `src/lib/invites.ts` generates from the same alphabet.
 */

export const LEVEL_TOKEN_DIGITS = "23456789";
export const LEVEL_TOKEN_LETTERS = "abcdefghjkmnpqrstuvwxyz";
export const LEVEL_TOKEN_BODY_LENGTH = 5;

const BODY = `[${LEVEL_TOKEN_DIGITS}${LEVEL_TOKEN_LETTERS}]{${LEVEL_TOKEN_BODY_LENGTH}}`;
const TOKEN_RE = new RegExp(`^(?:rcf[-_ ]?)?(${BODY})$`);

/** Where members register or update their record. */
export const PROFILE_PATH = "/profile";

/**
 * How a token is shown and shared: upper-case. Only the short `rcf-` form: the long
 * one-off invite tokens are case-SENSITIVE and must be passed through untouched.
 */
export function displayLevelToken(token: string): string {
    const t = token.trim();
    return /^rcf-/i.test(t) ? t.toUpperCase() : t;
}

/**
 * The canonical (stored) token from whatever was typed or pasted, or null.
 *
 * Forgiving on purpose: any case, stray spaces, the `RCF-` prefix left off, `RCF 7KX2P`,
 * or the whole shared link pasted in (its `invite` value is used).
 */
export function parseLevelTokenInput(raw: string): string | null {
    let t = (raw ?? "").trim();
    const fromLink = /[?&]invite=([^&#\s]+)/i.exec(t);
    if (fromLink) t = decodeURIComponent(fromLink[1]);
    t = t.toLowerCase().replace(/\s+/g, " ").trim();
    const m = TOKEN_RE.exec(t);
    return m ? `rcf-${m[1]}` : null;
}

/** The shareable path for a token: `/profile?invite=RCF-7KX2P&reason=update`. */
export function profilePath(token: string, reason?: "register" | "update"): string {
    const q = new URLSearchParams({ invite: displayLevelToken(token) });
    if (reason) q.set("reason", reason);
    return `${PROFILE_PATH}?${q.toString()}`;
}
