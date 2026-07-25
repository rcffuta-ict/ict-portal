/**
 * The whitelist of fields a level export may contain — shared by the client picker and
 * the server action, so the browser never decides which columns are readable.
 *
 * `key` is an app-level identifier (NOT necessarily a column name); the server maps it
 * to either a `profiles` column or a derived value. Anything not listed here is rejected.
 */
export interface ExportField {
    key: string;
    label: string;
    group: "Bio" | "Academics" | "Location" | "Fellowship";
}

export const EXPORT_FIELDS: ExportField[] = [
    { key: "first_name", label: "First name", group: "Bio" },
    { key: "last_name", label: "Last name", group: "Bio" },
    { key: "middle_name", label: "Middle name", group: "Bio" },
    { key: "email", label: "Email", group: "Bio" },
    { key: "phone_number", label: "Phone", group: "Bio" },
    { key: "gender", label: "Gender", group: "Bio" },

    { key: "matric_number", label: "Matric number", group: "Academics" },
    { key: "department", label: "Department", group: "Academics" },
    { key: "faculty", label: "Faculty", group: "Academics" },
    { key: "level", label: "Level", group: "Academics" },
    { key: "generation", label: "Generation", group: "Academics" },

    { key: "school_address", label: "School address", group: "Location" },
    { key: "home_address", label: "Home address", group: "Location" },
    { key: "zone", label: "Residential zone", group: "Location" },

    { key: "unit", label: "Unit", group: "Fellowship" },
    { key: "teams", label: "Teams", group: "Fellowship" },
];

export const EXPORT_FIELD_GROUPS: ExportField["group"][] = [
    "Bio",
    "Academics",
    "Location",
    "Fellowship",
];

/** An export must carry at least this many fields (enforced on client AND server). */
export const MIN_EXPORT_FIELDS = 2;

/** Sensible starting selection. */
export const DEFAULT_EXPORT_FIELDS = ["first_name", "last_name", "email", "phone_number"];
