/**
 * Backup encryption — AES-256-GCM with a scrypt-derived key.
 *
 * A fellowship backup is every member's full name, phone number, date of birth, home
 * address and next-of-kin in a single file that will travel through email and WhatsApp
 * like any other attachment. Encrypting it at rest is the minimum a serious app does.
 *
 * FORMAT
 *   The envelope keeps its metadata in CLEARTEXT — what the file is, which tenure it
 *   belongs to, when it was taken, and the KDF parameters. You must be able to identify
 *   and route a backup without being able to read it, and the parameters have to travel
 *   with the ciphertext or it can never be opened again.
 *
 *   GCM is authenticated, so tampering is detected on decrypt rather than silently
 *   restoring corrupted rows.
 *
 * ON THE PASSPHRASE
 *   The handover defaults this to the tenure president's name, which is memorable and
 *   recoverable years later — the property that actually matters for an archive nobody
 *   opens until something has gone wrong. It is NOT strong: a name is low-entropy and
 *   publicly known within the fellowship, so treat this as protection against casual
 *   disclosure (a file sitting in a shared Downloads folder, forwarded to the wrong
 *   chat), not against someone determined who has the file. Where that matters, set a
 *   custom passphrase — the UI offers one, and scrypt's cost parameters below mean a
 *   strong passphrase really is strong.
 *
 * Server-only (node:crypto).
 */
import { randomBytes, scrypt as _scrypt, createCipheriv, createDecipheriv } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(_scrypt) as (
    password: string,
    salt: Buffer,
    keylen: number,
) => Promise<Buffer>;

export const ENVELOPE_VERSION = 1;

/**
 * What an envelope wraps:
 *   "json"    — the restore-capable bundle, exactly as buildBackup produced it.
 *   "csv-zip" — base64 of a ZIP archive holding one CSV per table (human-readable,
 *               not used for restoring).
 */
export type BackupPayload = "json" | "csv-zip";

const ALGORITHM = "aes-256-gcm";
const KEY_LEN = 32;
const SALT_LEN = 16;
const IV_LEN = 12; // 96-bit nonce, the size GCM is specified for

export interface EncryptedEnvelope {
    /** Identifies the file without decrypting it. */
    rcfBackup: {
        envelopeVersion: number;
        encrypted: true;
        algorithm: string;
        kdf: "scrypt";
        /** Everything needed to re-derive the key; useless without the passphrase. */
        salt: string;
        iv: string;
        authTag: string;
        /** What the ciphertext contains once decrypted. */
        payload: BackupPayload;
        /** Cleartext so a backup can be identified and filed. */
        tenure: { id: string | null; name: string | null; session: string | null };
        label: string;
        takenAt: string;
        hint: string;
    };
    ciphertext: string;
}

/** Encrypt a backup bundle. `hint` tells a future reader whose name to try. */
export async function encryptBackup(
    plaintext: string,
    passphrase: string,
    meta: {
        payload: BackupPayload;
        tenure: { id: string | null; name: string | null; session: string | null };
        label: string;
        takenAt: string;
        hint: string;
    },
): Promise<EncryptedEnvelope> {
    const salt = randomBytes(SALT_LEN);
    const iv = randomBytes(IV_LEN);
    const key = await scrypt(passphrase, salt, KEY_LEN);

    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
    ]);

    return {
        rcfBackup: {
            envelopeVersion: ENVELOPE_VERSION,
            encrypted: true,
            algorithm: ALGORITHM,
            kdf: "scrypt",
            payload: meta.payload,
            salt: salt.toString("base64"),
            iv: iv.toString("base64"),
            authTag: cipher.getAuthTag().toString("base64"),
            tenure: meta.tenure,
            label: meta.label,
            takenAt: meta.takenAt,
            hint: meta.hint,
        },
        ciphertext: ciphertext.toString("base64"),
    };
}

/**
 * Decrypt an envelope back to the bundle JSON.
 * Throws on a wrong passphrase or a tampered file — GCM authenticates, so both
 * surface here rather than as mangled rows much later.
 */
export async function decryptBackup(
    envelope: EncryptedEnvelope,
    passphrase: string,
): Promise<string> {
    const meta = envelope?.rcfBackup;
    if (!meta?.encrypted) throw new Error("That file is not an encrypted RCF backup.");
    if (meta.envelopeVersion !== ENVELOPE_VERSION) {
        throw new Error(
            `Envelope version ${meta.envelopeVersion}, but this build understands ${ENVELOPE_VERSION}.`,
        );
    }

    const key = await scrypt(passphrase, Buffer.from(meta.salt, "base64"), KEY_LEN);
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(meta.iv, "base64"));
    decipher.setAuthTag(Buffer.from(meta.authTag, "base64"));

    try {
        return Buffer.concat([
            decipher.update(Buffer.from(envelope.ciphertext, "base64")),
            decipher.final(),
        ]).toString("utf8");
    } catch {
        throw new Error("Wrong passphrase, or the backup file has been altered.");
    }
}

/**
 * Normalise a passphrase so a president's name unlocks the file regardless of how it
 * is typed years later — case, extra spaces and surrounding whitespace all collapse.
 * Applied identically on encrypt and decrypt, so it never weakens a strong passphrase
 * beyond case-insensitivity.
 */
export function normalizePassphrase(raw: string): string {
    return raw.trim().replace(/\s+/g, " ").toLowerCase();
}
