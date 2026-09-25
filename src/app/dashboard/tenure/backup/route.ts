import { NextResponse, type NextRequest } from "next/server";
import { getCurrentContext } from "@/lib/access-control";
import {
    buildBackup,
    backupFilename,
    backupToCsvZip,
    getTenurePresidentName,
    tablesForScope,
    type BackupScope,
} from "@/lib/backup";
import { encryptBackup, normalizePassphrase, type BackupPayload } from "@/lib/backup-crypto";
import { db } from "@/lib/db";

/**
 * Download a fellowship backup bundle for one tenure.
 *
 * A ROUTE HANDLER rather than a server action: the bundle runs to megabytes on a real
 * fellowship, and a route handler hands it straight to the browser as a file download
 * instead of round-tripping it through a React server-action payload and back out
 * through a Blob.
 *
 * Query parameters:
 *   tenure=<uuid>     which tenure to back up (default: the active one)
 *   tables=a,b,c      optional tables to include; required ones are always added
 *   format=json|csv   json restores; csv is a ZIP of spreadsheets for reading
 *   lock=0            skip encryption (tenure scope only — ignored for system)
 *   passphrase=…      override the default (the tenure president's name)
 *   scope=system      FULL SYSTEM INSURANCE (see below)
 *
 * TWO SCOPES, TWO DIFFERENT PRODUCTS
 *   scope=tenure (default) — the LITE backup. VP Admin or System Admin. Tenure-scoped
 *       tables are filtered to one tenure. This is the handover gate: evidence that the
 *       outgoing tenure was captured.
 *   scope=system — FULL SYSTEM INSURANCE. System Admin ONLY. No tenure filtering at all,
 *       every tenure and all history, encryption MANDATORY, and the other applications'
 *       tables available (off by default). This is the undo for a structural migration —
 *       a tenure-scoped file cannot restore a dropped column or a deleted tenure.
 *
 * AUTHORIZATION: System Admin or VP Admin. This is the most sensitive export in the app
 * (every member's contact details and home address in one file), so it is deliberately
 * NOT open to the wider read-bypass tier that can browse the same data a screen at a
 * time. The system scope narrows further still, to the System Admin alone.
 */
export async function GET(request: NextRequest) {
    const ctx = await getCurrentContext();

    if (!ctx) {
        return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (!ctx.isSysAdmin && !ctx.isVpAdmin) {
        return NextResponse.json(
            { error: "Only the System Admin or VP Admin can download a backup." },
            { status: 403 },
        );
    }

    try {
        const params = request.nextUrl.searchParams;
        const tenureId = params.get("tenure");
        const scope: BackupScope = params.get("scope") === "system" ? "system" : "tenure";

        // The full-system export reaches across every tenure and can include other
        // applications' data. That is the System Admin's call alone — the VP Admin runs
        // handovers, which is the tenure scope.
        if (scope === "system" && !ctx.isSysAdmin) {
            return NextResponse.json(
                { error: "Only the System Admin can take a full system backup." },
                { status: 403 },
            );
        }

        // Validate every requested table against the registry FOR THIS SCOPE — the
        // browser can't name a table the backup doesn't already know about, and can't
        // reach a foreign-app table from the tenure scope at all.
        const known = new Set(tablesForScope(scope).map((t) => t.name));
        const tablesParam = params.get("tables");
        const tables = tablesParam
            ? tablesParam.split(",").map((t) => t.trim()).filter((t) => known.has(t))
            : undefined;

        const actorName = [ctx.profile.firstName, ctx.profile.lastName].filter(Boolean).join(" ");
        const backup = await buildBackup({
            takenBy: { id: ctx.profile.id, name: actorName },
            tenureId,
            tables,
            scope,
        });

        // Default passphrase: the president of the tenure being backed up. Memorable and
        // still recoverable years later, which is the property that matters for an
        // archive nobody opens until something has gone wrong.
        const president = await getTenurePresidentName(backup.manifest.tenure.id);
        const custom = params.get("passphrase");
        const passphrase = custom?.trim() || president;

        // Encryption is optional for a tenure backup and MANDATORY for system insurance:
        // that file is every member's home address and phone number across every tenure
        // the fellowship has ever had, and it exists to be stored somewhere for years.
        // An unencrypted copy of it sitting in a Downloads folder is the actual risk.
        if (scope === "system" && !passphrase) {
            return NextResponse.json(
                {
                    error:
                        "A full system backup must be encrypted, and no passphrase could be "
                        + "derived. Set one explicitly, or appoint a President for this tenure.",
                },
                { status: 400 },
            );
        }
        const lock = scope === "system" || (params.get("lock") !== "0" && !!passphrase);

        backup.manifest.encrypted = lock;

        const csv = params.get("format") === "csv";
        const payload: BackupPayload = csv ? "csv-zip" : "json";

        // CSV becomes a ZIP of spreadsheets; JSON stays the restore-capable bundle.
        const raw: Buffer | string = csv
            ? backupToCsvZip(backup)
            : JSON.stringify(backup, null, 2);

        const filename = backupFilename(backup.manifest, lock, csv);

        // Encryption works on text, so a ZIP is base64'd first. The envelope records
        // which it was (`payload`), so a restore knows what it is holding after
        // decrypting rather than having to guess from the bytes.
        const body = lock
            ? JSON.stringify(
                await encryptBackup(
                    Buffer.isBuffer(raw) ? raw.toString("base64") : raw,
                    normalizePassphrase(passphrase as string),
                    {
                        payload,
                        tenure: backup.manifest.tenure,
                        label: backup.manifest.label,
                        takenAt: backup.manifest.takenAt,
                        hint: custom?.trim()
                            ? "A custom passphrase was set when this backup was taken."
                            : `The name of the president of ${backup.manifest.tenure.label ?? "this tenure"}.`,
                    },
                ),
                null,
                2,
            )
            : raw;

        // Record the download. This is what the handover checks before letting a tenure
        // close — evidence a backup was actually taken, rather than a checkbox the VP
        // Admin ticks on their own say-so. It also means an export of every member's
        // contact details is never silent.
        const { error: auditError } = await db.from("admin_audit_log").insert({
            actor_profile_id: ctx.profile.id,
            actor_name: actorName || null,
            action: scope === "system" ? "backup.system" : "backup.download",
            field: filename,
            new_value: JSON.stringify({
                scope,
                tenure: backup.manifest.tenure,
                format: payload,
                encrypted: lock,
                counts: backup.manifest.counts,
                excluded: backup.manifest.excluded,
            }),
        });
        if (auditError) {
            // Not fatal — the operator still gets their file. But the handover gate reads
            // this table, so a silent failure here would block the handover with a
            // confusing "no backup" message. Make it loud in the logs.
            console.error(
                "The backup download could not be recorded (is migration 0010 applied?):",
                auditError.message,
            );
        }

        // A Node Buffer isn't a valid BodyInit; hand the Response its underlying bytes.
        const responseBody: BodyInit = Buffer.isBuffer(body)
            ? new Uint8Array(body)
            : body;

        return new NextResponse(responseBody, {
            headers: {
                "Content-Type": lock
                    ? "application/octet-stream"
                    : csv
                        ? "application/zip"
                        : "application/json; charset=utf-8",
                "Content-Disposition": `attachment; filename="${filename}"`,
                // A backup is a point-in-time snapshot; a cached copy is a stale one.
                "Cache-Control": "no-store, must-revalidate",
            },
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : "Backup failed.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export const dynamic = "force-dynamic";
