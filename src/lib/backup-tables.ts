/**
 * The backup table registry — what a fellowship backup can contain.
 *
 * Split out of src/lib/backup.ts because that module imports the service-role client
 * and is therefore server-only, while the backup picker is a client component that
 * needs this metadata to render. Same pattern as
 * src/app/dashboard/level/export-fields.ts: a shared whitelist that the browser renders
 * and the server validates against, so the client never decides what is readable.
 *
 * Pure data — no imports, safe anywhere.
 */

export type BackupGroup = "identity" | "structure" | "access" | "audit" | "invites" | "activity";

export const BACKUP_GROUP_LABELS: Record<BackupGroup, string> = {
    identity: "People",
    structure: "Structure & leadership",
    access: "Portal access",
    audit: "Audit trails",
    invites: "Invites",
    activity: "Events & activity",
};

export interface TableSpec {
    name: string;
    label: string;
    description: string;
    group: BackupGroup;
    /** Required tables are always included — a restore is impossible without them. */
    required: boolean;
    /** Column to filter by tenure. Absent means the table is shared across tenures. */
    tenureColumn?: string;
    /** Columns blanked before the row is written to the bundle. */
    redact?: string[];
}

/**
 * The tables a fellowship backup can carry, in FK-safe order — parents before children,
 * so a restore replays the file top to bottom without deferring constraints.
 */
export const BACKUP_TABLES: TableSpec[] = [
    // --- Required: the fellowship cannot be rebuilt without these ---------------
    {
        name: "class_sets",
        label: "Generations",
        description: "Entry years and family names — what every level is computed from.",
        group: "structure",
        required: true,
    },
    {
        name: "residential_zones",
        label: "Residential zones",
        description: "Zone names members are assigned to.",
        group: "structure",
        required: true,
    },
    {
        name: "profiles",
        label: "Member profiles",
        description: "Everyone in the fellowship: names, contact details, academics, addresses.",
        group: "identity",
        required: true,
    },
    {
        name: "tenures",
        label: "Tenures",
        description: "Every session, its theme and dates.",
        group: "structure",
        required: true,
    },
    {
        name: "units",
        label: "Units & teams",
        description: "The workforce structure.",
        group: "structure",
        required: true,
    },
    {
        name: "leadership_positions",
        label: "Leadership catalogue",
        description: "The org chart: President, VPs, Executives, Coordinators.",
        group: "structure",
        required: true,
    },
    {
        name: "position_privileges",
        label: "Position privileges",
        description: "What each position is allowed to do. Restoring without this leaves nobody with authority.",
        group: "structure",
        required: true,
    },
    {
        name: "unit_positions",
        label: "Unit position mapping",
        description: "Which positions belong to which unit.",
        group: "structure",
        required: true,
    },
    {
        name: "leadership",
        label: "Appointments",
        description: "Who held which position this tenure.",
        group: "structure",
        required: true,
        tenureColumn: "tenure_id",
    },
    {
        name: "membership_units",
        label: "Unit membership",
        description: "Who worked in which unit or team this tenure.",
        group: "structure",
        required: true,
        tenureColumn: "tenure_id",
    },
    {
        name: "module_access",
        label: "Module access config",
        description: "Who can read and write each Tool module.",
        group: "structure",
        required: true,
    },
    {
        name: "profile_login",
        label: "Portal logins",
        description: "Who may sign in. Password hashes are never included — leaders set a new one on first login.",
        group: "access",
        required: true,
        redact: ["password_hash"],
    },

    // --- Optional: useful, sometimes large, not needed to rebuild ---------------
    {
        name: "login_events",
        label: "Login history",
        description: "Every sign-in, failure and session revocation. Grows large over a session.",
        group: "audit",
        required: false,
    },
    {
        name: "admin_audit_log",
        label: "Admin edit history",
        description: "Every field a System Admin changed on a member record.",
        group: "audit",
        required: false,
    },
    {
        name: "unit_transfer_requests",
        label: "Unit transfers",
        description: "Transfer requests and the VP Admin's decisions this tenure.",
        group: "audit",
        required: false,
        tenureColumn: "tenure_id",
    },
    {
        name: "handover_intents",
        label: "Handover history",
        description:
            "Every handover ever attempted: who ran it, what they decided, how it ended. This is what a successor inherits.",
        group: "audit",
        required: false,
        // Deliberately NOT tenure-scoped. Every other audit table is filtered to the
        // tenure being backed up, but the whole point of this one is the chain across
        // tenures — a backup taken mid-handover that contained only the handover
        // currently in progress would lose exactly the history it exists to preserve.
    },
    {
        name: "handover_events",
        label: "Handover proceedings",
        description:
            "The step-by-step log behind each handover record. Append-only; also spans every tenure.",
        group: "audit",
        required: false,
    },
    {
        name: "registration_invites",
        label: "Registration invites",
        description: "Level tokens and their metadata. Raw tokens are redacted — rotate after restoring.",
        group: "invites",
        required: false,
        redact: ["token"],
    },
    {
        name: "invite_events",
        label: "Invite activity",
        description: "Who generated, revoked or used a token.",
        group: "invites",
        required: false,
    },
    {
        name: "events",
        label: "Events",
        description: "Event definitions and their configuration.",
        group: "activity",
        required: false,
    },
    {
        name: "event_registrations",
        label: "Event registrations",
        description: "Who registered and checked in. Often the largest table here.",
        group: "activity",
        required: false,
    },
    {
        name: "event_questions",
        label: "Lo! questions",
        description: "Questions asked through the Lo! app.",
        group: "activity",
        required: false,
    },
    {
        name: "testimonies",
        label: "Testimonies",
        description: "Member testimonies and their moderation state.",
        group: "activity",
        required: false,
    },
    {
        name: "testimony_amens",
        label: "Testimony amens",
        description: "Reactions on testimonies.",
        group: "activity",
        required: false,
    },
];

export const REQUIRED_TABLES = BACKUP_TABLES.filter((t) => t.required).map((t) => t.name);
export const OPTIONAL_TABLES = BACKUP_TABLES.filter((t) => !t.required).map((t) => t.name);

/** Sensible default selection: everything required, plus the audit trails. */
export const DEFAULT_TABLE_SELECTION = [
    ...REQUIRED_TABLES,
    "admin_audit_log",
    "unit_transfer_requests",
    "handover_intents",
    "handover_events",
    "registration_invites",
    "invite_events",
];
