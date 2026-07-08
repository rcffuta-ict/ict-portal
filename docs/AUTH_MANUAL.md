# Authentication & Session Management Guide

This document outlines the authentication architecture used in this project, combining **@rcffuta/ict-lib**, **Supabase**, and **Next.js App Router**. Use this as a reference for replicating this logic in other projects.

---

## 1. High-Level Architecture

- **Provider**: Supabase Auth (via `@rcffuta/ict-lib`).
- **Persistence**: Hybrid approach.
    - **Server-side**: HTTP-only Cookies (`sb-access-token`, `sb-refresh-token`).
    - **Client-side**: Zustand with `persist` middleware (localStorage).
- **Protection**: Next.js Middleware (via a `proxy.ts` helper) that intercepts requests based on the presence of the access token cookie.

---

## 2. Server-Side Session Management

### Login & Cookie Setting

Sessions are initialized in a Server Action. Since the underlying library use vanilla Supabase JS, we manually bridge the session to Next.js cookies to ensure server-side persistence and middleware accessibility.

**File**: `src/app/(auth)/login/actions.ts`

```typescript
"use server";

import { RcfIctClient } from "@rcffuta/ict-lib/server";
import { cookies } from "next/headers";

export async function loginAction(formData: FormData) {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const rcf = RcfIctClient.fromEnv();

    try {
        const { user, session } = await rcf.auth.login(email, password);
        if (!user || !session)
            return { success: false, error: "Invalid credentials" };

        const cookieStore = await cookies();
        const isProduction = process.env.NODE_ENV === "production";

        const cookieOptions = {
            path: "/",
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax" as const,
            maxAge: 60 * 60 * 24 * 7, // 1 week
        };

        // Bridge to Next.js cookies
        cookieStore.set("sb-access-token", session.access_token, cookieOptions);
        if (session.refresh_token) {
            cookieStore.set(
                "sb-refresh-token",
                session.refresh_token,
                cookieOptions,
            );
        }

        // Fetch user metadata (Roles, Academics, etc.)
        const fullProfile = await rcf.member.getFullProfile(user.id);
        return { success: true, data: fullProfile };
    } catch (error) {
        return { success: false, error: "Login failed" };
    }
}
```

### Route Protection (Middleware)

We use a middleware pattern to protect routes. The middleware checks for the `sb-access-token` cookie.

**File**: `src/proxy.ts`

```typescript
export async function proxy(request: NextRequest) {
    const token = request.cookies.get("sb-access-token")?.value;
    const { pathname } = request.nextUrl;

    const isAuthPage =
        pathname.startsWith("/login") || pathname.startsWith("/register");
    const isDashboardPage = pathname.startsWith("/dashboard");

    if (!token && isDashboardPage) {
        const loginUrl = new URL("/login", request.url);
        return NextResponse.redirect(loginUrl);
    }

    // Allow authenticated users to bypass login pages
    if (token && isAuthPage) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
}
```

---

## 3. Client-Side Session Management

### State Store (Zustand)

We use Zustand to manage the globally accessible user profile. The `persist` middleware ensures that the user data survives page refreshes even before the server completes hydration.

**File**: `src/lib/stores/profile.store.ts`

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useProfileStore = create()(
    persist(
        (set) => ({
            user: null, // FullUserProfile
            isLoading: true,

            setUser: (user) => set({ user, isLoading: false }),
            logout: async () => {
                set({ user: null });
                // Trigger server action to clear cookies
                await logoutAction();
            },
        }),
        { name: "rcf-ict-profile-storage" }, // LocalStorage key
    ),
);
```

---

## 4. Replication Steps for New Projects

1. **Install Dependencies**:

    ```bash
    npm install @rcffuta/ict-lib zustand
    ```

2. **Configure Environment**:
   Ensure `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set.

3. **Core Library Hookup**:
   Create a server action that logs the user in and sets `sb-access-token` as an `httpOnly` cookie.

4. **Middleware Logic**:
   In `middleware.ts`, read the cookie and use `NextResponse.redirect` for protected paths.

5. **Local State Persistence**:
   Set up a Zustand store with the `persist` middleware to mirror the server session for immediate UI availability.

---

## 🛡️ Security Summary

1.  **XSS Protection**: Tokens are stored in `httpOnly` cookies, inaccessible to client-side scripts.
2.  **CSRF Mitigation**: Cookies use `SameSite: Lax` by default.
3.  **Hydration Sychronization**: Client-side Zustand store is updated immediately after a successful Server Action response during login.
