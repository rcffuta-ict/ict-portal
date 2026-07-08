/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { ictAdmin } from "@/lib/ict";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { recordLoginEvent } from "@/lib/auth/audit";
import { getRequestMeta } from "@/lib/auth/request";
import { getLoginContext } from "@/lib/auth/profile-context";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

/**
 * Leader-only login against `profile_login` (Supabase Auth is retired).
 *
 * A single `rcf_login_context` RPC returns the auth gate (password hash + login
 * state) AND the enriched profile in one round-trip. Node verifies the scrypt
 * password, then creates a DB-backed session (the DB trigger records the
 * 'login_success' audit event). Only members a VP Admin has provisioned a login
 * for — and marked active — can pass.
 */
export async function loginAction(formData: FormData) {
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const meta = await getRequestMeta();

    // Generic message so we don't reveal whether an email exists / is a leader.
    const INVALID = "Invalid credentials, or you don't have portal access.";

    try {
        if (!email || !password) {
            return { success: false, error: "Email and password are required." };
        }

        // 1. One call: login gate + full profile context.
        const login = await getLoginContext(email);

        if (!login || !login.isActive) {
            await recordLoginEvent("login_fail", { email, ip: meta.ip, userAgent: meta.userAgent });
            return { success: false, error: INVALID };
        }

        // 2. Lockout check.
        if (login.lockedUntil && new Date(login.lockedUntil).getTime() > Date.now()) {
            return { success: false, error: "Account temporarily locked. Try again later." };
        }

        // 3. Verify password (scrypt, constant-time).
        const ok = await verifyPassword(password, login.passwordHash);
        if (!ok) {
            const attempts = (login.failedAttempts || 0) + 1;
            const lockedUntil =
                attempts >= MAX_FAILED_ATTEMPTS
                    ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
                    : null;
            await ictAdmin.supabase
                .from("profile_login")
                .update({ failed_attempts: attempts, locked_until: lockedUntil, updated_at: new Date().toISOString() })
                .eq("id", login.loginId);
            await recordLoginEvent("login_fail", {
                profileId: login.profileId, email, ip: meta.ip, userAgent: meta.userAgent,
            });
            return { success: false, error: INVALID };
        }

        // 4. Success — create the session (trigger logs 'login_success') + reset counters.
        await createSession(login.profileId, meta);
        await ictAdmin.supabase
            .from("profile_login")
            .update({
                failed_attempts: 0,
                locked_until: null,
                last_login_at: new Date().toISOString(),
                last_login_ip: meta.ip ?? null,
                updated_at: new Date().toISOString(),
            })
            .eq("id", login.loginId);

        // 5. The profile context is already resolved — no extra DB call.
        return { success: true, data: login.context };
    } catch (error: any) {
        console.error("Login Error:", error);
        return { success: false, error: "Login failed. Please try again." };
    }
}
