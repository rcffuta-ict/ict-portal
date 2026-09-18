/**
 * Restore a fellowship backup bundle into Supabase.
 *
 * The companion to src/lib/backup.ts and the /dashboard/tenure/backup download. Use it
 * to rebuild a wiped or fresh project from a bundle taken before a handover.
 *
 * Usage:
 *   node scripts/restore-backup.mjs <file>                       # dry run (default)
 *   node scripts/restore-backup.mjs <file> --commit              # actually write
 *   node scripts/restore-backup.mjs <file> --password "Ada Obi"  # unlock a .rcfvault
 *   node scripts/restore-backup.mjs <file> --commit --only profiles,leadership
 *
 * DRY RUN IS THE DEFAULT, deliberately. This writes to every core table, and a restore
 * aimed at the wrong project is not something you can take back — so you have to ask
 * for the write explicitly.
 *
 * WHAT IT WON'T RESTORE
 *   Credentials were never in the bundle (see src/lib/backup.ts):
 *     * profile_login.password_hash is null  → every leader sets a new password on
 *       first login, which is the flow the portal already uses for new appointments.
 *     * registration_invites.token is null   → rotate level tokens after restoring.
 *     * auth_sessions was not exported       → everyone signs in again.
 *
 * Rows are upserted by primary key, so re-running is safe and a partial restore can be
 * resumed. Tables are written in the order the bundle lists them, which is FK-safe
 * (parents before children).
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local, like
 * scripts/bootstrap-admin.mjs.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { scrypt as _scrypt, createDecipheriv } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(_scrypt);

const CHUNK = 500;
/** Bundles older/newer than this are refused rather than half-applied. */
const SUPPORTED_FORMAT = 2;
const SUPPORTED_ENVELOPE = 1;

/**
 * Decrypt a .rcfvault envelope. Mirrors src/lib/backup-crypto.ts exactly — same
 * AES-256-GCM, same scrypt derivation, same passphrase normalisation, so a file
 * produced by the portal opens here and nowhere else without the passphrase.
 */
async function decryptEnvelope(envelope, passphrase) {
    const meta = envelope.rcfBackup;
    if (meta.envelopeVersion !== SUPPORTED_ENVELOPE) {
        throw new Error(`Envelope v${meta.envelopeVersion}; this script understands v${SUPPORTED_ENVELOPE}.`);
    }

    const normalized = String(passphrase).trim().replace(/\s+/g, " ").toLowerCase();
    const key = await scrypt(normalized, Buffer.from(meta.salt, "base64"), 32);
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(meta.iv, "base64"));
    decipher.setAuthTag(Buffer.from(meta.authTag, "base64"));

    try {
        return Buffer.concat([
            decipher.update(Buffer.from(envelope.ciphertext, "base64")),
            decipher.final(),
        ]).toString("utf8");
    } catch {
        throw new Error("Wrong passphrase, or the file has been altered.");
    }
}

// --- minimal .env.local loader (no dependency), mirroring bootstrap-admin.mjs ---
function loadEnv() {
    try {
        const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
        for (const line of raw.split("\n")) {
            const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
            if (!m) continue;
            let val = m[2].trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            if (!(m[1] in process.env)) process.env[m[1]] = val;
        }
    } catch {
        /* fall back to real env */
    }
}

function chunk(rows, size) {
    const out = [];
    for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
    return out;
}

async function main() {
    loadEnv();

    const args = process.argv.slice(2);
    const file = args.find((a) => !a.startsWith("--"));
    const commit = args.includes("--commit");
    const onlyArg = args.find((a) => a.startsWith("--only="))
        ?? (args.includes("--only") ? args[args.indexOf("--only") + 1] : null);
    const only = onlyArg
        ? new Set(onlyArg.replace("--only=", "").split(",").map((t) => t.trim()).filter(Boolean))
        : null;

    if (!file) {
        console.error("Usage: node scripts/restore-backup.mjs <file.json> [--commit] [--only table,table]");
        process.exit(1);
    }

    const passwordArg = args.find((a) => a.startsWith("--password="))
        ?? (args.includes("--password") ? args[args.indexOf("--password") + 1] : null);
    const password = passwordArg ? passwordArg.replace("--password=", "") : null;

    let parsed = JSON.parse(readFileSync(file, "utf8"));

    // Locked bundles announce themselves in cleartext, so we can tell the operator
    // exactly whose name to try instead of failing with "invalid JSON".
    if (parsed?.rcfBackup?.encrypted) {
        const meta = parsed.rcfBackup;
        console.log(`\nLocked backup: ${meta.label} (${meta.tenure?.name ?? "?"})`);
        console.log(`Hint: ${meta.hint}`);
        if (!password) {
            console.error("\nThis backup is encrypted. Pass --password \"<passphrase>\".");
            process.exit(1);
        }
        if (meta.payload === "csv-zip") {
            throw new Error(
                "That's a CSV archive, not a restorable bundle. Take a JSON backup to restore from.",
            );
        }
        parsed = JSON.parse(await decryptEnvelope(parsed, password));
        console.log("Unlocked.\n");
    }

    const bundle = parsed;
    const { manifest, tables } = bundle;

    if (!manifest || !tables) {
        throw new Error("That file doesn't look like a backup bundle (no manifest/tables).");
    }
    if (manifest.formatVersion !== SUPPORTED_FORMAT) {
        throw new Error(
            `Bundle format v${manifest.formatVersion}, but this script understands v${SUPPORTED_FORMAT}.`,
        );
    }
    if (manifest.excluded?.length) {
        console.log(`\nNot in this bundle (excluded when it was taken):`);
        for (const t of manifest.excluded) console.log(`  - ${t}`);
    }

    console.log(`\nBackup: ${manifest.label}`);
    console.log(`Tenure: ${manifest.tenure?.name ?? "—"} (${manifest.tenure?.session ?? "—"})`);
    console.log(`Taken:  ${manifest.takenAt}${manifest.takenBy ? ` by ${manifest.takenBy.name}` : ""}`);
    if (manifest.skipped?.length) {
        console.log(`\n⚠  ${manifest.skipped.length} table(s) were skipped when this backup was taken:`);
        for (const s of manifest.skipped) console.log(`     ${s.table}: ${s.reason}`);
    }
    console.log(`\nRedactions (these do NOT come back):`);
    for (const r of manifest.redactions ?? []) console.log(`  - ${r}`);

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

    console.log(`\nTarget: ${url}`);
    console.log(commit ? "Mode:   COMMIT — rows will be written.\n" : "Mode:   DRY RUN — nothing will be written. Pass --commit to apply.\n");

    const db = createClient(url, key);
    let totalRows = 0;
    let failures = 0;

    for (const [table, rows] of Object.entries(tables)) {
        if (only && !only.has(table)) continue;
        if (!Array.isArray(rows) || rows.length === 0) {
            console.log(`  ${table.padEnd(26)} — empty, skipped`);
            continue;
        }

        if (!commit) {
            console.log(`  ${table.padEnd(26)} ${String(rows.length).padStart(6)} rows would be upserted`);
            totalRows += rows.length;
            continue;
        }

        let written = 0;
        for (const part of chunk(rows, CHUNK)) {
            const { error } = await db.from(table).upsert(part, { onConflict: "id" });
            if (error) {
                console.error(`  ${table.padEnd(26)} FAILED: ${error.message}`);
                failures += 1;
                break;
            }
            written += part.length;
        }
        if (written) {
            console.log(`  ${table.padEnd(26)} ${String(written).padStart(6)} rows upserted`);
            totalRows += written;
        }
    }

    console.log(`\n${commit ? "Restored" : "Would restore"} ${totalRows} rows across the bundle.`);
    if (failures) {
        console.error(`${failures} table(s) failed — fix the cause and re-run; upserts are idempotent.`);
        process.exit(1);
    }
    if (commit) {
        console.log("\nNext steps:");
        console.log("  1. Leaders set passwords on first login (no hashes were restored).");
        console.log("  2. Rotate level tokens — the originals were redacted.");
        console.log("  3. Re-run the catalogue sync from the Tenure module's Hierarchy tab.");
    }
}

main().catch((e) => {
    console.error(`\nRestore failed: ${e.message}`);
    process.exit(1);
});
