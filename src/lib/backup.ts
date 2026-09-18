/**
 * Fellowship data backup — a labelled, per-tenure, restore-capable snapshot.
 *
 * Taken before a tenure handover, which is irreversible: once the session advances,
 * every generation's level is recomputed and the outgoing cabinet loses access. This
 * file is the undo. It is also useful on its own, as a yearly archive.
 *
 * PER TENURE
 *   A backup belongs to ONE tenure. Tables that carry a `tenure_id` are filtered to it
 *   (leadership, membership, transfers), so a bundle is a coherent picture of that
 *   session rather than an undifferentiated dump of every year at once. Tables without
 *   a tenure column — profiles, units, generations — are inherently shared and come
 *   whole, because a restore needs the people the tenure-scoped rows point at.
 *
 * REQUIRED VS OPTIONAL
 *   The identity and structure tables are REQUIRED: without them a bundle cannot
 *   rebuild the fellowship, so they aren't presented as a choice. Activity and audit
 *   tables are optional — useful, sometimes large, and a restore works without them.
 *
 * SECRETS
 *   Password hashes, session tokens and invite tokens never enter the file. Nothing is
 *   lost: a restored login with a null password enters the set-password-on-first-login
 *   flow the portal already uses for every new appointment.
 *
 * Server-only.
 */
import { ictAdmin } from "@/lib/ict";
import { csvCell } from "@/lib/csv";
import { createZip, type ZipEntry } from "@/lib/zip";
import {
    BACKUP_TABLES,
    OPTIONAL_TABLES,
    DEFAULT_TABLE_SELECTION,
    type TableSpec,
} from "@/lib/backup-tables";

/** Bumped when the shape of the bundle changes, so a restore can refuse a stranger. */
export const BACKUP_FORMAT_VERSION = 2;

/** Rows per request when paging a table out of PostgREST. */
const PAGE_SIZE = 1000;

// The registry lives in its own client-safe module; re-exported here so server-side
// callers can keep importing everything backup-related from one place.
export {
    BACKUP_GROUP_LABELS,
    BACKUP_TABLES,
    REQUIRED_TABLES,
    OPTIONAL_TABLES,
    DEFAULT_TABLE_SELECTION,
} from "@/lib/backup-tables";
export type { BackupGroup, TableSpec } from "@/lib/backup-tables";

export interface BackupManifest {
    formatVersion: number;
    tenure: { id: string | null; name: string | null; session: string | null };
    label: string;
    takenAt: string;
    takenBy: { id: string; name: string } | null;
    /** Tables actually included, and how many rows each contributed. */
    counts: Record<string, number>;
    /** Optional tables the operator chose to leave out. */
    excluded: string[];
    /** Tables that could not be read (e.g. a migration not yet applied). */
    skipped: { table: string; reason: string }[];
    redactions: string[];
    encrypted: boolean;
}

export interface Backup {
    manifest: BackupManifest;
    tables: Record<string, Record<string, unknown>[]>;
}

/** Page a whole table out through the service role, scoped to a tenure when it has one. */
async function dumpTable(spec: TableSpec, tenureId: string | null): Promise<Record<string, unknown>[]> {
    const rows: Record<string, unknown>[] = [];

    for (let from = 0; ; from += PAGE_SIZE) {
        let q = ictAdmin.supabase.from(spec.name).select("*");
        if (spec.tenureColumn && tenureId) q = q.eq(spec.tenureColumn, tenureId);

        const { data, error } = await q.range(from, from + PAGE_SIZE - 1);
        if (error) throw new Error(error.message);
        if (!data?.length) break;

        for (const row of data as Record<string, unknown>[]) {
            if (spec.redact?.length) {
                for (const column of spec.redact) {
                    if (column in row) row[column] = null;
                }
            }
            rows.push(row);
        }

        if (data.length < PAGE_SIZE) break;
    }

    return rows;
}

/**
 * The president of a tenure — the default passphrase holder.
 *
 * Resolved from the PRESIDENT privilege tag rather than a title string, so it keeps
 * working if the office is ever renamed.
 */
export async function getTenurePresidentName(tenureId: string | null): Promise<string | null> {
    if (!tenureId) return null;

    const { data } = await ictAdmin.supabase
        .from("leadership")
        .select("profile:profiles(first_name, last_name), position:leadership_positions!inner(position_privileges!inner(privilege))")
        .eq("tenure_id", tenureId)
        .eq("position.position_privileges.privilege", "PRESIDENT")
        .limit(1);

    // PostgREST returns an embedded relation as an object or a single-element array
    // depending on how it infers the cardinality; normalise both.
    type ProfileRow = { first_name?: string | null; last_name?: string | null };
    const row = (data ?? [])[0] as { profile?: ProfileRow | ProfileRow[] } | undefined;
    if (!row) return null;

    const p = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim();
    return name || null;
}

/**
 * Build a bundle for one tenure.
 *
 * A table that can't be read is RECORDED AND SKIPPED rather than aborting the whole
 * backup — this runs immediately before an irreversible handover, and a partial backup
 * that names its own gaps beats no backup because one migration hadn't been applied.
 */
export async function buildBackup(options: {
    takenBy: { id: string; name: string } | null;
    tenureId?: string | null;
    tables?: string[];
}): Promise<Backup> {
    const { data: tenure } = options.tenureId
        ? await ictAdmin.supabase
            .from("tenures").select("id, name, session").eq("id", options.tenureId).maybeSingle()
        : await ictAdmin.supabase
            .from("tenures").select("id, name, session").eq("is_active", true).maybeSingle();

    const tenureId = tenure?.id ?? null;

    // Required tables are forced in no matter what the caller asked for — a bundle
    // missing them isn't a backup, it's a file that looks like one.
    const requested = new Set(options.tables ?? DEFAULT_TABLE_SELECTION);
    const selected = BACKUP_TABLES.filter((t) => t.required || requested.has(t.name));

    const tables: Record<string, Record<string, unknown>[]> = {};
    const counts: Record<string, number> = {};
    const skipped: { table: string; reason: string }[] = [];

    for (const spec of selected) {
        try {
            const rows = await dumpTable(spec, tenureId);
            tables[spec.name] = rows;
            counts[spec.name] = rows.length;
        } catch (e) {
            skipped.push({
                table: spec.name,
                reason: e instanceof Error ? e.message : "unknown error",
            });
        }
    }

    const selectedNames = new Set(selected.map((t) => t.name));
    const excluded = OPTIONAL_TABLES.filter((n) => !selectedNames.has(n));

    return {
        manifest: {
            formatVersion: BACKUP_FORMAT_VERSION,
            tenure: {
                id: tenureId,
                name: tenure?.name ?? null,
                session: tenure?.session ?? null,
            },
            label: backupLabel(tenure?.name ?? null, tenure?.session ?? null),
            takenAt: new Date().toISOString(),
            takenBy: options.takenBy,
            counts,
            excluded,
            skipped,
            redactions: [
                "profile_login.password_hash — leaders set a new password on first login after a restore",
                "registration_invites.token — rotate tokens after a restore",
                "auth_sessions — live sessions are not backed up at all",
            ],
            encrypted: false,
        },
        tables,
    };
}

/** "dominion-2026-2027" — the human handle for this snapshot. */
export function backupLabel(name: string | null, session: string | null): string {
    const slug = (value: string) =>
        value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return [name && slug(name), session && slug(session)].filter(Boolean).join("-") || "fellowship";
}

/**
 * "rcf-backup-dominion-2026-2027-20260827.rcfbak"
 *
 * Encrypted bundles always get `.rcfbak` whatever they wrap — the extension says
 * "this needs a passphrase", which is the thing a person needs to know when they find
 * the file. Unencrypted ones get the extension their contents actually are.
 */
export function backupFilename(
    manifest: BackupManifest,
    encrypted: boolean,
    csv = false,
): string {
    const stamp = manifest.takenAt.slice(0, 10).replace(/-/g, "");
    const ext = encrypted ? "rcfbak" : csv ? "zip" : "json";
    return `rcf-backup-${manifest.label}-${stamp}.${ext}`;
}

/* -------------------------------------------------------------------------- */
/* CSV rendering                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Render one table as CSV.
 *
 * Headers are the UNION of every row's keys, not the first row's — PostgREST omits
 * nothing, but a table whose rows genuinely differ (a jsonb column read back
 * inconsistently, say) would otherwise lose columns silently.
 */
function tableToCsv(rows: Record<string, unknown>[]): string {
    if (!rows.length) return "";

    const columns: string[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
        for (const key of Object.keys(row)) {
            if (!seen.has(key)) {
                seen.add(key);
                columns.push(key);
            }
        }
    }

    const cell = (value: unknown) =>
        // Objects and arrays (jsonb columns) would stringify to "[object Object]".
        csvCell(value !== null && typeof value === "object" ? JSON.stringify(value) : value);

    return [
        columns.map(csvCell).join(","),
        ...rows.map((row) => columns.map((c) => cell(row[c])).join(",")),
    ].join("\r\n");
}

/**
 * The bundle as a ZIP of CSVs — one file per table, plus the manifest.
 *
 * For reading in a spreadsheet, not for restoring: CSV loses types (every cell becomes
 * text) and the relationships between tables, so `restore-backup.mjs` only accepts the
 * JSON form. The manifest is included so a CSV archive still says which tenure it is.
 */
export function backupToCsvZip(backup: Backup): Buffer {
    const entries: ZipEntry[] = [
        {
            name: "manifest.json",
            content: JSON.stringify(backup.manifest, null, 2),
        },
        {
            name: "README.txt",
            content: [
                `RCF FUTA backup — ${backup.manifest.tenure.name ?? "unknown tenure"} (${backup.manifest.tenure.session ?? "?"})`,
                `Taken ${backup.manifest.takenAt}${backup.manifest.takenBy ? ` by ${backup.manifest.takenBy.name}` : ""}`,
                "",
                "One CSV per table, under tables/. Open them in any spreadsheet app.",
                "",
                "This CSV archive is for READING. To restore a database, take a JSON",
                "backup instead — CSV loses column types and table relationships.",
                "",
                "Not included, by design:",
                ...backup.manifest.redactions.map((r) => `  - ${r}`),
            ].join("\n"),
        },
        ...Object.entries(backup.tables).map(([name, rows]) => ({
            name: `tables/${name}.csv`,
            content: tableToCsv(rows),
        })),
    ];

    return createZip(entries, new Date(backup.manifest.takenAt));
}
