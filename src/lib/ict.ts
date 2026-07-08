import { RcfIctClient } from '@rcffuta/ict-lib/server'

/**
 * Server-only ICT clients.
 *
 * SECURITY / RLS: every table now has RLS enabled + FORCED with a default-deny
 * policy (migration 0001). The anon key therefore can't read/write the app's
 * tables at all. Because ALL of our DB access happens inside trusted server
 * actions (which enforce their own authorization via src/lib/access-control.ts),
 * both clients below use the service-role key, which bypasses RLS.
 *
 * `ict` and `ictAdmin` are kept as separate names only for call-site clarity and
 * backwards compatibility — they are equivalent. NEVER import either into a
 * client component; the service-role key must never reach the browser.
 */
export const ictAdmin = RcfIctClient.asAdmin();
export const ict = ictAdmin;
