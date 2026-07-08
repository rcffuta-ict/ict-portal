/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { ictAdmin } from "@/lib/ict";
import { verifyPassword } from "@/lib/auth/password";
import { setLoginPassword } from "@/lib/auth/provision";
import { createSession } from "@/lib/auth/session";
import { recordLoginEvent } from "@/lib/auth/audit";
import { getRequestMeta } from "@/lib/auth/request";
import { getLoginContext } from "@/lib/auth/profile-context";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const INVALID = "Invalid credentials, or you don't have portal access.";

/**
 * Step 1: check whether an email belongs to an active leader, and whether they
 * have set a password yet. Drives the two-step login UI:
 *   - not a leader        -> generic "no access"
 *   - leader, no password  -> first-login "set password" step
 *   - leader, has password -> normal "enter password" step
 */
export async function checkLeaderAction(email: string) {
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized) return { ok: false as const, error: "Email is required." };

    const login = await getLoginContext(normalized);
    if (!login || !login.isActive) {
        return { ok: false as const, error: INVALID };
    }
    return {
        ok: true as const,
        passwordSet: login.passwordHash != null,
        firstName: login.context?.profile.firstName ?? null,
    };
}

async function finishLogin(profileId: string, email: string, meta: { ip?: string | null; userAgent?: string | null }) {
    // Session insert fires the DB trigger that records 'login_success'.
    await createSession(profileId, meta);
    await ictAdmin.supabase
        .from("profile_login")
        .update({
            failed_attempts: 0,
            locked_until: null,
            last_login_at: new Date().toISOString(),
            last_login_ip: meta.ip ?? null,
            updated_at: new Date().toISOString(),
        })
        .eq("profile_id", profileId);
    void email;
}

/**
 * Step 2a: returning leader — verify the password and start a session.
 */
export async function loginAction(formData: FormData) {
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const meta = await getRequestMeta();

    try {
        if (!email || !password) return { success: false, error: "Email and password are required." };

        const login = await getLoginContext(email);
        if (!login || !login.isActive || login.passwordHash == null) {
            await recordLoginEvent("login_fail", { email, ip: meta.ip, userAgent: meta.userAgent });
            return { success: false, error: INVALID };
        }

        if (login.lockedUntil && new Date(login.lockedUntil).getTime() > Date.now()) {
            return { success: false, error: "Account temporarily locked. Try again later." };
        }

        const ok = await verifyPassword(password, login.passwordHash);
        if (!ok) {
            const attempts = (login.failedAttempts || 0) + 1;
            const lockedUntil = attempts >= MAX_FAILED_ATTEMPTS
                ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
                : null;
            await ictAdmin.supabase
                .from("profile_login")
                .update({ failed_attempts: attempts, locked_until: lockedUntil, updated_at: new Date().toISOString() })
                .eq("id", login.loginId);
            await recordLoginEvent("login_fail", { profileId: login.profileId, email, ip: meta.ip, userAgent: meta.userAgent });
            return { success: false, error: INVALID };
        }

        await finishLogin(login.profileId, email, meta);
        return { success: true, data: login.context };
    } catch (error: any) {
        console.error("Login Error:", error);
        return { success: false, error: "Login failed. Please try again." };
    }
}

/**
 * Step 2b: first login — the leader sets their password, then we start a session.
 * Only valid when no password has been set yet (guards against overwriting one).
 */
export async function setInitialPasswordAction(email: string, password: string) {
    const normalized = String(email || "").trim().toLowerCase();
    const meta = await getRequestMeta();

    try {
        if (password.length < 8) return { success: false, error: "Password must be at least 8 characters." };

        const login = await getLoginContext(normalized);
        if (!login || !login.isActive) return { success: false, error: INVALID };
        if (login.passwordHash != null) {
            return { success: false, error: "A password is already set. Please log in with it." };
        }

        await setLoginPassword(login.profileId, password);
        await finishLogin(login.profileId, normalized, meta);
        return { success: true, data: login.context };
    } catch (error: any) {
        console.error("Set-password Error:", error);
        return { success: false, error: "Could not set password. Please try again." };
    }
}
