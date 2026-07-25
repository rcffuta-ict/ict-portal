/**
 * Bootstrap the first VP Admin login.
 *
 * Run AFTER applying db/migrations/0001 + 0002. Creates (or reuses) a profile,
 * assigns the protected "Vice President Administration" position in the active
 * tenure, and sets a login password — using the exact scrypt format as
 * src/lib/auth/password.ts, so the seeded admin can log in immediately.
 *
 * Usage:
 *   node scripts/bootstrap-admin.mjs <email> <password> [firstName] [lastName]
 *
 * Reads SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SESSION_SECRET from .env.local.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes, scrypt as _scrypt } from "node:crypto";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";

const scrypt = promisify(_scrypt);
const KEYLEN = 64;

// --- minimal .env.local loader (no dependency) ---
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

async function hashPassword(password) {
    const secret = process.env.SESSION_SECRET;
    if (!secret) throw new Error("SESSION_SECRET is required (must match the app).");
    const salt = randomBytes(16);
    const derived = await scrypt(`${password}${secret}`, salt, KEYLEN);
    return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

async function main() {
    loadEnv();
    const [email, password, firstName = "VP", lastName = "Admin"] = process.argv.slice(2);
    if (!email || !password) {
        console.error("Usage: node scripts/bootstrap-admin.mjs <email> <password> [firstName] [lastName]");
        process.exit(1);
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    const db = createClient(url, key);

    // 1. Profile
    let { data: profile } = await db.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
    if (!profile) {
        const { data, error } = await db
            .from("profiles")
            .insert({ first_name: firstName, last_name: lastName, email: email.toLowerCase() })
            .select("id")
            .single();
        if (error) throw error;
        profile = data;
        console.log(`Created profile ${profile.id}`);
    } else {
        console.log(`Using existing profile ${profile.id}`);
    }

    // 2. Active tenure + VP Admin position
    const { data: tenure } = await db.from("tenures").select("id").eq("is_active", true).maybeSingle();
    if (!tenure) throw new Error("No active tenure. Create/activate one first.");
    const { data: position } = await db
        .from("leadership_positions")
        .select("id")
        .eq("title", "Vice President Administration")
        .maybeSingle();
    if (!position) throw new Error("VP Admin position missing — did migration 0001 run?");

    // 3. Leadership assignment (idempotent)
    const { data: existingRole } = await db
        .from("leadership")
        .select("id")
        .eq("tenure_id", tenure.id)
        .eq("profile_id", profile.id)
        .eq("position_id", position.id)
        .maybeSingle();
    if (!existingRole) {
        const { error } = await db
            .from("leadership")
            .insert({ tenure_id: tenure.id, profile_id: profile.id, position_id: position.id });
        if (error) throw error;
        console.log("Assigned VP Admin position.");
    }

    // 4. Login
    const password_hash = await hashPassword(password);
    const { data: login } = await db.from("profile_login").select("id").eq("profile_id", profile.id).maybeSingle();
    if (login) {
        await db.from("profile_login").update({ password_hash, is_active: true, failed_attempts: 0, locked_until: null }).eq("id", login.id);
    } else {
        await db.from("profile_login").insert({ profile_id: profile.id, password_hash, is_active: true, granted_by: profile.id });
    }

    console.log(`\n✅ VP Admin ready. Log in with ${email}`);
}

main().catch((e) => {
    console.error("Bootstrap failed:", e.message);
    process.exit(1);
});
