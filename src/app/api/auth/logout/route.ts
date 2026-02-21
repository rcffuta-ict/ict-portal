import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { RcfIctClient } from "@rcffuta/ict-lib/server";

// POST /api/auth/logout — called by the client logout button
export async function POST() {
    return clearAndRedirect();
}

// GET /api/auth/logout — used by server components to clear bad/expired sessions
export async function GET() {
    return clearAndRedirect();
}

async function clearAndRedirect() {
    try {
        const rcf = RcfIctClient.fromEnv();
        await rcf.auth.logout();
    } catch (_) {}

    const cookieStore = await cookies();
    const opts = { path: "/", maxAge: 0 };
    cookieStore.set("sb-access-token", "", opts);
    cookieStore.set("sb-refresh-token", "", opts);

    return NextResponse.redirect(
        new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")
    );
}
