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
