/**
 * The portal's own domain types.
 *
 * These were imported from @rcffuta/ict-lib until that dependency was removed. Keeping
 * them here is not merely relocation — several of them were WRONG, and being wrong
 * inside a package nobody opens is how they stayed wrong:
 *
 *   * `Tenure` was declared camelCase (`startDate`, `isActive`) while every value ever
 *     assigned to it is a raw PostgREST row in snake_case. The type annotated something
 *     that never existed. It is now the row as it actually arrives.
 *
 *   * `LeadershipRole.scope` was the old position `category`, dropped in migration 0013.
 *     It is now derived from privilege tags and documented as such.
 *
 * Client-safe: types only, no imports, nothing at runtime.
 */

import type { Gender } from "@/lib/gender";

// ---------------------------------------------------------------------------
// Database rows — snake_case, exactly as PostgREST returns them
// ---------------------------------------------------------------------------

/** A row of `public.tenures`. */
export interface Tenure {
    id: string;
    name: string;
    session: string;
    /** ISO date string — a Postgres `date`, not a timestamp. */
    start_date: string;
    end_date: string | null;
    is_active: boolean;
    theme: string | null;
    created_at?: string;
}

/** A row of `public.units`. */
export interface Unit {
    id: string;
    slug: string;
    name: string;
    type: "UNIT" | "TEAM";
    description: string | null;
    is_workforce: boolean;
    created_at?: string;
}

/** A row of `public.class_sets` — a generation, not a level. Level is computed. */
export interface ClassSet {
    id: string;
    entry_year: number;
    family_name: string | null;
    is_foundation: boolean;
    level_override: string | null;
}

// ---------------------------------------------------------------------------
// The resolved profile — camelCase, built by the rcf_profile_context RPC
// ---------------------------------------------------------------------------

export interface UserBio {
    id: string;
    firstName: string;
    lastName: string;
    middleName?: string | null;
    email: string;
    phoneNumber: string | null;
    gender: string | null;
    dob?: string | null;
    avatarUrl?: string | null;
    avatarPublicId?: string | null;
}

export interface UserLocation {
    schoolAddress: string | null;
    homeAddress: string | null;
    residentialZone?: string | null;
}

export interface UserAcademics {
    matricNumber: string | null;
    department: string | null;
    faculty: string | null;
    entryYear: number | null;
    /** The generation's family name ("Army of Light"), not the level. */
    family: string | null;
    /** COMPUTED from entry year against the active session — never stored. */
    currentLevel: string | null;
}

export interface LeadershipRole {
    title: string;
    /** Immutable position handle. Prefer this over `title`, which is editable. */
    slug: string | null;
    /**
     * What KIND of office this is. DERIVED from the position's privilege tags by
     * `rcf_position_kind()` — migration 0013 dropped the stored `category` column.
     */
    scope: "PRESIDENT" | "CENTRAL" | "UNIT" | "TEAM" | "LEVEL" | "ZONE";
    /** The unit / generation / zone this role is attached to, if any. */
    contextName?: string | null;
}

export interface UnitMembership {
    id: string;
    name: string;
    role: string;
}

/**
 * A member, fully resolved in one RPC call.
 *
 * `roles` is nullable because the RPC distinguishes "not a leader" from "no data" —
 * most members hold no position at all.
 */
export interface FullUserProfile {
    profile: UserBio;
    location: UserLocation;
    academics: UserAcademics;
    roles: LeadershipRole[] | null;
    unit: UnitMembership | null;
    teams: UnitMembership[];
}

// ---------------------------------------------------------------------------
// Form payloads
// ---------------------------------------------------------------------------

/** What the profile form submits for the personal-details section. */
export interface BioData {
    firstName: string;
    lastName: string;
    middleName?: string | null;
    email?: string;
    phoneNumber?: string | null;
    /**
     * Already normalised — run the raw form field through `parseGender()` from
     * `@/lib/gender` before it gets here. Typed as `Gender` rather than `string` so
     * that an unselected `<select>`'s `""`, which the database's check constraint
     * rejects, cannot reach a write without the compiler objecting.
     */
    gender?: Gender | null;
    dob?: string | null;
    avatarUrl?: string | null;
}

/** What the profile form submits for the address section. */
export interface LocationData {
    schoolAddress?: string | null;
    homeAddress?: string | null;
    residentialZoneId?: string | null;
}
