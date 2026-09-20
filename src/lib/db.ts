import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The server-side database client.
 *
 * SECURITY — READ BEFORE USING
 *   This is the SERVICE ROLE client. It BYPASSES ROW LEVEL SECURITY entirely.
 *
 *   That is deliberate and it is the whole architecture: every table has RLS enabled
 *   and FORCED with no policies (migration 0001), so the anon key can read nothing at
 *   all. All database access happens inside server actions and route handlers that
 *   enforce their own authorization first, via src/lib/access-control.ts.
 *
 *   Consequences, both non-negotiable:
 *     1. NEVER import this into a client component. The service-role key must never
 *        reach the browser — it would grant a visitor the whole database.
 *     2. A query here is UNGUARDED. Authorization is the caller's job, every time.
 *        There is no second line of defence behind this.
 *
 *   `src/proxy.ts` only checks whether a token is present. It is a UX convenience and
 *   never an authorization boundary.
 *
 * Replaced `RcfIctClient.asAdmin()` from @rcffuta/ict-lib, which wrapped exactly this
 * with a `.supabase` property and a handful of helper methods.
 */
/**
 * Read the first of these env vars that is set.
 *
 * The URL is accepted under either name because the codebase used both before this
 * client existed: server code read `SUPABASE_URL`, while a few call sites reached for
 * `NEXT_PUBLIC_SUPABASE_URL`. A deployed environment may have configured only one, and
 * a name mismatch here takes the whole portal down at boot. The KEY is deliberately NOT
 * given a NEXT_PUBLIC_ fallback — a service-role key under that prefix would be shipped
 * to the browser.
 */
function requireEnv(...names: string[]): string {
    const name = names[0];
    const value = names.map((n) => process.env[n]).find(Boolean);
    if (!value) {
        // Failing loudly at import beats a hundred confusing "Invalid API key" errors
        // at call sites that have no idea the environment was never configured.
        throw new Error(
            `${name} is not set. The portal cannot reach the database without it — `
            + "see the Environment section of README.md.",
        );
    }
    return value;
}

export const db: SupabaseClient = createClient(
    requireEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
        auth: {
            // No browser, no user session: this client is the service role and nothing
            // else. Persisting or refreshing a session here would be meaningless.
            autoRefreshToken: false,
            persistSession: false,
        },
    },
);
