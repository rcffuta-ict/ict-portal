/**
 * Client-safe privilege helpers shared by the privilege builder (live UI), the pills
 * display, and the tenure server actions. Keep free of server-only imports.
 *
 * The authorization model lives in db/migrations/0006_privilege_tags.sql +
 * src/lib/access-control.ts. This file is presentation + validation only.
 */
import {
    PRIVILEGE_TAGS,
    LEVEL_SCOPE_TOKENS,
    CONFIGURABLE_PRIVILEGE_TOKENS,
    type PrivilegeTag,
    type Privilege,
} from "@/lib/modules";

export type ScopeKind = "none" | "unit" | "level";

export interface PrivilegeMeta {
    /** Full label (menus, headings). */
    label: string;
    /** Short label used in pills (e.g. "Exco"). */
    shortLabel: string;
    /** One-liner shown under the toggle in the builder. */
    description: string;
    /** Tailwind classes for the pill/chip (border + bg + text). */
    colorClasses: string;
    /** Whether the tag carries a scope, and what kind of picker it needs. */
    scopeKind: ScopeKind;
    /** Whether VP Admin may assign it in the UI (SYSADMIN is tied to ict-coord). */
    assignable: boolean;
}

export const PRIVILEGE_META: Record<PrivilegeTag, PrivilegeMeta> = {
    EXCO: {
        label: "Executive",
        shortLabel: "Exco",
        description: "Manages a unit/team. Pick its scope; no scope = church-wide (central).",
        colorClasses: "border-blue-200 bg-blue-50 text-blue-700",
        scopeKind: "unit",
        assignable: true,
    },
    LEVEL: {
        label: "Level",
        shortLabel: "Level",
        description: "Works a level. Pick which one; no scope = all levels.",
        colorClasses: "border-orange-200 bg-orange-50 text-orange-700",
        scopeKind: "level",
        assignable: true,
    },
    ZONE: {
        label: "Zone",
        shortLabel: "Zone",
        description: "Zone-wide access (zone:all).",
        colorClasses: "border-emerald-200 bg-emerald-50 text-emerald-700",
        scopeKind: "none",
        assignable: true,
    },
    CENTRAL: {
        label: "Central",
        shortLabel: "Central",
        description: "Read-only across every module (except Settings). Fellowship-wide.",
        colorClasses: "border-purple-200 bg-purple-50 text-purple-700",
        scopeKind: "none",
        assignable: true,
    },
    PRESIDENT: {
        label: "President",
        shortLabel: "President",
        description: "Supreme · single & unique. Sees everything (incl. Settings), changes nothing.",
        colorClasses: "border-rose-200 bg-rose-50 text-rose-700",
        scopeKind: "none",
        assignable: true,
    },
    SYSADMIN: {
        label: "System Admin",
        shortLabel: "System Admin",
        description: "Tied to the ICT Coordinator. Manages the entire system.",
        colorClasses: "border-indigo-200 bg-indigo-50 text-indigo-700",
        scopeKind: "none",
        assignable: false,
    },
};

/** Tags VP Admin may pick in the builder (SYSADMIN excluded — tied to ict-coord). */
export const ASSIGNABLE_TAGS: PrivilegeTag[] = PRIVILEGE_TAGS.filter(
    (t) => PRIVILEGE_META[t].assignable,
);

/** Human labels for the level scope tokens, in picker order. */
export const LEVEL_SCOPE_LABELS: Record<string, string> = {
    "100": "100 Level",
    "200": "200 Level",
    "300": "300 Level",
    "400": "400 Level",
    "500": "500 Level",
    "pds-uabs": "PDS / UABS",
};

/**
 * Validate a set of privileges for one position. Returns an error message, or null when
 * the set is valid. Mirrors (and pre-empts) the DB trigger enforce_position_privilege_rules,
 * plus the UI-only "SYSADMIN not assignable" rule the trigger can't express.
 */
export function validatePrivilegeSet(privs: Privilege[]): string | null {
    const tags = new Set(privs.map((p) => p.tag));

    if (tags.has("SYSADMIN")) {
        return "System Admin is reserved for the ICT Coordinator and can't be assigned here.";
    }
    if (tags.has("EXCO") && tags.has("LEVEL")) {
        return "A role can't be both Exco and Level — pick one.";
    }
    if (tags.has("PRESIDENT") && tags.size > 1) {
        return "President is supreme and can't be combined with other privileges.";
    }
    for (const p of privs) {
        if (p.tag === "LEVEL" && p.scope != null) {
            if (!LEVEL_SCOPE_TOKENS.includes(p.scope as (typeof LEVEL_SCOPE_TOKENS)[number])) {
                return `"${p.scope}" is not a valid level scope.`;
            }
        }
    }
    return null;
}

/**
 * Derive the legacy `leadership_positions.category` value from a privilege set, so the
 * still-NOT-NULL column stays populated. The new UI reads privileges, not category.
 */
export function deriveCategory(privs: Privilege[]): string {
    const tags = new Set(privs.map((p) => p.tag));
    if (tags.has("PRESIDENT")) return "PRESIDENT";
    if (tags.has("CENTRAL") || tags.has("SYSADMIN")) return "CENTRAL";
    if (tags.has("LEVEL")) return "LEVEL";
    if (tags.has("ZONE")) return "ZONE";
    return "UNIT"; // EXCO or empty
}

/**
 * Normalise raw privilege rows into `Privilege[]`. Accepts both the DB shape
 * (`{ privilege, scope }` from position_privileges) and the builder shape (`{ tag, scope }`).
 */
export function normalizePrivileges(
    rows?: ({ tag?: string; privilege?: string; scope?: string | null } | null)[] | null,
): Privilege[] {
    return (rows ?? [])
        .map((r) => ({ tag: (r?.tag ?? r?.privilege) as PrivilegeTag, scope: r?.scope ?? null }))
        .filter((r) => !!r.tag && PRIVILEGE_TAGS.includes(r.tag));
}

// ---------------------------------------------------------------------------
// Module-access tokens (the Settings editor + the module-access resolver)
// ---------------------------------------------------------------------------
// A module's read/write list may contain three token kinds, matched against what a user
// "holds" in src/lib/module-access.ts:
//   - a bare privilege tag  (CENTRAL | EXCO | ZONE | LEVEL)   → any holder of that tag
//   - a scoped tag          (EXCO:<unit-slug> | LEVEL:<token>) → only that scope
//   - a position slug       (e.g. zone-coord)                  → only that position's holders

const CONFIGURABLE_TAG_SET = new Set<string>(CONFIGURABLE_PRIVILEGE_TOKENS);

export type AccessTokenKind = "tag" | "scoped-tag" | "slug" | "invalid";

export interface ClassifiedToken {
    kind: AccessTokenKind;
    /** The normalised token as stored/compared (tag UPPER, slug/scope lower). */
    token: string;
    /** Human-friendly label for the pill. */
    label: string;
    /** Set when addable but suspect (e.g. a slug that matches no known position). */
    warning?: string;
    /** Set when the token is malformed and must not be added. */
    error?: string;
}

/** Normalise a raw access token: uppercase the tag part, lowercase slug/scope. */
export function normalizeAccessToken(raw: string): string {
    const value = (raw ?? "").trim();
    if (!value) return "";
    if (value.includes(":")) {
        const [tag, ...rest] = value.split(":");
        return `${tag.toUpperCase()}:${rest.join(":").toLowerCase()}`;
    }
    if (CONFIGURABLE_TAG_SET.has(value.toUpperCase())) return value.toUpperCase();
    return value.toLowerCase();
}

/**
 * Classify + validate a raw module-access token against the known positions/units.
 * Malformed scoped tags are `invalid` (block); unknown slugs are allowed with a `warning`
 * (a position may not exist yet, or the slug may belong to a sibling app in the same project).
 */
export function classifyAccessToken(
    raw: string,
    opts: { positionSlugs: Set<string>; unitSlugs: Set<string> },
): ClassifiedToken {
    const token = normalizeAccessToken(raw);
    if (!token) return { kind: "invalid", token: "", label: "", error: "Enter a token." };

    if (token.includes(":")) {
        const [tag, scope] = token.split(":");
        if (tag === "EXCO") {
            if (!scope) return { kind: "invalid", token, label: token, error: "Exco needs a unit scope, e.g. EXCO:bible-study." };
            if (!opts.unitSlugs.has(scope)) {
                return { kind: "invalid", token, label: token, error: `No unit/team with slug "${scope}".` };
            }
            return { kind: "scoped-tag", token, label: `Exco · ${scope}` };
        }
        if (tag === "LEVEL") {
            if (!LEVEL_SCOPE_TOKENS.includes(scope as (typeof LEVEL_SCOPE_TOKENS)[number])) {
                return { kind: "invalid", token, label: token, error: `"${scope}" is not a valid level scope.` };
            }
            return { kind: "scoped-tag", token, label: `Level · ${LEVEL_SCOPE_LABELS[scope] ?? scope}` };
        }
        return { kind: "invalid", token, label: token, error: `"${tag}" can't be scoped — use a bare tag or a slug.` };
    }

    if (CONFIGURABLE_TAG_SET.has(token)) {
        return { kind: "tag", token, label: PRIVILEGE_META[token as PrivilegeTag].label };
    }

    return {
        kind: "slug",
        token,
        label: token,
        warning: opts.positionSlugs.has(token) ? undefined : `No active position uses the slug "${token}".`,
    };
}

/** A short display label for one privilege, e.g. "Exco:bible-study", "Level:100", "Central". */
export function scopeLabel(priv: Privilege): string {
    const meta = PRIVILEGE_META[priv.tag];
    if (meta.scopeKind === "none" || priv.scope == null || priv.scope === "all") {
        return meta.shortLabel;
    }
    return `${meta.shortLabel}:${priv.scope}`;
}
