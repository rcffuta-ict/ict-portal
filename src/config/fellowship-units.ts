/**
 * THE FELLOWSHIP'S UNITS AND TEAMS — bootstrap data, not test data.
 *
 * This is the source of truth for `db/seed/default.sql`, which is GENERATED from this
 * file by `scripts/gen-default-seed.mjs` and runs in production. Edit here, regenerate,
 * commit both.
 *
 * THREE NAMES PER OFFICE, and they are not interchangeable:
 *
 *   name   — the unit's full title.        "Information and Communications Unit"
 *   slug   — the immutable machine handle. "ict"
 *   alias  — what the office is POPULARLY  "ICT Coord"
 *            called, shown all over the UI.
 *
 * The slug is the one that must never change: it IS the access-control scope. An
 * `EXCO:choir` privilege row, the derived position `exco-choir`, and every settings
 * token that references it all key off that string. Renaming the Choir Unit must move
 * its display name and nothing else — so `name` and `alias` are free to be edited,
 * and `slug` is frozen the moment it is seeded.
 *
 * Client-safe: plain data, no server imports.
 */

export interface UnitSpec {
    /** Immutable. The EXCO privilege scope. Never regenerate from `name`. */
    slug: string;
    name: string;
    type: "UNIT" | "TEAM";
    /**
     * What the office's holder is popularly called — "Chief Usher", not
     * "Ushering Unit Exco". This is what members actually say, so it is what the
     * cabinet screen and the appointment dropdowns show.
     */
    positionAlias: string;
    description: string;
}

/**
 * A member may belong to exactly one UNIT (enforced by the
 * `enforce_single_unit_membership` trigger from migration 0001) but to any number of
 * TEAMs. That is the whole distinction — a team is a commitment you take on in
 * addition to your unit, not instead of it.
 */
export const FELLOWSHIP_UNITS: UnitSpec[] = [
    {
        slug: "follow-up-and-counselling",
        name: "Follow-up & Counselling Unit",
        type: "UNIT",
        positionAlias: "Follow-up Coord",
        description: "Follows up new and returning members, and coordinates pastoral counselling.",
    },
    {
        slug: "media-and-ambience",
        name: "Media and Ambience Unit",
        type: "UNIT",
        positionAlias: "Media Coord",
        description: "Sound, projection, photography, and the look and feel of every service.",
    },
    {
        slug: "sanctuary-keeping",
        name: "Sanctuary Keeping Unit",
        type: "UNIT",
        positionAlias: "Sanctuary Coord",
        description: "Keeps the sanctuary and its surroundings clean and ready.",
    },
    {
        slug: "library",
        name: "Library",
        type: "UNIT",
        positionAlias: "Librarian",
        description: "Custodian of the fellowship's books and study materials.",
    },
    {
        slug: "alumni-relations",
        name: "Alumni Relations",
        type: "UNIT",
        positionAlias: "Alumni Relations Officer",
        description: "Keeps the fellowship in touch with those who have graduated.",
    },
    {
        slug: "editorial",
        name: "Editorial Unit",
        type: "UNIT",
        positionAlias: "Editor",
        description: "Writes, edits and publishes the fellowship's publications.",
    },
    {
        slug: "academic",
        name: "Academic Unit",
        type: "UNIT",
        positionAlias: "Academic Coord",
        description: "Tutorials, study groups and academic support across departments.",
    },
    {
        slug: "academic-counselling",
        name: "Academic Counselling Team",
        type: "TEAM",
        positionAlias: "Academic Counsellor",
        description:
            "Advises members on course choices and academic difficulty. A TEAM, so members may serve here alongside their own unit.",
    },
    {
        slug: "ushering",
        name: "Ushering Unit",
        type: "UNIT",
        positionAlias: "Chief Usher",
        description: "Welcomes, seats and orders the congregation during services.",
    },
    {
        slug: "choir",
        name: "Choir Unit",
        type: "UNIT",
        positionAlias: "Choir Coord",
        description: "Leads the fellowship in worship and ministration.",
    },
    {
        slug: "prayer",
        name: "Prayer Unit",
        type: "UNIT",
        positionAlias: "Prayer Secretary",
        description: "Carries the fellowship's prayer life and intercession.",
    },
    {
        slug: "hall-reps",
        name: "Hall Reps Unit",
        type: "UNIT",
        positionAlias: "Hall Reps Coord",
        description: "Represents the fellowship in each hall of residence.",
    },
    {
        slug: "drama",
        name: "Drama Unit",
        type: "UNIT",
        positionAlias: "Drama Coord",
        description: "Ministers through drama and stage presentation.",
    },
    {
        slug: "welfare",
        name: "Welfare Unit",
        type: "UNIT",
        positionAlias: "Welfare Coord",
        description: "Sees to the practical needs and wellbeing of members.",
    },
    {
        // A TEAM, not a unit, and that is the fellowship's own classification (see the
        // TEAMS block in the office list). It matters mechanically: as a unit it
        // consumed a member's single unit slot, so nobody could play for the fellowship
        // AND serve in Choir. As a team it sits alongside whatever unit they belong to.
        slug: "sport",
        name: "Sports Team",
        type: "TEAM",
        positionAlias: "Director of Sports",
        description: "Organises the fellowship's sporting life and fixtures.",
    },

    {
        slug: "sisters",
        name: "Sisters' Unit",
        type: "UNIT",
        positionAlias: "Sisters' Coord",
        description: "Ministers to the sisters of the fellowship.",
    },
    {
        slug: "bible-study",
        name: "Bible Study Unit",
        type: "UNIT",
        positionAlias: "Bible Study Secretary",
        description: "Plans and leads the fellowship's study of the scriptures.",
    },
    {
        slug: "organizing",
        name: "Organizing Unit",
        type: "UNIT",
        positionAlias: "Organizing Secretary",
        description: "Sets up, arranges and runs the logistics of every gathering.",
    },
    {
        slug: "evangelism",
        name: "Evangelism Unit",
        type: "UNIT",
        positionAlias: "Evangelism Coord",
        description: "Leads outreach and soul-winning on and off campus.",
    },
    {
        slug: "brothers",
        name: "Brothers' Unit",
        type: "UNIT",
        positionAlias: "Brothers' Coord",
        description: "Ministers to the brothers of the fellowship.",
    },
    {
        slug: "commerce",
        name: "Commerce Team",
        type: "TEAM",
        positionAlias: "Director of Commerce",
        description: "Runs the fellowship's trade, sales and commercial ventures.",
    },
    {
        slug: "secretariat",
        name: "Secretariat",
        type: "TEAM",
        positionAlias: "Secretariat Keeper",
        description: "Keeps the fellowship's office, its records and its correspondence.",
    },
    {
        slug: "protocol",
        name: "Protocol Team",
        type: "TEAM",
        positionAlias: "Protocol Officer",
        description: "Receives and attends to guests, ministers and dignitaries.",
    },
    {
        slug: "transport",
        name: "Transport Team",
        type: "TEAM",
        positionAlias: "Transport Secretary",
        description: "Arranges movement for fellowship programmes and outreaches.",
    },
    {
        // Led by `ict-coord`, a FIXED office — see ICT_UNIT_SLUG in
        // leadership-positions.ts. No `exco-ict` position is generated for it.
        slug: "ict",
        name: "Information and Communications Team",
        type: "TEAM",
        positionAlias: "ICT Coord",
        description: "Runs the infrastructure, and manages the fellowship's systems and its communications.",
    },
];

/** Look one up by its immutable slug. */
export function unitBySlug(slug: string): UnitSpec | undefined {
    return FELLOWSHIP_UNITS.find((u) => u.slug === slug);
}
