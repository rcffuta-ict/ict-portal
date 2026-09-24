/**
 * Find a member by email. Server-only: reads the service-role client.
 */
import { db } from "@/lib/db";
import { parseEmailList } from "@/lib/email-list";

/**
 * The profile with exactly this email address, ignoring case, or null.
 *
 * ILIKE so an address stored with capitals is still found; then an exact lower-case
 * re-check, because `_` is a single-character wildcard in ILIKE (`%` is refused by
 * parseEmailList). Only one well-formed address is accepted, so this can't be widened
 * into a search.
 */
export async function findProfileByEmail<T extends { email: string | null }>(
    email: string,
    columns: string,
): Promise<T | null> {
    const [clean] = parseEmailList(email).emails;
    if (!clean) return null;
    const { data } = await db.from("profiles").select(columns).ilike("email", clean).limit(5);
    return ((data ?? []) as unknown as T[]).find((p) => p.email?.toLowerCase() === clean) ?? null;
}
