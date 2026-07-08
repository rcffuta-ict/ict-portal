/**
 * Extract best-effort client metadata (IP, user-agent) from the incoming request
 * headers, for session + audit records. Server-only.
 */
import { headers } from "next/headers";
import type { SessionMeta } from "./session";

export async function getRequestMeta(): Promise<SessionMeta> {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : h.get("x-real-ip");
    return {
        ip: ip ?? null,
        userAgent: h.get("user-agent"),
    };
}
