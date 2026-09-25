/**
 * Deployment environment detection.
 *
 * Vercel injects `VERCEL_ENV` ("production" | "preview" | "development") into
 * every deployment, so we trust it when it exists and fall back to `NODE_ENV`
 * for local runs / non-Vercel hosts.
 *
 * Server-only values — do NOT import this into a client component expecting
 * `VERCEL_ENV` to be populated (it isn't inlined into the client bundle).
 */
export type DeploymentEnv = "production" | "preview" | "development";

export function getDeploymentEnv(): DeploymentEnv {
    const vercelEnv = process.env.VERCEL_ENV;

    if (
        vercelEnv === "production" ||
        vercelEnv === "preview" ||
        vercelEnv === "development"
    ) {
        return vercelEnv;
    }

    return process.env.NODE_ENV === "production" ? "production" : "development";
}

export function isProductionDeployment(): boolean {
    return getDeploymentEnv() === "production";
}

/**
 * True only on a Vercel preview deployment — not production, and not local
 * `pnpm dev` (where `VERCEL_ENV` is absent and this resolves to "development").
 */
export function isPreviewDeployment(): boolean {
    return getDeploymentEnv() === "preview";
}

/**
 * Short git reference for the current deployment, when Vercel exposes it.
 * Useful on a preview banner so a tester can say *which* build they hit.
 */
export function getDeploymentRef(): string | null {
    const branch = process.env.VERCEL_GIT_COMMIT_REF;
    const sha = process.env.VERCEL_GIT_COMMIT_SHA;

    if (branch) return branch;
    if (sha) return sha.slice(0, 7);

    return null;
}

// ---------------------------------------------------------------------------
// Test email addresses outside production
// ---------------------------------------------------------------------------

/**
 * Outside production every email saved must end in this domain. `.test` is reserved
 * (RFC 2606), so such an address can never reach anyone. The seed scripts already use
 * it. This stops a tester from typing a real member's address into staging, which would
 * create a second copy of a real person on a database that is reset and shared freely.
 */
export const TEST_EMAIL_DOMAIN = "rcffuta.test";

/** The project ref in a Supabase URL ("https://abcdef.supabase.co" → "abcdef"). */
function projectRef(url: string | undefined): string | null {
    const match = url?.match(/^https?:\/\/([^.]+)\./);
    return match ? match[1] : null;
}

/**
 * Whether this server is working on PRODUCTION DATA: a Vercel production deployment,
 * OR any run whose database is the production project (PRODUCTION_SUPABASE_URL), such
 * as `pnpm dev` pointed at production. Either signal is enough, so one missing or
 * mistyped variable can never lock real members out of production.
 */
export function isProductionData(): boolean {
    if (isProductionDeployment()) return true;
    const production = projectRef(process.env.PRODUCTION_SUPABASE_URL);
    const current = projectRef(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
    return !!production && production === current;
}

/**
 * The domain every email must use here, or null in production. Sent to the forms so
 * they can say so next to the field; the server actions enforce it regardless.
 */
export function requiredTestEmailDomain(): string | null {
    return isProductionData() ? null : TEST_EMAIL_DOMAIN;
}

/** The error for an email this environment refuses, or null when it's allowed. */
export function testEmailError(email: string | null | undefined): string | null {
    const domain = requiredTestEmailDomain();
    if (!domain || !email) return null;
    return email.trim().toLowerCase().endsWith(`@${domain}`)
        ? null
        : `This is a test environment: use an @${domain} email address.`;
}
