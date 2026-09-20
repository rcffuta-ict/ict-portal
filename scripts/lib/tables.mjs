/**
 * Who owns which table.
 *
 * This Supabase project is shared by five applications and NOTHING in the database
 * records which table belongs to which. That fact drives two different jobs:
 *
 *   db-inventory.mjs      — the numbers that must NOT move during a portal migration
 *                           are the FOREIGN ones.
 *   bootstrap-supabase.mjs — the schema dump that seeds a fresh project must contain
 *                           the portal and nothing else.
 *
 * Both used to be impossible to keep in sync because only db-inventory knew the lists.
 * This module is the single source of truth. Adding a portal table means adding it
 * here, once.
 *
 * Pure data + pure functions. No imports, no side effects.
 */

/** Tables this portal owns. Anything here is ours to migrate. */
export const PORTAL_TABLES = [
    "schema_migrations",
    "class_sets", "residential_zones", "profiles", "tenures", "units", "leadership",
    "leadership_positions", "position_privileges", "membership_units", "unit_positions",
    "zone_pastors", "module_access",
    "profile_login", "auth_sessions", "login_events",
    "registration_invites", "invite_events",
    "events", "event_registrations", "event_questions", "question_stars",
    // question_flags is KEPT deliberately — the event_questions_with_details view
    // depends on it. See migration 0013.
    "question_flags",
    "testimonies", "testimony_amens", "lo_member_links", "lo_member_verify_attempts",
    "admin_audit_log", "unit_transfer_requests", "handover_intents", "handover_events",
];

/** Other applications sharing this database. NEVER ours to touch. */
export const FOREIGN = {
    "ReadWrite store": ["rw_categories", "rw_products", "rw_product_variants",
        "rw_product_images", "rw_orders", "rw_order_items", "rw_payments", "rw_settings",
        "rw_audit_logs", "rw_admin_moderators", "rw_verdicts", "rw_verdict_orders",
        "rw_email_templates", "rw_email_logs", "rw_email_queue", "rw_sponsors",
        "rw_sponsor_leads"],
    "Final Year Brethren": ["fyb_registrations", "fyb_admins", "fyb_pair_intents",
        "fyb_settings", "fyb_consent_tokens", "fyb_email_templates", "fyb_email_queue",
        "fyb_email_logs", "fyb_token_attempts", "fyb_award_categories",
        "fyb_award_candidates", "fyb_award_votes", "fyb_award_candidate_members"],
    "E-library": ["elib_courses", "elib_materials", "elib_downloads"],
    "Games & engagement": ["game_sessions", "game_rounds", "game_participants",
        "trivia_questions", "trivia_answers", "bingo_calls", "bingo_cards", "bingo_marks",
        "bingo_wins", "buzzer_prompts", "buzzer_presses"],
};

/**
 * Prefixes the foreign apps use.
 *
 * The explicit lists above are the authority for tables, but a schema dump also
 * contains SEQUENCES, INDEXES and CONSTRAINTS whose names derive from a table without
 * containing it verbatim — `rw_products_id_seq` never mentions `rw_products`. Prefix
 * matching catches those; the lists catch anything that breaks the naming convention.
 */
export const FOREIGN_PREFIXES = ["rw_", "fyb_", "elib_", "game_", "trivia_", "bingo_", "buzzer_"];

/** Expected GONE after migration 0013. Listed so "still present" is visible. */
export const DROPPED_IN_0013 = ["verification_codes", "question_references"];

/**
 * Unknown owner. Listed, never touched.
 *
 * `public.categories` is an orphan with the exact shape of `rw_categories` and no
 * references anywhere in this repo. Nobody should delete it on a guess — which is
 * exactly why it is named here rather than cleaned up.
 */
export const UNCLASSIFIED = ["categories"];

/** Every foreign table, flattened. */
export const ALL_FOREIGN = Object.values(FOREIGN).flat();

export function classify(name) {
    if (PORTAL_TABLES.includes(name)) return { group: "PORTAL", owner: "ICT Portal" };
    for (const [owner, tables] of Object.entries(FOREIGN)) {
        if (tables.includes(name)) return { group: "FOREIGN", owner };
    }
    if (DROPPED_IN_0013.includes(name)) return { group: "DROPPED", owner: "removed by 0013" };
    return { group: "UNCLASSIFIED", owner: "unknown - do not touch" };
}

/** True if `name` belongs to another application, by list or by prefix. */
export function isForeignName(name) {
    if (ALL_FOREIGN.includes(name)) return true;
    return FOREIGN_PREFIXES.some((p) => name.startsWith(p));
}
