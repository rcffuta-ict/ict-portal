/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSysAdmin, requirePresidentOrSysAdmin } from "@/lib/access-control";
import { getActiveTenure } from "@/utils/action";
import { computeLevel } from "@/lib/levels";
import { getProfileContext } from "@/lib/auth/profile-context";
import { csvCell, csvFilename } from "@/lib/csv";
import {
    ORACLE_FIELDS,
    getField,
    operatorsFor,
    VALUELESS_OPS,
    DEFAULT_COLUMNS,
    type Condition,
    type OracleQuery,
    type OracleField,
} from "./fields";

/**
 * Oracle — the System Admin's member directory, query engine and edit surface.
 *
 * AUTHORIZATION (read the whole comment before changing anything here)
 *   READ  → requirePresidentOrSysAdmin()  — the System Admin manages members; the
 *           President sees everything but writes nothing (globally write-blocked in
 *           src/lib/module-access.ts, and enforced again here).
 *   WRITE → requireSysAdmin()
 *   Both are re-checked INSIDE every action. Never inferred from the sidebar, the
 *   route, or a flag the client sent — src/proxy.ts is not an authorization boundary.
 *
 * Every query and every update runs through the FIELD REGISTRY in ./fields.ts. Field
 * names arriving from the browser are looked up there and rejected if absent; the
 * update payload is REBUILT from the registry rather than spread into `.update()`.
 * That whitelist is the security boundary for a service-role client that bypasses RLS.
 */

const MAX_PAGE_SIZE = 100;
/** An `id.in.(...)` term this long stops being a query and starts being a data dump. */
const MAX_ID_SET = 2000;
/** Hard ceiling on an export, so one click can't stream the whole DB into a browser. */
const MAX_EXPORT_ROWS = 5000;

/** A uuid no profile has — used to express "matches nothing" as a filter. */
const NO_MATCH_ID = "00000000-0000-0000-0000-000000000000";

/** Fields resolved through a join rather than a `profiles` column. */
const RELATIONAL_KEYS = new Set(["unit", "teams", "leadership"]);

/* -------------------------------------------------------------------------- */
/* Filter construction                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Strip PostgREST's `or()` grammar delimiters out of a user-supplied value.
 *
 * `or=(a.eq.1,b.eq.2)` is parsed by delimiter, so an unescaped comma or paren in a
 * value is filter injection — the same guard `getLevelMembersAction` applies.
 */
function safeValue(raw: unknown): string {
    return String(raw ?? "").replace(/[,()\\]/g, " ").trim();
}

/** Validate one condition against the registry. Throws rather than silently dropping. */
function validateCondition(c: Condition): OracleField {
    const field = getField(c.field);
    if (!field) throw new Error(`Unknown field: ${c.field}`);
    if (!field.filterable) throw new Error(`${field.label} can't be filtered on.`);
    if (!operatorsFor(field).includes(c.op)) {
        throw new Error(`"${c.op}" isn't a valid test for ${field.label}.`);
    }
    if (field.kind === "enum" && ["is", "is_not"].includes(c.op)) {
        const v = String(c.value ?? "");
        if (v && !(field.options ?? []).includes(v)) {
            throw new Error(`${v} isn't a valid ${field.label}.`);
        }
    }
    return field;
}

/**
 * One condition → a PostgREST filter string.
 * Only ever called with a field that has a real column (relational keys are resolved
 * to id sets before this point).
 */
function toFilterString(field: OracleField, c: Condition): string {
    const col = field.column as string;
    const v = safeValue(c.value);

    switch (c.op) {
        case "is":
            return `${col}.eq.${v}`;
        case "is_not":
            return `${col}.neq.${v}`;
        case "contains":
            return `${col}.ilike.%${v}%`;
        case "starts_with":
            return `${col}.ilike.${v}%`;
        case "in": {
            const parts = String(c.value ?? "")
                .split(",")
                .map((p) => safeValue(p))
                .filter(Boolean);
            if (!parts.length) throw new Error(`${field.label}: give at least one value.`);
            return `${col}.in.(${parts.join(",")})`;
        }
        case "gt":
            return `${col}.gt.${v}`;
        case "lt":
            return `${col}.lt.${v}`;
        case "between":
            return `and(${col}.gte.${v},${col}.lte.${safeValue(c.value2)})`;
        case "is_empty":
            return `${col}.is.null`;
        case "is_not_empty":
            return `${col}.not.is.null`;
        default:
            throw new Error(`Unsupported operator: ${c.op}`);
    }
}

interface RelationalMatch {
    ids: string[];
    /** True when the query wants everyone NOT in `ids` (i.e. "is not" / "is empty"). */
    negate: boolean;
}

/**
 * A relational condition (unit / teams / leadership) → the profile ids it selects.
 *
 * PostgREST can't filter a parent row by an embedded resource, so this is a required
 * two-phase lookup rather than a stylistic choice.
 *
 * These fields are MULTI-VALUED (a member can be in several teams), which makes the
 * negative operators subtle: "team is not Media" has to mean "is not in Media at all",
 * not "has some team other than Media". So the positive set is always resolved first
 * and then inverted by the caller — never filtered row-by-row, which would match a
 * member through their *other* team and quietly return the wrong people.
 */
async function resolveRelationalIds(
    c: Condition,
    tenureId: string | null,
): Promise<RelationalMatch> {
    const term = safeValue(c.value).toLowerCase();
    const names = String(c.value ?? "").split(",").map((n) => safeValue(n).toLowerCase()).filter(Boolean);

    // "is empty" / "is not empty" ask whether the member has ANY value at all, so the
    // positive set is simply everyone who holds one.
    const anyValue = c.op === "is_empty" || c.op === "is_not_empty";
    const nameMatches = (name: string): boolean => {
        if (anyValue) return true;
        const lower = (name ?? "").toLowerCase();
        switch (c.op) {
            case "is":
            case "is_not":
                return lower === term;
            case "in":
                return names.includes(lower);
            default:
                return lower.includes(term);
        }
    };

    // Inverted operators select the complement of the positive set.
    const negate = c.op === "is_not" || c.op === "is_empty";

    if (c.field === "leadership") {
        let q = db
            .from("leadership")
            .select("profile_id, position:leadership_positions(title)")
            .is("ended_at", null);
        if (tenureId) q = q.eq("tenure_id", tenureId);
        const { data } = await q;
        const ids = ((data ?? []) as any[])
            .filter((r) => {
                const pos = Array.isArray(r.position) ? r.position[0] : r.position;
                return nameMatches(pos?.title ?? "");
            })
            .map((r) => r.profile_id);
        return { ids, negate };
    }

    // unit / teams both live in membership_units, split by units.type.
    const wantType = c.field === "teams" ? "TEAM" : "UNIT";
    let q = db
        .from("membership_units")
        .select("profile_id, unit:units(name, type)");
    if (tenureId) q = q.eq("tenure_id", tenureId);
    const { data } = await q;
    const ids = ((data ?? []) as any[])
        .filter((r) => {
            const unit = Array.isArray(r.unit) ? r.unit[0] : r.unit;
            if (!unit || unit.type !== wantType) return false;
            return nameMatches(unit.name ?? "");
        })
        .map((r) => r.profile_id);
    return { ids, negate };
}

/* -------------------------------------------------------------------------- */
/* Query                                                                      */
/* -------------------------------------------------------------------------- */

/** Columns the main select must carry so derived values can be resolved afterwards. */
function selectColumnsFor(columns: string[]): string[] {
    const cols = new Set<string>(["id"]);
    for (const key of columns) {
        const f = getField(key);
        if (f?.column) cols.add(f.column);
        if (key === "level" || key === "generation") cols.add("class_set_id");
        if (key === "zone" || key === "residential_zone_id") cols.add("residential_zone_id");
    }
    return [...cols];
}

interface BuiltRows {
    rows: any[];
    total: number;
}

/** Shared by the paged query and the export: validate, filter, fetch. */
async function fetchRows(query: OracleQuery, opts: { paged: boolean }): Promise<BuiltRows> {
    const conditions = query.conditions ?? [];
    const match = query.match === "any" ? "any" : "all";
    const columns = (query.columns?.length ? query.columns : DEFAULT_COLUMNS).filter((c) =>
        getField(c),
    );

    const tenure = await getActiveTenure();
    const tenureId = (tenure as any)?.id ?? null;

    // Validate EVERYTHING before touching the database.
    const validated = conditions.map((c) => ({ c, field: validateCondition(c) }));

    const columnTerms: string[] = [];
    const idSets: RelationalMatch[] = [];

    for (const { c, field } of validated) {
        if (RELATIONAL_KEYS.has(field.key)) {
            const match = await resolveRelationalIds(c, tenureId);
            idSets.push({ ids: [...new Set(match.ids)], negate: match.negate });
        } else {
            if (!field.column) throw new Error(`${field.label} can't be filtered on.`);
            if (!VALUELESS_OPS.includes(c.op) && !String(c.value ?? "").trim()) {
                throw new Error(`${field.label}: enter a value.`);
            }
            if (c.op === "between" && !String(c.value2 ?? "").trim()) {
                throw new Error(`${field.label}: "is between" needs both values.`);
            }
            columnTerms.push(toFilterString(field, c));
        }
    }

    let q = db
        .from("profiles")
        .select(selectColumnsFor(columns).join(", "), { count: "exact" });

    if (match === "all") {
        // Chained .or() calls are ANDed together, so one call per condition gives AND.
        for (const term of columnTerms) q = q.or(term);
        for (const { ids, negate } of idSets) {
            if (negate) {
                // "not in an empty set" is everyone — skip the filter rather than emit
                // `not.in.()`, which PostgREST rejects.
                if (ids.length) q = q.not("id", "in", `(${ids.join(",")})`);
            } else {
                q = q.in("id", ids.length ? ids : [NO_MATCH_ID]);
            }
        }
    } else if (columnTerms.length || idSets.length) {
        const anyTerms = [...columnTerms];
        for (const { ids, negate } of idSets) {
            if (ids.length > MAX_ID_SET) {
                throw new Error(
                    "That 'any of' query matches too many members through a unit or position. Switch to 'all' or add a narrower condition.",
                );
            }
            // Inside an or(), a negated set has to be expressed as a term too.
            if (negate) anyTerms.push(ids.length ? `id.not.in.(${ids.join(",")})` : "id.not.is.null");
            else if (ids.length) anyTerms.push(`id.in.(${ids.join(",")})`);
        }
        if (anyTerms.length) q = q.or(anyTerms.join(","));
    }

    // Free-text search, on top of the conditions — same shape as getLevelMembersAction.
    const term = query.search?.trim();
    if (term) {
        const safe = safeValue(term);
        q = q.or(
            ["first_name", "last_name", "email", "phone_number", "matric_number"]
                .map((c) => `${c}.ilike.%${safe}%`)
                .join(","),
        );
    }

    const sortField = query.sort ? getField(query.sort.field) : null;
    if (sortField?.column && sortField.sortable) {
        q = q.order(sortField.column, { ascending: query.sort!.direction !== "desc" });
    } else {
        q = q.order("first_name");
    }

    if (opts.paged) {
        const pageSize = Math.min(Math.max(query.pageSize ?? 25, 1), MAX_PAGE_SIZE);
        const page = Math.max(query.page ?? 1, 1);
        const from = (page - 1) * pageSize;
        q = q.range(from, from + pageSize - 1);
    } else {
        q = q.range(0, MAX_EXPORT_ROWS - 1);
    }

    const { data, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as any[], total: count ?? 0 };
}

/**
 * Attach derived values (level, generation, zone, unit, teams, leadership) to rows.
 * Each lookup only runs when its column was actually requested — a query for names
 * and phone numbers never pays for the membership join.
 */
async function decorate(rows: any[], columns: string[], tenureId: string | null) {
    if (!rows.length) return rows;
    const ids = rows.map((r) => r.id);
    const want = new Set(columns);

    if (want.has("level") || want.has("generation") || want.has("class_set_id")) {
        const tenure = await getActiveTenure();
        const session = (tenure as any)?.session ?? null;
        const { data: sets } = await db
            .from("class_sets")
            .select("id, family_name, entry_year, is_foundation, level_override");
        const byId = new Map((sets ?? []).map((s: any) => [s.id, s]));
        for (const r of rows) {
            const s = r.class_set_id ? byId.get(r.class_set_id) : null;
            r.__generation = s?.family_name ?? null;
            r.__level = s
                ? s.level_override || computeLevel(s.entry_year, s.is_foundation, session)
                : null;
        }
    }

    if (want.has("zone") || want.has("residential_zone_id")) {
        const { data: zones } = await db
            .from("residential_zones")
            .select("id, name");
        const byId = new Map((zones ?? []).map((z: any) => [z.id, z.name]));
        for (const r of rows) {
            r.__zone = r.residential_zone_id ? byId.get(r.residential_zone_id) ?? null : null;
        }
    }

    if (want.has("unit") || want.has("teams")) {
        let mq = db
            .from("membership_units")
            .select("profile_id, unit:units(name, type)")
            .in("profile_id", ids);
        if (tenureId) mq = mq.eq("tenure_id", tenureId);
        const { data: memberships } = await mq;
        const unitBy = new Map<string, string>();
        const teamsBy = new Map<string, string[]>();
        for (const m of (memberships ?? []) as any[]) {
            const unit = Array.isArray(m.unit) ? m.unit[0] : m.unit;
            if (!unit) continue;
            if (unit.type === "TEAM") {
                teamsBy.set(m.profile_id, [...(teamsBy.get(m.profile_id) ?? []), unit.name]);
            } else {
                unitBy.set(m.profile_id, unit.name);
            }
        }
        for (const r of rows) {
            r.__unit = unitBy.get(r.id) ?? null;
            r.__teams = (teamsBy.get(r.id) ?? []).join(", ") || null;
        }
    }

    if (want.has("leadership")) {
        let lq = db
            .from("leadership")
            .select("profile_id, position:leadership_positions(title)")
            .in("profile_id", ids)
            .is("ended_at", null);
        if (tenureId) lq = lq.eq("tenure_id", tenureId);
        const { data: leads } = await lq;
        const by = new Map<string, string[]>();
        for (const l of (leads ?? []) as any[]) {
            const pos = Array.isArray(l.position) ? l.position[0] : l.position;
            if (pos?.title) by.set(l.profile_id, [...(by.get(l.profile_id) ?? []), pos.title]);
        }
        for (const r of rows) r.__leadership = (by.get(r.id) ?? []).join(", ") || null;
    }

    return rows;
}

/** The display value of one column for one row. */
function cellValue(row: any, key: string): unknown {
    switch (key) {
        case "level": return row.__level;
        case "generation": return row.__generation;
        case "zone": return row.__zone;
        case "unit": return row.__unit;
        case "teams": return row.__teams;
        case "leadership": return row.__leadership;
        case "class_set_id": return row.__generation ?? row.class_set_id;
        case "residential_zone_id": return row.__zone ?? row.residential_zone_id;
        default: {
            const f = getField(key);
            return f?.column ? row[f.column] : null;
        }
    }
}

/**
 * Run a query and return one page of flattened rows.
 * Read-gated: System Admin or President.
 */
export async function runOracleQuery(query: OracleQuery) {
    try {
        await requirePresidentOrSysAdmin();

        const columns = (query.columns?.length ? query.columns : DEFAULT_COLUMNS).filter((c) =>
            getField(c),
        );
        const { rows, total } = await fetchRows(query, { paged: true });
        const tenure = await getActiveTenure();
        await decorate(rows, columns, (tenure as any)?.id ?? null);

        const pageSize = Math.min(Math.max(query.pageSize ?? 25, 1), MAX_PAGE_SIZE);
        const page = Math.max(query.page ?? 1, 1);

        return {
            success: true as const,
            columns,
            rows: rows.map((r) => ({
                id: r.id,
                cells: Object.fromEntries(columns.map((c) => [c, cellValue(r, c) ?? null])),
            })),
            total,
            page,
            pageSize,
            hasMore: total > (page - 1) * pageSize + rows.length,
        };
    } catch (e: any) {
        return { success: false as const, error: e.message || "Query failed.", rows: [], columns: [], total: 0 };
    }
}

/**
 * The same query, rendered as CSV.
 *
 * An export is a bulk read of the rows the table already shows, so it is gated by the
 * same check — it must never be an easier way to obtain data than the screen it mirrors.
 */
export async function exportOracleQuery(query: OracleQuery) {
    try {
        await requirePresidentOrSysAdmin();

        const columns = (query.columns?.length ? query.columns : DEFAULT_COLUMNS).filter((c) =>
            getField(c),
        );
        if (columns.length < 2) {
            return { success: false as const, error: "Choose at least two columns to export." };
        }

        const { rows } = await fetchRows(query, { paged: false });
        const tenure = await getActiveTenure();
        await decorate(rows, columns, (tenure as any)?.id ?? null);

        const header = columns.map((c) => csvCell(getField(c)?.label ?? c)).join(",");
        const body = rows.map((r) => columns.map((c) => csvCell(cellValue(r, c))).join(","));

        return {
            success: true as const,
            csv: [header, ...body].join("\r\n"),
            filename: csvFilename("fellowship-members"),
            count: rows.length,
            truncated: rows.length >= MAX_EXPORT_ROWS,
        };
    } catch (e: any) {
        return { success: false as const, error: e.message || "Export failed." };
    }
}

/** Zones / generations / units for the ref pickers and the editor's selects. */
export async function getOracleRefData() {
    try {
        await requirePresidentOrSysAdmin();
        const [zones, sets, units] = await Promise.all([
            db.from("residential_zones").select("id, name").order("name"),
            db.from("class_sets").select("id, family_name, entry_year").order("entry_year", { ascending: false }),
            db.from("units").select("id, name, type").order("name"),
        ]);
        return {
            success: true as const,
            zones: zones.data ?? [],
            classSets: sets.data ?? [],
            units: units.data ?? [],
        };
    } catch (e: any) {
        return { success: false as const, error: e.message, zones: [], classSets: [], units: [] };
    }
}

/* -------------------------------------------------------------------------- */
/* One member                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Everything the app holds about one member, plus whether the caller may write.
 * `canWrite` drives the UI only — updateMemberAction re-checks it server-side.
 */
export async function getMemberRecord(profileId: string) {
    try {
        const ctx = await requirePresidentOrSysAdmin();

        const { data: raw, error } = await db
            .from("profiles")
            .select("*")
            .eq("id", profileId)
            .maybeSingle();
        if (error) throw new Error(error.message);
        if (!raw) return { success: false as const, error: "Member not found.", canWrite: false };

        const context = await getProfileContext(profileId);
        const tenure = await getActiveTenure();
        const tenureId = (tenure as any)?.id ?? null;

        let mq = db
            .from("membership_units")
            .select("unit_id, unit:units(id, name, type)")
            .eq("profile_id", profileId);
        if (tenureId) mq = mq.eq("tenure_id", tenureId);
        const { data: memberships } = await mq;

        const unitIds: string[] = [];
        const teamIds: string[] = [];
        for (const m of (memberships ?? []) as any[]) {
            const u = Array.isArray(m.unit) ? m.unit[0] : m.unit;
            if (!u) continue;
            (u.type === "TEAM" ? teamIds : unitIds).push(u.id);
        }

        return {
            success: true as const,
            /** Raw `profiles` row — the editor binds directly to registry columns. */
            row: raw,
            /** Enriched view (level, roles, unit names) for the read-only summary. */
            context,
            unitId: unitIds[0] ?? null,
            teamIds,
            canWrite: ctx.isSysAdmin === true,
        };
    } catch (e: any) {
        return { success: false as const, error: e.message, canWrite: false };
    }
}

/** Normalise one incoming value for its field kind. Empty string becomes NULL. */
function coerce(field: OracleField, value: unknown): unknown {
    if (value === null || value === undefined) return null;
    const s = String(value).trim();
    if (s === "") return null;

    switch (field.kind) {
        case "number": {
            const n = Number(s);
            if (!Number.isFinite(n)) throw new Error(`${field.label} must be a number.`);
            return n;
        }
        case "date": {
            if (Number.isNaN(new Date(s).getTime())) {
                throw new Error(`${field.label} isn't a valid date.`);
            }
            return s;
        }
        case "enum": {
            if (!(field.options ?? []).includes(s)) {
                throw new Error(`${s} isn't a valid ${field.label}.`);
            }
            return s;
        }
        case "ref": {
            if (!/^[0-9a-f-]{36}$/i.test(s)) throw new Error(`${field.label} must be a valid reference.`);
            return s;
        }
        default:
            return s;
    }
}

function displayName(row: any): string {
    return [row?.first_name, row?.last_name].filter(Boolean).join(" ") || "Unknown";
}

/**
 * Update a member's record. **System Admin only** — the President reads but never writes.
 *
 * The patch is never spread into `.update()`. Every key is looked up in the registry
 * and rejected unless it is marked `editable`, then the update object is rebuilt from
 * the registry's own column names. A request naming `email`, `id` or `matric_number`
 * fails the check instead of quietly succeeding.
 */
export async function updateMemberAction(profileId: string, patch: Record<string, unknown>) {
    try {
        const ctx = await requireSysAdmin();

        const { data: before, error: readErr } = await db
            .from("profiles")
            .select("*")
            .eq("id", profileId)
            .maybeSingle();
        if (readErr) throw new Error(readErr.message);
        if (!before) return { success: false as const, error: "Member not found." };

        const update: Record<string, unknown> = {};
        const changes: { field: string; label: string; from: unknown; to: unknown }[] = [];

        for (const [key, rawValue] of Object.entries(patch ?? {})) {
            const field = getField(key);
            if (!field) throw new Error(`Unknown field: ${key}`);
            if (!field.editable || !field.column) {
                throw new Error(
                    `${field.label} can't be edited${field.lockReason ? ` — ${field.lockReason}` : "."}`,
                );
            }
            const value = coerce(field, rawValue);
            const current = before[field.column] ?? null;
            // Compare as strings so 2019 and "2019" don't read as a change.
            if (String(current ?? "") === String(value ?? "")) continue;
            update[field.column] = value;
            changes.push({ field: field.column, label: field.label, from: current, to: value });
        }

        if (!changes.length) {
            return { success: true as const, changed: 0, message: "Nothing to change." };
        }

        update.updated_at = new Date().toISOString();

        const { error } = await db
            .from("profiles")
            .update(update)
            .eq("id", profileId);

        if (error) {
            // 23505 = unique violation. The only editable unique column is matric_number,
            // but surface the column name rather than a raw driver message either way.
            if ((error as any).code === "23505") {
                return {
                    success: false as const,
                    error: "Another member already has that value — the field must be unique.",
                };
            }
            throw new Error(error.message);
        }

        await writeAudit(
            ctx,
            profileId,
            displayName(before),
            "profile.update",
            changes.map((c) => ({ field: c.field, from: c.from, to: c.to })),
        );

        revalidatePath(`/dashboard/oracle/${profileId}`);
        revalidatePath("/dashboard/oracle");
        return { success: true as const, changed: changes.length };
    } catch (e: any) {
        return { success: false as const, error: e.message || "Update failed." };
    }
}

/**
 * Set a member's unit and teams for the ACTIVE tenure.
 *
 * Membership is tenure-scoped, so this only ever touches rows for the active tenure —
 * last session's workforce history stays intact.
 */
export async function updateMembershipAction(
    profileId: string,
    next: { unitId: string | null; teamIds: string[] },
) {
    try {
        const ctx = await requireSysAdmin();

        const tenure = await getActiveTenure();
        const tenureId = (tenure as any)?.id ?? null;
        if (!tenureId) {
            return { success: false as const, error: "There is no active tenure to assign membership in." };
        }

        const { data: profile } = await db
            .from("profiles").select("first_name, last_name").eq("id", profileId).maybeSingle();
        if (!profile) return { success: false as const, error: "Member not found." };

        // Validate every id against `units` — the client can't name a row that isn't a unit.
        const wanted = [next.unitId, ...(next.teamIds ?? [])].filter(Boolean) as string[];
        const { data: units } = await db
            .from("units").select("id, name, type").in("id", wanted.length ? wanted : [NO_MATCH_ID]);
        const byId = new Map((units ?? []).map((u: any) => [u.id, u]));
        for (const id of wanted) {
            if (!byId.has(id)) throw new Error("That unit or team doesn't exist.");
        }
        if (next.unitId && byId.get(next.unitId)?.type !== "UNIT") {
            throw new Error("The selected unit is a team, not a unit.");
        }
        for (const id of next.teamIds ?? []) {
            if (byId.get(id)?.type !== "TEAM") throw new Error("One of the selected teams is not a team.");
        }

        const { data: existing } = await db
            .from("membership_units")
            .select("id, unit_id, unit:units(name, type)")
            .eq("profile_id", profileId)
            .eq("tenure_id", tenureId);

        const before = (existing ?? []) as any[];
        const beforeIds = new Set(before.map((m) => m.unit_id));
        const afterIds = new Set(wanted);

        const toRemove = before.filter((m) => !afterIds.has(m.unit_id));
        const toAdd = wanted.filter((id) => !beforeIds.has(id));

        if (toRemove.length) {
            const { error } = await db
                .from("membership_units")
                .delete()
                .in("id", toRemove.map((m) => m.id));
            if (error) throw new Error(error.message);
        }
        if (toAdd.length) {
            const { error } = await db.from("membership_units").insert(
                toAdd.map((unit_id) => ({ profile_id: profileId, unit_id, tenure_id: tenureId })),
            );
            if (error) throw new Error(error.message);
        }

        if (!toRemove.length && !toAdd.length) {
            return { success: true as const, changed: 0, message: "Nothing to change." };
        }

        const nameOf = (id: string) => byId.get(id)?.name ?? id;
        await writeAudit(
            ctx,
            profileId,
            [profile.first_name, profile.last_name].filter(Boolean).join(" "),
            "membership.update",
            [
                ...toRemove.map((m) => {
                    const u = Array.isArray(m.unit) ? m.unit[0] : m.unit;
                    return { field: (u?.type === "TEAM" ? "team" : "unit"), from: u?.name ?? m.unit_id, to: null };
                }),
                ...toAdd.map((id) => ({
                    field: byId.get(id)?.type === "TEAM" ? "team" : "unit",
                    from: null,
                    to: nameOf(id),
                })),
            ],
        );

        revalidatePath(`/dashboard/oracle/${profileId}`);
        return { success: true as const, changed: toRemove.length + toAdd.length };
    } catch (e: any) {
        return { success: false as const, error: e.message || "Could not update membership." };
    }
}

/* -------------------------------------------------------------------------- */
/* Audit                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Record one row per changed field.
 *
 * Audit failures are logged but never fail the edit — losing the trail for one change is
 * bad, but rolling back a correction the admin already saw succeed is worse and more
 * confusing. A missing `admin_audit_log` table (migration 0010 not yet applied) therefore
 * degrades to "edits work, nothing is logged" rather than "the page is broken".
 */
async function writeAudit(
    ctx: any,
    targetId: string,
    targetName: string,
    action: string,
    changes: { field: string; from: unknown; to: unknown }[],
) {
    if (!changes.length) return;
    const actorName = [ctx?.profile?.firstName, ctx?.profile?.lastName].filter(Boolean).join(" ");
    const { error } = await db.from("admin_audit_log").insert(
        changes.map((c) => ({
            actor_profile_id: ctx.profile.id,
            actor_name: actorName || null,
            target_profile_id: targetId,
            target_name: targetName,
            action,
            field: c.field,
            old_value: c.from === null || c.from === undefined ? null : String(c.from),
            new_value: c.to === null || c.to === undefined ? null : String(c.to),
        })),
    );
    if (error) console.error("admin_audit_log insert failed:", error.message);
}

/** Recent changes to one member, newest first. Read-gated like everything else here. */
export async function getAuditTrail(profileId: string, limit = 50) {
    try {
        await requirePresidentOrSysAdmin();
        const { data, error } = await db
            .from("admin_audit_log")
            .select("id, actor_name, action, field, old_value, new_value, created_at")
            .eq("target_profile_id", profileId)
            .order("created_at", { ascending: false })
            .limit(Math.min(Math.max(limit, 1), 200));
        if (error) {
            // Migration 0010 not applied yet — say so plainly instead of showing a crash.
            return { success: false as const, error: "Audit log unavailable.", data: [] };
        }
        return { success: true as const, data: data ?? [] };
    } catch (e: any) {
        return { success: false as const, error: e.message, data: [] };
    }
}

/** The registry, for server components that render pickers. */
export async function getOracleFields() {
    await requirePresidentOrSysAdmin();
    return ORACLE_FIELDS;
}
