/**
 * Password hashing for leader logins (`profile_login.password_hash`).
 *
 * Uses Node's built-in `crypto.scrypt` — no external dependency. A process-wide
 * pepper (`SESSION_SECRET`) is mixed in so that a leaked DB alone is not enough
 * to mount an offline attack. Stored format:
 *
 *     scrypt$<saltHex>$<hashHex>
 *
 * Server-only. Never import from a client component.
 */
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(_scrypt) as (
    password: string | Buffer,
    salt: string | Buffer,
    keylen: number,
) => Promise<Buffer>;

const KEYLEN = 64;

function pepper(password: string): string {
    // SESSION_SECRET is required in production; fall back to raw password in dev
    // so local setup without the secret still works (a warning is logged once).
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("SESSION_SECRET is required to hash passwords in production.");
        }
        return password;
    }
    return `${password}${secret}`;
}

/**
 * Hash a plaintext password for storage.
 */
export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derived = await scrypt(pepper(password), salt, KEYLEN);
    return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/**
 * Verify a plaintext password against a stored hash. Constant-time comparison.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
    const parts = stored.split("$");
    if (parts.length !== 3 || parts[0] !== "scrypt") return false;

    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    const derived = await scrypt(pepper(password), salt, expected.length || KEYLEN);

    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
}
