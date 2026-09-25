/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * A handover takes effect an hour after the wizard is finished.
 *
 * The wizard's last step only SCHEDULES the switch (handoverTenureAction). This module
 * performs it once the hour is up. The delay gives the outgoing cabinet an hour to wrap
 * up, and gives the VP Admin or System Admin an hour to cancel.
 *
 * WHY THERE IS NO TIMER
 *   There is no job runner here: Vercel's free cron runs once a day, and the switch
 *   needs code that already lives in TypeScript. So a due handover is applied by the
 *   first request that asks about the state of things once the hour is up:
 *   getCurrentContext (every signed-in action), getActiveTenure, and sign-in itself.
 *   The scheduled screen also asks when its countdown ends. In practice the switch
 *   lands within a minute or so of the hour, as soon as anyone uses the portal.
 *
 * Deliberately NOT a "use server" file: an export here would be a public endpoint.
 * It imports the service-role client, so it must only ever be imported by server code.
 */

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { fetchAll } from "@/lib/fetch-all";
import { computeLevel, entryLevelName, sessionStartYear } from "@/lib/levels";
import { tenureFullLabel } from "@/lib/tenure";
import { ensureLoginProvisioned, deprovisionLoginIfUnappointed } from "@/lib/auth/provision";
import { logMembershipEvents, type MembershipActor } from "@/lib/fellowship";

/** How long a finished handover waits before it takes effect. */
export const HANDOVER_DELAY_MS = 60 * 60 * 1000;

/** What the switch does. Written by the server after it has checked every value. */
export interface HandoverPlan {
    session: string;
    startDate: string;
    vpAdminProfileId: string;
    ictCoordProfileId: string;
    carryMembership: boolean;
    revokeOutgoing: boolean;
}

/** Who a proceedings line is attributed to. `name` is a snapshot. */
export interface HandoverActor {
    id: string | null;
    name: string | null;
}

/** Append one line to an intent's proceedings log. Never fails the caller. */
export async function logHandoverEvent(
    intentId: string,
    actor: HandoverActor,
    action: string,
    detail?: string | null,
) {
    const { error } = await db.from("handover_events").insert({
        intent_id: intentId,
        action,
        detail: detail ?? null,
        actor_id: actor.id,
        actor_name: actor.name,
    });
    // A lost log line is bad; a handover that fails because logging failed is worse.
    if (error) console.error("handover_events insert failed:", error.message);
}

/**
 * How often one server instance looks for a due handover. The lookup is one indexed
 * query, but it would otherwise run on every request all year for something that
 * happens once.
 */
const CHECK_EVERY_MS = 30_000;
let lastCheckAt = 0;

/**
 * Apply the scheduled handover if its hour is up. Safe to call from anywhere on the
 * server, as often as you like: it never throws, and only one request can ever claim
 * the switch (see runScheduledHandover).
 *
 * @param force skip the per-instance throttle (the scheduled screen, when its countdown ends)
 */
export async function applyDueHandover({ force = false }: { force?: boolean } = {}): Promise<void> {
    const now = Date.now();
    if (!force && now - lastCheckAt < CHECK_EVERY_MS) return;
    lastCheckAt = now;

    try {
        const { data: due, error } = await db
            .from("handover_intents")
            .select("id")
            .eq("status", "scheduled")
            .lte("effective_at", new Date(now).toISOString())
            .order("effective_at")
            .limit(1)
            .maybeSingle();
        // Before the migration is applied the columns don't exist; that is "nothing due".
        if (error || !due) return;
        await runScheduledHandover(due.id);
    } catch (e: any) {
        console.error("applyDueHandover failed:", e?.message ?? e);
    }
}

/** A refusal found before anything was changed: the intent is marked failed, nothing else. */
class HandoverRefused extends Error {}

/**
 * Claim one due handover and perform it.
 *
 * The claim is a conditional update (scheduled → applying), so if two requests arrive
 * at the same moment only one of them gets the row back. A cancel that lands first
 * wins the same way: the claim then finds nothing to do.
 */
async function runScheduledHandover(intentId: string): Promise<void> {
    const { data: intent, error } = await db
        .from("handover_intents")
        .update({ status: "applying" })
        .eq("id", intentId)
        .eq("status", "scheduled")
        .lte("effective_at", new Date().toISOString())
        .select("id, from_tenure_id, plan, scheduled_by, scheduled_by_name")
        .maybeSingle();
    if (error || !intent) return;

    const actor: HandoverActor = { id: intent.scheduled_by, name: intent.scheduled_by_name };

    try {
        const outcome = await switchTenure(intent.from_tenure_id, intent.plan as HandoverPlan, actor);

        const { error: doneError } = await db
            .from("handover_intents")
            .update({
                status: "completed",
                to_tenure_id: outcome.tenureId,
                // The switch is done in the name of whoever finished the wizard.
                completed_by: actor.id,
                completed_by_name: actor.name,
                completed_at: new Date().toISOString(),
                step: 6,
            })
            .eq("id", intentId);
        if (doneError) console.error("handover intent completion failed:", doneError.message);

        const { carried, revoked, warnings } = outcome;
        await logHandoverEvent(
            intentId,
            actor,
            "completed",
            `Took effect. Opened ${tenureFullLabel({ session: (intent.plan as HandoverPlan).session })}. `
                + `${carried} membership${carried === 1 ? "" : "s"} carried forward, `
                + `${revoked} outgoing login${revoked === 1 ? "" : "s"} revoked.`
                + (warnings.length ? ` WARNING: ${warnings.join(" ")}` : ""),
        );
    } catch (e: any) {
        const reason = e instanceof HandoverRefused
            ? e.message
            : `The switch stopped part-way (${e?.message ?? "unknown error"}). Check the Tenure page before doing anything else.`;
        console.error("scheduled handover failed:", reason);

        await db
            .from("handover_intents")
            .update({ status: "failed", failure_reason: reason })
            .eq("id", intentId);
        await logHandoverEvent(intentId, actor, "failed", reason);
    }

    // A new active tenure means a new (usually absent) palette on every dashboard page.
    // This may run while a page is rendering, where Next refuses a revalidation; the
    // layout's hourly revalidation then catches up.
    try {
        revalidatePath("/dashboard", "layout");
    } catch {
        // see above
    }
}

/**
 * The switch itself: close the outgoing tenure, open the incoming one, appoint its
 * VP Admin and ICT Coordinator, carry membership forward, revoke outgoing logins, close
 * any open results round, and reset the two entry levels (see resetEntryLevels).
 *
 * Everything that can refuse is checked BEFORE the first write, so a refusal leaves the
 * fellowship exactly as it was. Once the new tenure exists, later problems are reported
 * as warnings instead: the switch has happened, and the record must say so.
 */
async function switchTenure(
    fromTenureId: string | null,
    plan: HandoverPlan,
    actor: HandoverActor,
): Promise<{ tenureId: string; carried: number; revoked: number; warnings: string[] }> {
    if (!plan?.session || !plan.startDate || !plan.vpAdminProfileId || !plan.ictCoordProfileId) {
        throw new HandoverRefused("The scheduled plan is incomplete. Nothing was changed.");
    }

    const { data: outgoing } = await db
        .from("tenures").select("id").eq("is_active", true).maybeSingle();
    // Someone switched tenures by another route during the hour. Opening a second new
    // tenure on top of that would be wrong whichever way round it happened.
    if (!outgoing || outgoing.id !== fromTenureId) {
        throw new HandoverRefused("The active tenure changed while this handover was waiting. Nothing was changed.");
    }

    const { data: positions } = await db
        .from("leadership_positions")
        .select("id, title")
        .in("title", ["Vice President Administration", "ICT Coordinator"]);
    const vpPos = positions?.find((p) => p.title === "Vice President Administration");
    const ictPos = positions?.find((p) => p.title === "ICT Coordinator");
    if (!vpPos || !ictPos) {
        throw new HandoverRefused("The VP Admin or ICT Coordinator office is missing. Run the catalogue sync, then hand over again. Nothing was changed.");
    }

    const { data: appointees } = await db
        .from("profiles")
        .select("id")
        .in("id", [plan.vpAdminProfileId, plan.ictCoordProfileId]);
    const found = new Set((appointees ?? []).map((p: any) => p.id));
    if (!found.has(plan.vpAdminProfileId) || !found.has(plan.ictCoordProfileId)) {
        throw new HandoverRefused("The incoming VP Admin or ICT Coordinator no longer exists. Nothing was changed.");
    }

    // Who held an office on the way out, captured before anything changes. Read at the
    // switch rather than at scheduling, so an appointment made during the hour counts.
    const { data: outgoingLeaders } = await db
        .from("leadership").select("profile_id")
        .eq("tenure_id", outgoing.id).is("ended_at", null);
    const outgoingIds = Array.from(new Set((outgoingLeaders ?? []).map((l: any) => l.profile_id)));

    // --- Past this point the switch is happening. -----------------------------------
    const warnings: string[] = [];

    const { error: closeError } = await db.from("tenures")
        .update({ is_active: false, end_date: new Date().toISOString() })
        .eq("id", outgoing.id);
    if (closeError) throw new HandoverRefused(`Could not close the outgoing tenure (${closeError.message}). Nothing was changed.`);

    const { data: newTenure, error: tErr } = await db.from("tenures")
        // Opened uncoronated: a handover starts a session, the retreat names it.
        .insert({
            session: plan.session,
            start_date: new Date(plan.startDate).toISOString(),
            is_active: true,
        })
        .select("id")
        .single();
    if (tErr || !newTenure) {
        // Put the outgoing tenure back, so the fellowship is never left without one.
        await db.from("tenures").update({ is_active: true, end_date: null }).eq("id", outgoing.id);
        throw new HandoverRefused(`Could not open the new tenure (${tErr?.message ?? "unknown error"}). The outgoing tenure was left active.`);
    }

    const { error: lErr } = await db.from("leadership").insert([
        { tenure_id: newTenure.id, profile_id: plan.vpAdminProfileId, position_id: vpPos.id, is_lead: true },
        { tenure_id: newTenure.id, profile_id: plan.ictCoordProfileId, position_id: ictPos.id, is_lead: true },
    ]);
    if (lErr) {
        warnings.push(`Appointing the VP Admin and ICT Coordinator failed (${lErr.message}); appoint them from the Tenure page.`);
    }

    for (const id of [plan.vpAdminProfileId, plan.ictCoordProfileId]) {
        try {
            await ensureLoginProvisioned(id, actor.id ?? id);
        } catch (e: any) {
            console.error("handover login provisioning failed:", e.message);
        }
    }

    let carried = 0;
    if (plan.carryMembership) {
        try {
            const result = await carryMembershipForward(
                outgoing.id, newTenure.id, plan.session, { id: actor.id, name: actor.name },
            );
            carried = result.inserted;
            if (result.failed > 0) {
                warnings.push(`${result.failed} membership${result.failed === 1 ? "" : "s"} could not be copied. Those members need adding to their units again.`);
            }
        } catch (e: any) {
            console.error("handover carry-over failed:", e.message);
            warnings.push(`Memberships were not carried forward (${e.message}). Units start empty until members are added again.`);
        }
    }

    // Runs against the NEW tenure, so anyone just appointed keeps their login.
    let revoked = 0;
    if (plan.revokeOutgoing) {
        for (const profileId of outgoingIds) {
            try {
                const { removed } = await deprovisionLoginIfUnappointed(profileId);
                if (removed) revoked += 1;
            } catch (e: any) {
                console.error(`handover: could not revoke ${profileId}:`, e.message);
            }
        }
    }

    // A results round belongs to the session it was opened in. Leaving it open would
    // let members keep submitting into last session's round under the new cabinet.
    const { error: roundsError } = await db
        .from("academic_rounds")
        .update({ closed_at: new Date().toISOString() })
        .is("closed_at", null);
    if (roundsError) {
        warnings.push(`The open results round could not be closed (${roundsError.message}); close it from Academics.`);
    }

    // After the carry-over, which reads each member's generation to leave PDS/UABS behind.
    try {
        warnings.push(...await resetEntryLevels(plan.session));
    } catch (e: any) {
        console.error("handover entry-level reset failed:", e.message);
        warnings.push(`PDS/UABS and 100 Level were not reset (${e.message}); check the Generations tab.`);
    }

    return { tenureId: newTenure.id, carried, revoked, warnings };
}

/**
 * A new session starts with PDS/UABS and 100 Level both EMPTY. Every other level fills
 * itself, because level is computed from the entry year and everyone moves up one.
 *
 *   PDS/UABS   last session's foundation members are unlinked from their generation
 *              (a decision of the fellowship: they neither stay PDS/UABS nor become
 *              100 Level). They re-join through a level link once admitted. The
 *              foundation generation itself is kept, empty, for the new intake, because
 *              past appointments and level links point at it.
 *   100 Level  a generation for the new session's entry year is created if there isn't
 *              one, so the level exists (with its own level link) from day one.
 *
 * Both are named here too (entryLevelName): PDS/UABS takes the new session's name
 * ("2028/2029"), and 100 Level is "2028 Set" unless it already has a name.
 *
 * One wrinkle: generations are unique by entry year, and the foundation generation is
 * keyed by the NEXT intake's year (session start + 1, see scripts/seed-staging.mjs). That
 * is exactly the year the new 100 Level needs, so the foundation generation is moved on
 * to the new session's start + 1 first.
 *
 * @returns warnings for anything that could not be done
 */
async function resetEntryLevels(incomingSession: string): Promise<string[]> {
    const warnings: string[] = [];
    const start = sessionStartYear(incomingSession);
    if (start == null) return [`"${incomingSession}" is not a session like 2027/2028, so PDS/UABS and 100 Level were not reset.`];

    const { data: sets, error } = await db
        .from("class_sets")
        .select("id, entry_year, is_foundation, family_name");
    if (error) throw new Error(error.message);
    const all = (sets ?? []) as { id: string; entry_year: number; is_foundation: boolean | null; family_name: string | null }[];
    const foundation = all.filter((s) => s.is_foundation);

    if (foundation.length) {
        const { error: nameError } = await db
            .from("class_sets")
            .update({ family_name: entryLevelName(true, incomingSession) })
            .in("id", foundation.map((s) => s.id));
        if (nameError) warnings.push(`PDS/UABS could not be renamed to ${incomingSession} (${nameError.message}).`);
    }

    if (foundation.length) {
        const { error: unlinkError } = await db
            .from("profiles")
            .update({ class_set_id: null })
            .in("class_set_id", foundation.map((s) => s.id));
        if (unlinkError) warnings.push(`Last session's PDS/UABS members could not be unlinked (${unlinkError.message}).`);
    }

    // Free the new 100 Level's year if a foundation generation holds it.
    const blocking = foundation.find((s) => s.entry_year === start);
    if (blocking) {
        const taken = all.some((s) => s.entry_year === start + 1);
        if (taken) {
            warnings.push(`The PDS/UABS generation holds ${start}, the new 100 Level's year, and ${start + 1} is taken too. Create 100 Level from the Generations tab.`);
            return warnings;
        }
        const { error: moveError } = await db
            .from("class_sets").update({ entry_year: start + 1 }).eq("id", blocking.id);
        if (moveError) {
            warnings.push(`The PDS/UABS generation could not be moved to ${start + 1} (${moveError.message}), so 100 Level was not created.`);
            return warnings;
        }
    }

    const firstYear = all.find((s) => s.entry_year === start && !s.is_foundation);
    if (firstYear && !firstYear.family_name?.trim()) {
        await db.from("class_sets").update({ family_name: entryLevelName(false, incomingSession) }).eq("id", firstYear.id);
    }
    if (!firstYear) {
        const { error: createError } = await db
            .from("class_sets")
            .insert({ entry_year: start, family_name: entryLevelName(false, incomingSession), is_foundation: false });
        if (createError) warnings.push(`100 Level (${start}) could not be created (${createError.message}); create it from the Generations tab.`);
    }
    return warnings;
}

/**
 * Copy unit/team membership into the new tenure, skipping anyone who has graduated.
 *
 * Without this every unit and team starts the session completely empty, and each
 * executive re-adds their whole roster by hand — membership rows are tenure-scoped, so
 * a new tenure genuinely has none. Members whose generation computes to "Alumni" under
 * the INCOMING session are left behind, which is how graduation actually takes effect
 * on the workforce. So are PDS/UABS members, who are not carried into a new session.
 */
async function carryMembershipForward(
    fromTenureId: string,
    toTenureId: string,
    incomingSession: string,
    actor: MembershipActor,
): Promise<{ inserted: number; failed: number }> {
    // Every read here must be complete and must not fail quietly: a short profile list
    // would carry graduates forward as if they were still students, and a short
    // membership list would leave people out of their units. So reads are paged
    // (fetchAll) and errors throw — the caller reports them rather than "0 carried".
    const { data: sets, error: setsError } = await db
        .from("class_sets")
        .select("id, entry_year, is_foundation, level_override");
    if (setsError) throw new Error(`Could not read generations: ${setsError.message}`);

    // Left behind: graduates, and PDS/UABS, which is not carried into a new session
    // (resetEntryLevels unlinks those members afterwards).
    const graduated = new Set(
        (sets ?? [])
            .filter((s: any) => {
                if (s.is_foundation) return true;
                const level = s.level_override
                    || computeLevel(s.entry_year, s.is_foundation, incomingSession);
                return level === "Alumni";
            })
            .map((s: any) => s.id),
    );

    const profiles = await fetchAll<{ id: string; class_set_id: string | null }>((from, to) =>
        db.from("profiles").select("id, class_set_id").order("id").range(from, to),
    );
    const alumniProfileIds = new Set(
        profiles
            .filter((p: any) => p.class_set_id && graduated.has(p.class_set_id))
            .map((p: any) => p.id),
    );

    const memberships = await fetchAll<{ profile_id: string; unit_id: string; role: string | null }>((from, to) =>
        db.from("membership_units")
            .select("profile_id, unit_id, role")
            .eq("tenure_id", fromTenureId)
            .order("id")
            .range(from, to),
    );

    const rows = memberships
        .filter((m: any) => !alumniProfileIds.has(m.profile_id))
        .map((m: any) => ({
            profile_id: m.profile_id,
            unit_id: m.unit_id,
            tenure_id: toTenureId,
            role: m.role ?? "Member",
        }));

    if (!rows.length) return { inserted: 0, failed: 0 };

    // Chunked: a fellowship-sized insert in one request is a good way to hit a
    // statement or payload limit at the worst possible moment.
    let inserted = 0;
    let failed = 0;
    for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await db.from("membership_units").insert(chunk);
        if (error) {
            // Counted, not swallowed: the record tells the VP Admin how many were missed.
            console.error("carryMembershipForward chunk failed:", error.message);
            failed += chunk.length;
            continue;
        }
        inserted += chunk.length;
        // Logged per chunk, and only for chunks that landed, so the log never claims a
        // carry-over that the insert refused.
        await logMembershipEvents(
            chunk.map((r) => ({
                profileId: r.profile_id,
                unitId: r.unit_id,
                tenureId: toTenureId,
                action: "carried_over" as const,
            })),
            actor,
        );
    }
    return { inserted, failed };
}
