/**
 * Gender — one spelling, one parser, and a tally that adds up.
 *
 * `profiles.gender` is `text` with
 * `CHECK (gender = ANY (ARRAY['male', 'female']))` and no NOT NULL. Three facts follow
 * from that, and every bug this module exists to prevent comes from forgetting one:
 *
 *   1. The stored value is LOWERCASE `male` / `female`. "Male", "M" and "Brother" are
 *      display, never storage.
 *   2. NULL is allowed and normal. A member who has never opened their profile has no
 *      gender, and so does every member imported from a roster that did not collect it.
 *   3. EMPTY STRING IS NOT ALLOWED. The check rejects `''`, so a form that submits an
 *      unselected `<select>` straight to the database fails the whole write -- and the
 *      failure is a constraint violation on a profile save, not a field-level error, so
 *      it reads as "saving is broken" rather than "you did not pick a gender".
 *
 * `event_registrations.gender` has no constraint at all, so anything at all can land
 * there. That is exactly why parsing belongs here rather than in each caller: the
 * portal's own forms all submit `male`/`female` today, but nothing enforces it, and the
 * places that read the column already hedge with `?.toLowerCase()` because at some
 * point something else did not.
 *
 * ACCOUNTING. Counting code kept saying `if male ... else if female ...` and stopping
 * there, which silently drops everyone whose gender is unknown: a generation of 20 with
 * three unrecorded reads as 9 + 8 = 20 to nobody, and the numbers on screen do not add
 * up to the member count next to them. {@link tallyGender} returns `unspecified`
 * alongside `male` and `female`, and guarantees the three sum to `total`.
 */

/** The only two values the database will accept. */
export const GENDERS = ["male", "female"] as const;

export type Gender = (typeof GENDERS)[number];

/**
 * What a member is called in the fellowship. Kept beside the display label because the
 * portal uses both -- "Female" on a profile, "Sister" on an attendee list.
 */
export const GENDER_OPTIONS: ReadonlyArray<{
    value: Gender;
    label: string;
    fellowshipLabel: string;
}> = [
    { value: "male", label: "Male", fellowshipLabel: "Brother" },
    { value: "female", label: "Female", fellowshipLabel: "Sister" },
];

/** Shown wherever a member has no recorded gender. Never written to the database. */
export const GENDER_UNSPECIFIED_LABEL = "Not specified";

export function isGender(value: unknown): value is Gender {
    return value === "male" || value === "female";
}

/**
 * Everything that has ever meant "male" or "female" in this system, mapped to the one
 * spelling that is allowed to reach the database.
 *
 * The aliases are not hypothetical. Spreadsheet imports arrive as `M`/`F`, the events
 * UI labels the same two options `Brother`/`Sister`, and a hand-edited row can hold
 * anything a person typed. Accepting them at the boundary is what stops each of those
 * becoming a separate special case scattered across the readers.
 */
const ALIASES: Readonly<Record<string, Gender>> = {
    male: "male", m: "male", man: "male", boy: "male", brother: "male", bro: "male",
    female: "female", f: "female", woman: "female", girl: "female",
    sister: "female", sis: "female",
};

/**
 * Normalise anything into a storable gender, or null.
 *
 * Returns null -- never `""` -- for blank, unknown and unrecognised input, because null
 * is the value the column accepts for "we do not know" and the empty string is the
 * value that breaks the write. Use this on EVERY path that writes gender.
 */
export function parseGender(value: unknown): Gender | null {
    if (typeof value !== "string") return null;
    const key = value.trim().toLowerCase();
    if (!key) return null;
    return ALIASES[key] ?? null;
}

/** For display: "Male", "Female", or "Not specified". */
export function formatGender(value: unknown): string {
    const gender = parseGender(value);
    if (!gender) return GENDER_UNSPECIFIED_LABEL;
    return GENDER_OPTIONS.find((o) => o.value === gender)!.label;
}

/**
 * How the fellowship addresses someone: "Brother", "Sister", or "Member".
 *
 * "Member" matters. The previous shape was `gender === "male" ? "Brother" : "Sister"`,
 * which calls every member with no recorded gender a sister -- a wrong fact about a
 * real person, printed confidently, and the sort of thing somebody notices on a badge
 * at a registration desk.
 */
export function fellowshipTitle(value: unknown): "Brother" | "Sister" | "Member" {
    const gender = parseGender(value);
    if (gender === "male") return "Brother";
    if (gender === "female") return "Sister";
    return "Member";
}

export interface GenderTally {
    male: number;
    female: number;
    /** Recorded as neither -- null, blank, or something nothing recognises. */
    unspecified: number;
    /** Always `male + female + unspecified`. */
    total: number;
}

export function emptyGenderTally(): GenderTally {
    return { male: 0, female: 0, unspecified: 0, total: 0 };
}

/** Add one person to a running tally. Mutates and returns it. */
export function addToGenderTally(tally: GenderTally, value: unknown): GenderTally {
    tally.total += 1;
    const gender = parseGender(value);
    if (gender === "male") tally.male += 1;
    else if (gender === "female") tally.female += 1;
    else tally.unspecified += 1;
    return tally;
}

/**
 * Tally a collection, accounting for every row.
 *
 * @param rows  anything iterable
 * @param pick  how to read the gender off a row; defaults to a `gender` property
 */
export function tallyGender<T>(
    rows: Iterable<T>,
    pick: (row: T) => unknown = (row) => (row as { gender?: unknown })?.gender,
): GenderTally {
    const tally = emptyGenderTally();
    for (const row of rows) addToGenderTally(tally, pick(row));
    return tally;
}
