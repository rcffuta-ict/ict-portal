/**
 * Who may do what with an event. Server-only: reads the session.
 *
 *   CREATE / EDIT an event  — the System Admin only.
 *   OPEN its admin console  — the System Admin, both Vice Presidents (the CENTRAL tag),
 *                             the President, and the leadership of the unit the event is
 *                             assigned to (anyone holding EXCO:<that unit's slug>, lead or
 *                             assistant).
 *   ACT in the console      — the same people minus the President, who views only.
 *                             Today that means door check-in.
 *
 * One place, because the same question used to be answered by a client-side role
 * heuristic in three pages and a bare ADMIN check on the server — which let the
 * President check people in and could never have admitted a unit's own leaders.
 */
import { getCurrentContext } from "@/lib/access-control";
import type { ProfileContext } from "@/lib/auth/profile-context";
import { getEventUnitSlug } from "@/lib/event-utils";

export interface EventAccess {
    /** May open the admin console: registrants, stats, questions. */
    read: boolean;
    /** May act in it (check-in). Never the President. */
    write: boolean;
    /** May create and edit events (the System Admin). */
    manage: boolean;
}

export const NO_EVENT_ACCESS: EventAccess = { read: false, write: false, manage: false };

function holds(ctx: ProfileContext, tag: string, scope?: string): boolean {
    return (ctx.leadership ?? []).some((l) =>
        (l.privileges ?? []).some((p) => p.tag === tag && (scope === undefined || p.scope === scope)),
    );
}

/** Access for the current session to an event with this `config`. */
export async function eventAccessFor(
    config: Record<string, unknown> | null | undefined,
): Promise<EventAccess & { ctx: ProfileContext | null }> {
    const ctx = await getCurrentContext();
    if (!ctx) return { ...NO_EVENT_ACCESS, ctx: null };

    const unit = getEventUnitSlug(config);
    const read = ctx.isSysAdmin
        || ctx.isPresident
        || holds(ctx, "CENTRAL")
        || (!!unit && holds(ctx, "EXCO", unit));

    return {
        read,
        write: read && !ctx.isPresident,
        manage: ctx.isSysAdmin && !ctx.isPresident,
        ctx,
    };
}

/** Whether the session may create events (no event needed to answer it). */
export async function canManageEvents(): Promise<boolean> {
    const ctx = await getCurrentContext();
    return !!ctx?.isSysAdmin && !ctx.isPresident;
}
