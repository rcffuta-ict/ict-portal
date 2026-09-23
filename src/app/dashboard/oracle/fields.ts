import { GENDERS } from "@/lib/gender";
/**
 * The Oracle FIELD REGISTRY — the single whitelist of everything the System Admin can
 * see, filter, sort and edit about a member.
 *
 * Modelled on `src/app/dashboard/level/export-fields.ts`, which already establishes the
 * rule this file depends on: **the browser never decides which columns are readable or
 * writable.** The client renders pickers from this list, and the server validates every
 * incoming field name against the same list. A field that isn't here does not exist as
 * far as the Oracle is concerned — which is what keeps a crafted request from naming
 * `email`, a column in another table, or a Postgres function.
 *
 * Safe to import from client components: it is plain data, no DB access.
 */

export type FieldKind = "text" | "enum" | "date" | "number" | "ref";

export type FieldGroup =
    | "Identity"
    | "Bio"
    | "Academics"
    | "Location"
    | "Fellowship"
    | "Meta";

export interface OracleField {
    /** App-level id. Usually a `profiles` column, but derived fields have no column. */
    key: string;
    label: string;
    group: FieldGroup;
    /** The `profiles` column, when the key maps 1:1. Absent for derived fields. */
    column?: string;
    kind: FieldKind;
    /** Allowed values for `kind: "enum"` — enforced on read AND on write. */
    options?: string[];
    filterable: boolean;
    sortable: boolean;
    /**
     * Whether the System Admin may write this field. `false` is the default position;
     * a field is only editable because someone decided it should be.
     */
    editable: boolean;
    /** Shown beside a locked field so the admin can see WHY it can't be changed. */
    lockReason?: string;
    /** Longer-form guidance rendered under an editable input. */
    hint?: string;
    /** Ref fields name the table their options come from. */
    refSource?: "residential_zones" | "class_sets" | "units";
}

export const ORACLE_FIELDS: OracleField[] = [
    // --- Identity: who this record IS. Locked by definition. --------------------
    {
        key: "id",
        label: "Profile ID",
        group: "Identity",
        column: "id",
        kind: "text",
        filterable: true,
        sortable: false,
        editable: false,
        lockReason: "Primary key.",
    },
    {
        key: "email",
        label: "Email",
        group: "Identity",
        column: "email",
        kind: "text",
        filterable: true,
        sortable: true,
        editable: false,
        lockReason:
            "Login identity. Changing it here would orphan this member's login record and their active session.",
    },
    {
        key: "matric_number",
        label: "Matric number",
        group: "Identity",
        column: "matric_number",
        kind: "text",
        filterable: true,
        sortable: true,
        editable: false,
        lockReason: "Unique institutional identifier.",
    },

    // --- Bio --------------------------------------------------------------------
    { key: "first_name", label: "First name", group: "Bio", column: "first_name", kind: "text", filterable: true, sortable: true, editable: true },
    { key: "last_name", label: "Last name", group: "Bio", column: "last_name", kind: "text", filterable: true, sortable: true, editable: true },
    { key: "middle_name", label: "Middle name", group: "Bio", column: "middle_name", kind: "text", filterable: true, sortable: true, editable: true },
    {
        key: "gender",
        label: "Gender",
        group: "Bio",
        column: "gender",
        kind: "enum",
        // From @/lib/gender, so the raw-column editor can only ever offer values
        // profiles_gender_check will accept.
        options: [...GENDERS],
        filterable: true,
        sortable: true,
        editable: true,
    },
    { key: "dob", label: "Date of birth", group: "Bio", column: "dob", kind: "date", filterable: true, sortable: true, editable: true },
    { key: "phone_number", label: "Phone", group: "Bio", column: "phone_number", kind: "text", filterable: true, sortable: false, editable: true },
    { key: "avatar_url", label: "Avatar URL", group: "Bio", column: "avatar_url", kind: "text", filterable: false, sortable: false, editable: false, lockReason: "Set by the member through the avatar uploader." },

    // --- Academics --------------------------------------------------------------
    { key: "department", label: "Department", group: "Academics", column: "department", kind: "text", filterable: true, sortable: true, editable: true },
    { key: "faculty", label: "Faculty", group: "Academics", column: "faculty", kind: "text", filterable: true, sortable: true, editable: true },
    {
        key: "entry_year",
        label: "Entry year",
        group: "Academics",
        column: "entry_year",
        kind: "number",
        filterable: true,
        sortable: true,
        editable: true,
        hint: "Legacy per-member field. The level shown across the app is computed from the member's GENERATION, not from this.",
    },
    {
        key: "class_set_id",
        label: "Generation",
        group: "Academics",
        column: "class_set_id",
        kind: "ref",
        refSource: "class_sets",
        filterable: true,
        sortable: false,
        editable: true,
        hint: "Drives the member's computed level — and which level coordinator can see them.",
    },
    {
        key: "level",
        label: "Level (computed)",
        group: "Academics",
        kind: "text",
        filterable: false,
        sortable: false,
        editable: false,
        lockReason: "Computed from the generation's entry year and the active session.",
    },

    // --- Location ---------------------------------------------------------------
    { key: "school_address", label: "School address", group: "Location", column: "school_address", kind: "text", filterable: true, sortable: false, editable: true },
    { key: "home_address", label: "Home address", group: "Location", column: "home_address", kind: "text", filterable: true, sortable: false, editable: true },
    {
        key: "residential_zone_id",
        label: "Residential zone",
        group: "Location",
        column: "residential_zone_id",
        kind: "ref",
        refSource: "residential_zones",
        filterable: true,
        sortable: false,
        editable: true,
    },

    // --- Next of kin ------------------------------------------------------------
    { key: "next_of_kin_name", label: "Next of kin", group: "Bio", column: "next_of_kin_name", kind: "text", filterable: true, sortable: false, editable: true },
    { key: "next_of_kin_phone", label: "Next of kin phone", group: "Bio", column: "next_of_kin_phone", kind: "text", filterable: true, sortable: false, editable: true },
    { key: "parent_phone", label: "Parent phone", group: "Bio", column: "parent_phone", kind: "text", filterable: true, sortable: false, editable: true },

    // --- Fellowship: resolved through joins, so filterable but never written here.
    {
        key: "unit",
        label: "Unit",
        group: "Fellowship",
        kind: "ref",
        refSource: "units",
        filterable: true,
        sortable: false,
        editable: false,
        lockReason: "Edited through the Fellowship section of this page.",
    },
    {
        key: "teams",
        label: "Teams",
        group: "Fellowship",
        kind: "ref",
        refSource: "units",
        filterable: true,
        sortable: false,
        editable: false,
        lockReason: "Edited through the Fellowship section of this page.",
    },
    {
        key: "leadership",
        label: "Leadership",
        group: "Fellowship",
        kind: "text",
        filterable: true,
        sortable: false,
        editable: false,
        lockReason:
            "A position carries privilege tags, so granting one grants authorization. Appointments are made in the Tenure module, where they follow a single auditable path.",
    },

    // --- Meta -------------------------------------------------------------------
    { key: "created_at", label: "Joined", group: "Meta", column: "created_at", kind: "date", filterable: true, sortable: true, editable: false, lockReason: "Set by the database." },
    { key: "updated_at", label: "Last updated", group: "Meta", column: "updated_at", kind: "date", filterable: true, sortable: true, editable: false, lockReason: "Set by the database." },
];

export const FIELD_GROUPS: FieldGroup[] = [
    "Identity",
    "Bio",
    "Academics",
    "Location",
    "Fellowship",
    "Meta",
];

const BY_KEY = new Map(ORACLE_FIELDS.map((f) => [f.key, f]));

/** Look up a field, or `undefined` if the key isn't in the registry. */
export function getField(key: string): OracleField | undefined {
    return BY_KEY.get(key);
}

// ---------------------------------------------------------------------------
// Operators
// ---------------------------------------------------------------------------

export type Operator =
    | "is"
    | "is_not"
    | "contains"
    | "starts_with"
    | "in"
    | "gt"
    | "lt"
    | "between"
    | "is_empty"
    | "is_not_empty";

export const OPERATOR_LABELS: Record<Operator, string> = {
    is: "is",
    is_not: "is not",
    contains: "contains",
    starts_with: "starts with",
    in: "is any of",
    gt: "is after / greater than",
    lt: "is before / less than",
    between: "is between",
    is_empty: "is empty",
    is_not_empty: "is not empty",
};

/** Operators that don't take a value at all. */
export const VALUELESS_OPS: Operator[] = ["is_empty", "is_not_empty"];

/** Which operators make sense for each kind. Enforced on the server, not just the UI. */
const OPS_BY_KIND: Record<FieldKind, Operator[]> = {
    text: ["contains", "is", "is_not", "starts_with", "in", "is_empty", "is_not_empty"],
    enum: ["is", "is_not", "in", "is_empty", "is_not_empty"],
    date: ["is", "is_not", "gt", "lt", "between", "is_empty", "is_not_empty"],
    number: ["is", "is_not", "gt", "lt", "between", "is_empty", "is_not_empty"],
    ref: ["is", "is_not", "in", "is_empty", "is_not_empty"],
};

export function operatorsFor(field: OracleField): Operator[] {
    return OPS_BY_KIND[field.kind];
}

export interface Condition {
    field: string;
    op: Operator;
    /** A single value, or two for `between`. Ignored for the valueless operators. */
    value?: string;
    value2?: string;
}

export type MatchMode = "all" | "any";

export interface OracleQuery {
    conditions: Condition[];
    match: MatchMode;
    columns: string[];
    sort?: { field: string; direction: "asc" | "desc" };
    page?: number;
    pageSize?: number;
    /** Free-text search across name / email / phone / matric, like the level grid. */
    search?: string;
}

/** The columns a fresh query shows — enough to identify someone, cheap to render. */
export const DEFAULT_COLUMNS = [
    "first_name",
    "last_name",
    "email",
    "phone_number",
    "level",
    "department",
];

/** Every field the admin may WRITE. The server rebuilds updates from this, only. */
export const EDITABLE_FIELDS = ORACLE_FIELDS.filter((f) => f.editable);

/** Fields with a real `profiles` column — the only ones an update can touch. */
export const EDITABLE_COLUMNS = new Set(
    EDITABLE_FIELDS.filter((f) => f.column).map((f) => f.column as string),
);
