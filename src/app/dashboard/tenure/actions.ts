/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import {
    requireContext,
    requireModuleRead,
    requireModuleWrite,
    requireVpAdmin,
    canManageLevel,
    canManageUnit,
} from "@/lib/access-control";
import { canReadModule, canWriteModule, getModuleAccessConfig } from "@/lib/module-access";
import { db } from "@/lib/db";
import { tenureFullLabel } from "@/lib/tenure";
import { coronationSchema, type CoronationInput } from "@/lib/coronation";
import { parsePalette } from "@/lib/palette";
import { getTenurePresidentName } from "@/lib/backup";
import type { ProfileContext } from "@/lib/auth/profile-context";
import { computeLevel, LEVELS } from "@/lib/levels";
import { validatePrivilegeSet, derivePositionKind, normalizePrivileges } from "@/lib/privileges";
import {
    ensureLoginProvisioned,
    deprovisionLoginIfUnappointed,
    applyPositionLoginPolicy,
} from "@/lib/auth/provision";
import { positionGrantsLogin } from "@/lib/positions";
import {
    buildCatalogue,
    defaultGrantsLogin,
    isUndisableablePosition,
    isUndisableableLogin,
    TIER_ORDER,
    type PositionTier,
} from "@/config/leadership-positions";
import type { Privilege } from "@/lib/modules";
import {
    setFamilyName,
    unitIdsOfMember,
    logMembershipEvents,
    membershipActorOf,
    type MembershipActor,
} from "@/lib/fellowship";
import { revalidatePath } from "next/cache";
import { addToGenderTally, emptyGenderTally, tallyGender, type GenderTally } from "@/lib/gender";
import { genderForUnitSlug } from "@/config/fellowship-units";

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetches all data needed for the tenure dashboard
 * Includes active tenure, units, families, positions, and leadership assignments
 */
export async function getAdminData() {
    try {
        // READ is gated by the tenure module's access config (default: CENTRAL);
        // the mutations below require WRITE access (default: vp-admin; admins bypass).
        const ctx = await requireModuleRead("tenure");

        // 1. Get Active Tenure
        const { data: activeTenure } = await db
            .from('tenures')
            .select('*')
            .eq('is_active', true)
            .single();

        // 2. Fetch Master Data. We fetch positions directly (not via the SDK) so we
        //    control the columns we need (slug, alias, tier, is_protected).
        const [unitsRes, familiesRes, positionsRes, leadershipRes, profilesRes, membershipRes] = await Promise.all([
            db.from('units').select('*').order('name'),
            db.from('class_sets').select('*').order('entry_year', { ascending: false }),
            db.from('leadership_positions')
                .select('*, position_privileges(id, privilege, scope)')
                .order('tier').order('title'),
            // Fetch ALL leadership for the active tenure
            activeTenure
                // `profiles!leadership_profile_id_fkey`, not plain `profiles`: migration
                // 0014 added leadership.ended_by -> profiles, so there are now TWO
                // foreign keys between these tables and PostgREST refuses to guess
                // (PGRST201). An ambiguous embed does not degrade -- the whole query
                // errors, which emptied the cabinet roster and made every office read
                // as vacant.
                ? db.from('leadership')
                    .select(`
                        id, is_lead, unit_id, units(name, type, is_workforce),
                        class_set_id, class_sets(family_name, entry_year),
                        position:leadership_positions(title, tier, slug, position_privileges(privilege, scope)),
                        profile:profiles!leadership_profile_id_fkey(id, first_name, last_name, avatar_url, department, phone_number, gender)
                    `)
                    .eq('tenure_id', activeTenure.id)
                    // Current cabinet only. Ended appointments are service history and
                    // belong on the member's profile, not on the roster.
                    .is('ended_at', null)
                    .order('created_at', { ascending: false })
                : { data: [] },
            // All profiles (id/gender/class_set) — drives church-wide + generation stats.
            db.from('profiles').select('id, gender, class_set_id'),
            // Unit memberships for the active tenure — drives per-unit + workforce stats.
            activeTenure
                ? db.from('membership_units').select('profile_id, unit_id').eq('tenure_id', activeTenure.id)
                : { data: [] },
        ]);

        // 3. Process Data
        // Which unit slugs are TEAMs — needed to tell an EXCO position leading a team
        // from one leading a unit, now that `category` is derived rather than stored.
        const teamSlugs = new Set(
            (unitsRes.data || [])
                .filter((u: any) => u.type === "TEAM")
                .map((u: any) => u.slug as string),
        );

        const leaders = leadershipRes.data || [];
        const allProfiles = profilesRes.data || [];
        const memberships = membershipRes.data || [];
        const genderById = new Map<string, string | null>(
            allProfiles.map((p: any) => [p.id, p.gender]),
        );

        // Gender tallies come from @/lib/gender so that male + female + unspecified
        // always equals total. The previous helper counted only the two known values,
        // so a unit with three members whose gender was never recorded reported
        // "12 members, 5 brothers, 4 sisters" and left the reader to wonder.
        const tally = emptyGenderTally;
        const addGender = (acc: GenderTally, gender: unknown) => addToGenderTally(acc, gender);

        // Per-unit stats from memberships.
        const unitStats = new Map<string, ReturnType<typeof tally>>();
        for (const m of memberships as any[]) {
            if (!unitStats.has(m.unit_id)) unitStats.set(m.unit_id, tally());
            addGender(unitStats.get(m.unit_id)!, genderById.get(m.profile_id));
        }

        // The church-wide split, needed before the unit list because the gender
        // categories borrow from it.
        const churchWide = tallyGender(allProfiles as any[], (p) => p.gender);

        const units = (unitsRes.data || []).map((u: any) => {
            const gender = genderForUnitSlug(u.slug);
            // Brothers'/Sisters' hold no membership rows -- membership IS gender -- so
            // reading their count from membership_units would print "0 members" beside
            // a unit containing half the fellowship.
            const s = gender
                ? {
                    total: churchWide[gender],
                    male: gender === "male" ? churchWide.male : 0,
                    female: gender === "female" ? churchWide.female : 0,
                    unspecified: 0,
                }
                : (unitStats.get(u.id) || tally());
            return {
                ...u,
                isGenderCategory: gender !== null,
                memberCount: s.total,
                stats: s,
                leaders: leaders
                    .filter((l: any) => l.unit_id === u.id && l.is_lead !== false)
                    .map((l: any) => ({ ...l.profile, role: l.position?.title })),
            };
        });

        // Per-generation stats from profiles.class_set_id.
        const famStats = new Map<string, ReturnType<typeof tally>>();
        for (const p of allProfiles as any[]) {
            if (!p.class_set_id) continue;
            if (!famStats.has(p.class_set_id)) famStats.set(p.class_set_id, tally());
            addGender(famStats.get(p.class_set_id)!, p.gender);
        }

        const families = (familiesRes.data || []).map((f: any) => {
            const s = famStats.get(f.id) || tally();
            return {
                ...f,
                memberCount: s.total,
                stats: s,
                leaders: leaders
                    .filter((l: any) => l.class_set_id === f.id && l.is_lead !== false)
                    .map((l: any) => ({ ...l.profile, role: l.position?.title })),
            };
        });

        // Church-wide session stats. Workers = distinct members in a workforce UNIT.
        const workforceUnitIds = new Set(
            (unitsRes.data || [])
                .filter((u: any) => u.type === 'UNIT' && u.is_workforce !== false)
                .map((u: any) => u.id),
        );
        const workerIds = new Set(
            (memberships as any[])
                .filter((m) => workforceUnitIds.has(m.unit_id))
                .map((m) => m.profile_id),
        );
        const sessionStats = {
            totalMembers: allProfiles.length,
            totalWorkers: workerIds.size,
            totalMale: churchWide.male,
            totalFemale: churchWide.female,
            totalUnspecified: churchWide.unspecified,
            totalUnits: (unitsRes.data || []).filter((u: any) => u.type === 'UNIT').length,
            totalTeams: (unitsRes.data || []).filter((u: any) => u.type === 'TEAM').length,
            totalGenerations: (familiesRes.data || []).length,
        };

        return {
            activeTenure,
            units,
            families,
            // `category` is derived from each position's privilege tags — migration 0013
            // dropped the stored column. Attached here so the tenure UI (which groups and
            // filters by it) keeps working without every component re-deriving it.
            positions: (positionsRes.data || []).map((p: any) => ({
                ...p,
                category: derivePositionKind(
                    normalizePrivileges(p.position_privileges),
                    (slug) => teamSlugs.has(slug),
                ),
            })),
            leadership: leaders,
            sessionStats,
            authorized: true,
            // Drives UI affordances only — every catalogue mutation re-checks
            // requireVpAdmin() server-side.
            canEditCatalogue: ctx.isVpAdmin === true || ctx.isSysAdmin === true,
            // Drives the coronation / edit buttons only; coronateTenureAction re-checks.
            canWriteTenure: canWriteModule(ctx, "tenure", await getModuleAccessConfig()),
        };

    } catch (e) {
        return { authorized: false, error: "Access Denied" };
    }
}


// ============================================================================
// TENURE MANAGEMENT
// ============================================================================

/**
 * Creates a new tenure and deactivates all existing tenures
 */
export async function createTenureAction(formData: FormData) {
    await requireModuleWrite("tenure");
    try {
        // Deactivate all existing tenures
        await db.from('tenures').update({ is_active: false }).neq('id', '0');

        // A new tenure is a session, not yet coronated: the theme is unveiled at the
        // retreat and recorded then, never at creation.
        const { error } = await db.from('tenures').insert({
            session: formData.get("session") as string,
            start_date: new Date(formData.get("startDate") as string).toISOString(),
            is_active: true,
        });
        if (error) return { success: false, error: error.message };

        // The previously active tenure's palette no longer applies.
        revalidatePath('/dashboard', 'layout');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Updates an existing tenure's session. The theme and everything belonging to it is
 * recorded through coronateTenureAction instead — a theme is a coronation, not a field.
 */
export async function updateTenureAction(formData: FormData) {
    await requireModuleWrite("tenure");
    try {
        const session = ((formData.get("session") as string) || "").trim();
        if (!session) return { success: false, error: "The session is required." };
        const { error } = await db
            .from('tenures')
            .update({ session })
            .eq('id', formData.get("id"));
        if (error) return { success: false, error: error.message };

        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Handover: close the current tenure and open the next one in a single step,
 * auto-appointing the incoming VP Admin and ICT Coordinator into the new tenure.
 * This is the sanctioned way to end a tenure (see the Tenure Profile tab).
 */
/**
 * The most recent backup taken during a tenure, or null.
 *
 * Scoped by the tenure's own start date because `admin_audit_log` has no tenure column
 * and, more to the point, a backup taken before this tenure began doesn't contain this
 * tenure's appointments, memberships or transfers — so it isn't an undo for closing it.
 */
async function findBackupForTenure(
    tenureId: string | null,
): Promise<{ takenAt: string; takenBy: string | null } | { unavailable: true } | null> {
    if (!tenureId) return null;

    const { data: tenure } = await db
        .from("tenures")
        .select("start_date, created_at")
        .eq("id", tenureId)
        .maybeSingle();
    if (!tenure) return null;

    // `created_at` is when the row actually appeared; `start_date` can be backdated to
    // the real start of the session, so take whichever is earlier as the window.
    const candidates = [tenure.start_date, tenure.created_at]
        .filter(Boolean)
        .map((d: string) => new Date(d).getTime())
        .filter((t: number) => Number.isFinite(t));
    if (!candidates.length) return null;
    const since = new Date(Math.min(...candidates)).toISOString();

    const { data, error } = await db
        .from("admin_audit_log")
        .select("created_at, actor_name")
        // Either kind of backup satisfies the gate. A full system backup is strictly
        // MORE than a tenure one — every tenure, all history — so refusing to accept it
        // here would force the VP Admin to take a second, weaker backup to get past a
        // check that the stronger one already answers.
        .in("action", ["backup.download", "backup.system"])
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1);

    // A missing table (migration 0010 not applied) is NOT the same as "no backup taken".
    // Reporting it as the latter would block the handover with an error the VP Admin
    // could never clear by downloading another backup.
    if (error) return { unavailable: true };
    if (!data?.length) return null;
    return { takenAt: data[0].created_at, takenBy: data[0].actor_name };
}

/**
 * Preview a handover before anything is committed.
 *
 * The most important thing this returns is the GENERATION PROGRESSION — and the reason
 * it is a preview rather than a migration is worth stating plainly: a member's level is
 * not stored anywhere. It is computed from their generation's entry year against the
 * ACTIVE TENURE'S SESSION (`rcf_compute_level` in SQL, `computeLevel` in
 * src/lib/levels.ts). Advancing the session from 2026/2027 to 2027/2028 therefore moves
 * every generation forward and retires the finalists to Alumni on its own — no rows are
 * rewritten, and there is nothing to get half-done.
 *
 * So this screen exists to show the VP Admin the consequence of the session string they
 * are about to type, plus who loses access and whether a backup exists.
 */
export async function getHandoverPreviewAction(incomingSession: string) {
    try {
        await requireModuleWrite("tenure");

        const { data: tenure } = await db
            .from("tenures").select("id, session, theme").eq("is_active", true).maybeSingle();

        const { data: sets } = await db
            .from("class_sets")
            .select("id, family_name, entry_year, is_foundation, level_override")
            .order("entry_year", { ascending: false });

        const current = tenure?.session ?? null;
        const generations = (sets ?? []).map((s: any) => {
            const from = s.level_override || computeLevel(s.entry_year, s.is_foundation, current);
            // A pinned level_override does NOT advance — that is the point of pinning.
            const to = s.level_override
                || computeLevel(s.entry_year, s.is_foundation, incomingSession);
            return {
                classSetId: s.id,
                familyName: s.family_name,
                entryYear: s.entry_year,
                from,
                to,
                becomesAlumni: to === "Alumni" && from !== "Alumni",
                pinned: !!s.level_override,
            };
        });

        // Everyone appointed in the outgoing tenure. None of them carry over
        // automatically, so all of them lose portal access unless reappointed.
        const { data: outgoing } = tenure
            ? await db
                .from("leadership")
                .select("profile_id, profile:profiles!leadership_profile_id_fkey(first_name, last_name, email), position:leadership_positions(title)")
                .eq("tenure_id", tenure.id)
                .is("ended_at", null)
            : { data: [] };

        const one = (v: any) => (Array.isArray(v) ? v[0] : v);
        const seen = new Set<string>();
        const losingAccess: any[] = [];
        for (const l of (outgoing ?? []) as any[]) {
            if (seen.has(l.profile_id)) continue;
            seen.add(l.profile_id);
            const p = one(l.profile);
            losingAccess.push({
                profileId: l.profile_id,
                name: [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "Unknown",
                email: p?.email ?? null,
                position: one(l.position)?.title ?? null,
            });
        }

        // Has a backup been taken SINCE THIS TENURE OPENED? Recorded by the backup route
        // handler, so this is evidence rather than a checkbox the admin ticks — and
        // scoped to the tenure, because last year's backup is not an undo for this year.
        const backupResult = await findBackupForTenure(tenure?.id ?? null);
        const backupTrackingUnavailable =
            !!backupResult && "unavailable" in backupResult;
        const backup = backupTrackingUnavailable ? null : (backupResult as
            | { takenAt: string; takenBy: string | null }
            | null);

        // The backup's default passphrase is the president's name, so the picker has to
        // be able to show whose name to type.
        const presidentName = await getTenurePresidentName(tenure?.id ?? null);

        const { count: membershipCount } = tenure
            ? await db
                .from("membership_units")
                .select("id", { count: "exact", head: true })
                .eq("tenure_id", tenure.id)
            : { count: 0 };

        return {
            success: true as const,
            currentTenure: tenure ?? null,
            incomingSession,
            generations,
            losingAccess,
            backup,
            backupTrackingUnavailable,
            presidentName,
            membershipCount: membershipCount ?? 0,
        };
    } catch (e: any) {
        return { success: false as const, error: e.message };
    }
}

/**
 * Hand over to a new tenure.
 *
 * The sequence, in order, and why:
 *   1. Refuse without a backup. A handover cannot be undone from inside the app.
 *   2. Close the outgoing tenure, open the incoming one. THIS is what advances every
 *      generation — see getHandoverPreviewAction.
 *   3. Appoint the incoming VP Admin and ICT Coordinator, so the new tenure is never
 *      left unadministrable.
 *   4. Carry unit/team membership forward for everyone who has not graduated.
 *   5. Revoke portal access for outgoing leaders who were not carried over.
 *
 * Steps 4 and 5 are opt-out flags rather than assumptions, because both are large and
 * neither is obviously right for every fellowship.
 */
export async function handoverTenureAction(formData: FormData) {
    // A handover is the write-bypass tier's alone — not the wider tenure-write group.
    const ctx = await requireVpAdmin();
    try {
        const session = ((formData.get("session") as string) || "").trim();
        const startDate = formData.get("startDate") as string;
        const vpAdminProfileId = formData.get("vpAdminProfileId") as string;
        const ictCoordProfileId = formData.get("ictCoordProfileId") as string;
        const carryMembership = formData.get("carryMembership") !== "false";
        const revokeOutgoing = formData.get("revokeOutgoing") !== "false";
        const intentId = (formData.get("intentId") as string) || null;

        if (!session || !startDate) {
            return { success: false, error: "The new session and its start date are required." };
        }
        if (!vpAdminProfileId || !ictCoordProfileId) {
            return { success: false, error: "You must appoint the incoming VP Admin and ICT Coordinator." };
        }

        const { data: outgoingForBackup } = await db
            .from('tenures').select('id').eq('is_active', true).maybeSingle();

        // 1. A backup is the only undo for this. Refuse without one taken during the
        //    tenure being closed — an older bundle wouldn't restore what is about to be
        //    changed.
        const backupCheck = await findBackupForTenure(outgoingForBackup?.id ?? null);
        if (backupCheck && "unavailable" in backupCheck) {
            return {
                success: false,
                error: "Backup downloads aren't being recorded, so this can't be verified. Apply db/migrations/0010_admin_audit_log.sql first.",
            };
        }
        if (!backupCheck) {
            return {
                success: false,
                error: "Download a backup of THIS tenure before handing over — it cannot be undone from inside the app.",
            };
        }

        const { data: positions } = await db
            .from('leadership_positions')
            .select('id, title')
            .in('title', ['Vice President Administration', 'ICT Coordinator']);
        const vpPos = positions?.find((p) => p.title === 'Vice President Administration');
        const ictPos = positions?.find((p) => p.title === 'ICT Coordinator');
        if (!vpPos || !ictPos) {
            return { success: false, error: "Default VP Admin / ICT Coordinator positions are missing. Run the catalogue sync first." };
        }

        const { data: outgoingTenure } = await db
            .from('tenures').select('id').eq('is_active', true).maybeSingle();

        // Who held a position on the way out — captured before anything changes.
        const { data: outgoingLeaders } = outgoingTenure
            ? await db.from('leadership').select('profile_id')
                .eq('tenure_id', outgoingTenure.id).is('ended_at', null)
            : { data: [] };
        const outgoingIds = Array.from(new Set((outgoingLeaders ?? []).map((l: any) => l.profile_id)));

        // 2. Close the current tenure and open the new one.
        await db.from('tenures')
            .update({ is_active: false, end_date: new Date().toISOString() })
            .eq('is_active', true);

        const { data: newTenure, error: tErr } = await db.from('tenures')
            // Opened uncoronated: a handover starts a session, the retreat names it.
            .insert({
                session,
                start_date: new Date(startDate).toISOString(),
                is_active: true,
            })
            .select('id')
            .single();
        if (tErr || !newTenure) return { success: false, error: tErr?.message || "Could not create the new tenure." };

        // 3. Incoming defaults.
        const { error: lErr } = await db.from('leadership').insert([
            { tenure_id: newTenure.id, profile_id: vpAdminProfileId, position_id: vpPos.id, is_lead: true },
            { tenure_id: newTenure.id, profile_id: ictCoordProfileId, position_id: ictPos.id, is_lead: true },
        ]);
        if (lErr) return { success: false, error: `Tenure created, but appointing leaders failed: ${lErr.message}` };

        for (const id of [vpAdminProfileId, ictCoordProfileId]) {
            try {
                await ensureLoginProvisioned(id, ctx.profile.id);
            } catch (e: any) {
                console.error("handover login provisioning failed:", e.message);
            }
        }

        // 4. Carry membership forward, minus the graduating generation.
        let carried = 0;
        if (carryMembership && outgoingTenure) {
            carried = await carryMembershipForward(
                outgoingTenure.id, newTenure.id, session, membershipActorOf(ctx),
            );
        }

        // 5. Revoke access for outgoing leaders who weren't carried over. Runs against
        //    the NEW tenure, so anyone reappointed in step 3 keeps their login.
        let revoked = 0;
        if (revokeOutgoing) {
            for (const profileId of outgoingIds) {
                try {
                    const { removed } = await deprovisionLoginIfUnappointed(profileId);
                    if (removed) revoked += 1;
                } catch (e: any) {
                    console.error(`handover: could not revoke ${profileId}:`, e.message);
                }
            }
        }

        // Close out the intent: this is the row a successor reads to see what happened.
        if (intentId) {
            const actor = actorOf(ctx);
            const { error: intentError } = await db
                .from("handover_intents")
                .update({
                    status: "completed",
                    to_tenure_id: newTenure.id,
                    completed_by: actor.id,
                    completed_by_name: actor.name,
                    completed_at: new Date().toISOString(),
                    step: 6,
                })
                .eq("id", intentId);
            if (intentError) console.error("handover intent completion failed:", intentError.message);

            await logHandoverEvent(
                intentId,
                ctx,
                "completed",
                `Opened ${tenureFullLabel({ session })}. ${carried} membership${carried === 1 ? "" : "s"} carried forward, ${revoked} outgoing login${revoked === 1 ? "" : "s"} revoked.`,
            );
        }

        // A new active tenure means a new (usually absent) palette for every page.
        revalidatePath('/dashboard', 'layout');
        return { success: true, tenureId: newTenure.id, carried, revoked };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Copy unit/team membership into the new tenure, skipping anyone who has graduated.
 *
 * Without this every unit and team starts the session completely empty, and each
 * executive re-adds their whole roster by hand — membership rows are tenure-scoped, so
 * a new tenure genuinely has none. Members whose generation computes to "Alumni" under
 * the INCOMING session are left behind, which is how graduation actually takes effect
 * on the workforce.
 */
async function carryMembershipForward(
    fromTenureId: string,
    toTenureId: string,
    incomingSession: string,
    actor: MembershipActor,
): Promise<number> {
    const { data: sets } = await db
        .from("class_sets")
        .select("id, entry_year, is_foundation, level_override");

    const graduated = new Set(
        (sets ?? [])
            .filter((s: any) => {
                const level = s.level_override
                    || computeLevel(s.entry_year, s.is_foundation, incomingSession);
                return level === "Alumni";
            })
            .map((s: any) => s.id),
    );

    const { data: profiles } = await db
        .from("profiles").select("id, class_set_id");
    const alumniProfileIds = new Set(
        (profiles ?? [])
            .filter((p: any) => p.class_set_id && graduated.has(p.class_set_id))
            .map((p: any) => p.id),
    );

    const { data: memberships } = await db
        .from("membership_units")
        .select("profile_id, unit_id, role")
        .eq("tenure_id", fromTenureId);

    const rows = (memberships ?? [])
        .filter((m: any) => !alumniProfileIds.has(m.profile_id))
        .map((m: any) => ({
            profile_id: m.profile_id,
            unit_id: m.unit_id,
            tenure_id: toTenureId,
            role: m.role ?? "Member",
        }));

    if (!rows.length) return 0;

    // Chunked: a fellowship-sized insert in one request is a good way to hit a
    // statement or payload limit at the worst possible moment.
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await db.from("membership_units").insert(chunk);
        if (error) {
            console.error("carryMembershipForward chunk failed:", error.message);
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
    return inserted;
}

/**
 * Closes a tenure (sets is_active = false, adds end_date)
 */
export async function closeTenureAction(tenureId: string) {
    await requireModuleWrite("tenure");
    try {
        await db.from('tenures')
            .update({ is_active: false, end_date: new Date() })
            .eq('id', tenureId);
        
        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// ============================================================================
// CORONATION
// ============================================================================

/**
 * Record (or correct) the active tenure's coronation: its theme, the Bible reference it
 * is drawn from, the day of the retreat, and optionally its banner, icon and palette.
 *
 * Everything is validated again here with the form's own schema — the image URLs must
 * be this project's Cloudinary, and a palette that fails WCAG AA is refused with the
 * measured ratio. The form's checks are a convenience; these are the rule.
 *
 * Nothing is written to `events`: the retreat is not an app-managed event.
 */
export async function coronateTenureAction(tenureId: string, input: CoronationInput) {
    try {
        const ctx = await requireModuleWrite("tenure");
        const parsed = coronationSchema.safeParse(input);
        if (!parsed.success) {
            return {
                success: false as const,
                error: parsed.error.issues[0]?.message ?? "Check the form and try again.",
                fieldErrors: Object.fromEntries(
                    parsed.error.issues.map((i) => [String(i.path[0] ?? "form"), i.message]),
                ) as Record<string, string>,
            };
        }
        const v = parsed.data;
        const palette = v.usePalette ? parsePalette({ primary: v.primary, accent: v.accent }) : null;

        const { error } = await db
            .from("tenures")
            .update({
                theme: v.theme,
                theme_text: v.themeText,
                coronated_on: v.coronatedOn,
                theme_banner_url: v.bannerUrl ?? null,
                theme_icon_url: v.iconUrl ?? null,
                theme_palette: palette,
                coronation_recorded_by: ctx.profile.id,
            })
            .eq("id", tenureId);
        if (error) return { success: false as const, error: error.message };

        // The palette repaints every dashboard page, not just this one.
        revalidatePath("/dashboard", "layout");
        return { success: true as const };
    } catch (e: any) {
        return { success: false as const, error: e.message };
    }
}

/**
 * Remove a coronation that was recorded by mistake. Clears the theme and everything
 * that belongs to it together — the database refuses anything else — and the
 * dashboard returns to the brand colours.
 */
export async function clearCoronationAction(tenureId: string) {
    try {
        await requireModuleWrite("tenure");
        const { error } = await db
            .from("tenures")
            .update({
                theme: null,
                theme_text: null,
                coronated_on: null,
                theme_banner_url: null,
                theme_icon_url: null,
                theme_palette: null,
                coronation_recorded_by: null,
            })
            .eq("id", tenureId);
        if (error) return { success: false as const, error: error.message };
        revalidatePath("/dashboard", "layout");
        return { success: true as const };
    } catch (e: any) {
        return { success: false as const, error: e.message };
    }
}

// ============================================================================
// STRUCTURE MANAGEMENT
// ============================================================================

/**
 * Creates a new unit (ministry/team)
 */
export async function createUnitAction(formData: FormData) {
    await requireModuleWrite("tenure");
    try {
        const type = formData.get("type") as string;
        const name = ((formData.get("name") as string) || "").trim();
        // "Loose units" are type UNIT whose members don't count as workforce
        // (e.g. Sisters Unit). Teams never count. Insert directly so we can set it.
        const isWorkforce = type === 'UNIT'
            ? formData.get("isWorkforce") !== "false"
            : false;
        // units.slug is NOT NULL (migration 0006) and is the Exco:<slug> scope target.
        // Auto-derive from the name when not supplied; immutable once created.
        const slug = slugify(((formData.get("slug") as string) || "").trim() || name);
        if (!slug) return { success: false, error: "A valid name (letters/numbers) is required." };

        const { error } = await db.from('units').insert({
            name,
            type,
            is_workforce: isWorkforce,
            slug,
        });
        if (error) {
            if (error.code === '23505') return { success: false, error: "A unit/team with that name or slug already exists." };
            return { success: false, error: error.message };
        }

        // Every unit needs its Executive position, scoped to the unit's slug. Minting it
        // here is what keeps the catalogue COMPLETE without anyone maintaining it by
        // hand — a unit with no Exco position can never be given a leader.
        await syncCatalogue();

        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Assigns a family name to an entry year (e.g., 2023 → "Eagles")
 */
export async function nameFamilyAction(formData: FormData) {
    await requireModuleWrite("tenure");
    try {
        await setFamilyName(
            parseInt(formData.get("entryYear") as string, 10),
            formData.get("familyName") as string,
        );

        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Creates (or updates) a generation by entry year, with an optional name and the
 * PDS/UABS foundation flag. Entry year is unique — re-using one updates that set.
 */
export async function createGenerationAction(formData: FormData) {
    await requireModuleWrite("tenure");
    try {
        const entryYear = parseInt(formData.get("entryYear") as string);
        if (!entryYear || Number.isNaN(entryYear)) {
            return { success: false, error: "A valid entry year is required." };
        }
        const familyName = ((formData.get("familyName") as string) || "").trim();
        const isFoundation = formData.get("isFoundation") === "true";

        const { error } = await db
            .from('class_sets')
            .upsert(
                { entry_year: entryYear, family_name: familyName || null, is_foundation: isFoundation },
                { onConflict: 'entry_year' },
            );
        if (error) return { success: false, error: error.message };

        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Sets (or clears) a generation's manual level override. Enforces the "no two
 * generations share a level" rule against every other generation's EFFECTIVE level
 * (its own override, else its computed level for the active session).
 * Pass an empty/null level to clear the override.
 */
export async function setLevelOverrideAction(classSetId: string, level: string | null) {
    await requireModuleWrite("tenure");
    try {
        const target = (level || "").trim();

        // Clearing: just null it out.
        if (!target) {
            const { error } = await db
                .from('class_sets').update({ level_override: null }).eq('id', classSetId);
            if (error) return { success: false, error: error.message };
            revalidatePath('/dashboard/tenure');
            return { success: true };
        }

        if (!LEVELS.includes(target as (typeof LEVELS)[number])) {
            return { success: false, error: `"${target}" is not a valid level.` };
        }

        // Resolve the active session + all generations to check for a level clash.
        const { data: active } = await db
            .from('tenures').select('session').eq('is_active', true).single();
        const session = active?.session ?? null;

        const { data: sets } = await db
            .from('class_sets').select('id, entry_year, is_foundation, level_override');

        const clash = (sets || []).some((s: any) => {
            if (s.id === classSetId) return false;
            const effective = s.level_override
                || computeLevel(s.entry_year, s.is_foundation, session);
            return effective === target;
        });
        if (clash) {
            return { success: false, error: `Another generation is already at ${target}.` };
        }

        const { error } = await db
            .from('class_sets').update({ level_override: target }).eq('id', classSetId);
        if (error) {
            if (error.code === '23505') return { success: false, error: `Another generation is already at ${target}.` };
            return { success: false, error: error.message };
        }
        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Gets detailed information about a specific unit including assigned leaders
 */
export async function getUnitDetails(unitId: string) {
    await requireModuleRead("tenure");

    // Get active tenure ID
    const { data: active } = await db
        .from('tenures')
        .select('id')
        .eq('is_active', true)
        .single();
    
    if (!active) return { leaders: [] };

    // Fetch leaders for this unit in the active tenure
    const { data: leaders } = await db
        .from('leadership')
        .select(`
            id,
            position:leadership_positions(title, tier),
            profile:profiles!leadership_profile_id_fkey(id, first_name, last_name, avatar_url, phone_number)
        `)
        .eq('unit_id', unitId)
        .is('ended_at', null)
        .eq('tenure_id', active.id);

    return { leaders };
}

// ============================================================================
// LEADERSHIP & CABINET MANAGEMENT
// ============================================================================

/**
 * Slugify a label into a stable position handle (lowercase, kebab-case).
 * Mirrors the backfill logic in db/migrations/0004.
 */
function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Parse the `privileges` form field (a JSON array of { tag, scope }) into a clean set,
 * dropping malformed entries and normalising empty scopes to null.
 */
function parsePrivileges(raw: string | null): Privilege[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((p) => p && typeof p.tag === "string")
            .map((p) => ({
                tag: p.tag,
                scope: p.scope == null || p.scope === "" || p.scope === "all" ? null : String(p.scope),
            })) as Privilege[];
    } catch {
        return [];
    }
}

/**
 * Guard a privilege set before persisting: run the pure validator, then the checks the
 * DB trigger can't express — President is single & unique ACROSS positions (only one
 * position may hold it). `excludePositionId` skips the position being edited.
 * Returns an error string, or null when OK.
 */
async function assertPrivilegesAssignable(
    privs: Privilege[],
    excludePositionId?: string,
): Promise<string | null> {
    const local = validatePrivilegeSet(privs);
    if (local) return local;

    if (privs.some((p) => p.tag === "PRESIDENT")) {
        let q = db
            .from("position_privileges")
            .select("position_id")
            .eq("privilege", "PRESIDENT");
        if (excludePositionId) q = q.neq("position_id", excludePositionId);
        const { data: existing } = await q.limit(1);
        if (existing && existing.length > 0) {
            return "A President role already exists — President is single and unique.";
        }
    }
    return null;
}

/**
 * Creates a new leadership position (role) with a stable, unique slug and its privilege
 * tags (+ scopes). The ict-lib PositionSchema has no alias/slug/privileges, so we insert
 * directly. Slug is set ONCE here and never changed on update (immutable).
 */
export async function createPositionAction(formData: FormData) {
    // The CATALOGUE is the VP Admin's alone. Tenure-write lets you appoint people
    // INTO positions; changing what the positions ARE is a narrower right.
    await requireVpAdmin();
    try {
        const title = ((formData.get("title") as string) || "").trim();
        const alias = ((formData.get("alias") as string) || "").trim();
        const rawSlug = ((formData.get("slug") as string) || "").trim();
        const description = ((formData.get("description") as string) || "").trim();
        const privileges = parsePrivileges(formData.get("privileges") as string | null);

        if (!title) return { success: false, error: "Role title is required." };

        const slug = slugify(rawSlug || alias || title);
        if (!slug) return { success: false, error: "A valid slug (letters/numbers) is required." };

        const privError = await assertPrivilegesAssignable(privileges);
        if (privError) return { success: false, error: privError };

        const { data: position, error } = await db
            .from("leadership_positions")
            .insert({
                title,
                alias: alias || null,
                slug,
                description: description || null,
                is_active: true,
            })
            .select("id")
            .single();

        if (error || !position) {
            if (error?.code === "23505") {
                return { success: false, error: "That role title or slug is already in use." };
            }
            return { success: false, error: error?.message || "Could not create the role." };
        }

        if (privileges.length > 0) {
            const { error: pErr } = await db.from("position_privileges").insert(
                privileges.map((p) => ({ position_id: position.id, privilege: p.tag, scope: p.scope })),
            );
            if (pErr) {
                // Roll back the orphaned position so a failed privilege insert isn't left half-done.
                await db.from("leadership_positions").delete().eq("id", position.id);
                return { success: false, error: pErr.message };
            }
        }

        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Replace a position's privilege tags (+ scopes) atomically — the row editor's save.
 * The ICT Coordinator's SYSADMIN privilege is immutable (not editable here). Validates
 * the full set (incl. President single/unique). The position's KIND is derived from
 * these tags at read time (derivePositionKind / rcf_position_kind) — there is no longer
 * a denormalised column to keep in step.
 */
export async function setPositionPrivilegesAction(positionId: string, privilegesInput: Privilege[]) {
    // The CATALOGUE is the VP Admin's alone. Tenure-write lets you appoint people
    // INTO positions; changing what the positions ARE is a narrower right.
    await requireVpAdmin();
    try {
        const { data: pos } = await db
            .from("leadership_positions").select("slug").eq("id", positionId).single();
        if (!pos) return { success: false, error: "Role not found." };
        if (pos.slug === "ict-coord") {
            return { success: false, error: "The ICT Coordinator is the System Admin — its privileges are fixed." };
        }

        const privileges = parsePrivileges(JSON.stringify(privilegesInput ?? []));
        const privError = await assertPrivilegesAssignable(privileges, positionId);
        if (privError) return { success: false, error: privError };

        // Replace: clear then re-insert. The DB trigger still backstops each insert.
        const { error: delErr } = await db
            .from("position_privileges").delete().eq("position_id", positionId);
        if (delErr) return { success: false, error: delErr.message };

        if (privileges.length > 0) {
            const { error: insErr } = await db.from("position_privileges").insert(
                privileges.map((p) => ({ position_id: positionId, privilege: p.tag, scope: p.scope })),
            );
            if (insErr) return { success: false, error: insErr.message };
        }

        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Toggles a position's active status
 */
export async function togglePositionAction(id: string, currentStatus: boolean, data: any) {
    // The CATALOGUE is the VP Admin's alone. Tenure-write lets you appoint people
    // INTO positions; changing what the positions ARE is a narrower right.
    await requireVpAdmin();
    try {
        // The VP Admin and ICT Coordinator may never be disabled — identified by their
        // immutable slug, not by the dropped `is_default` column.
        if (currentStatus && isUndisableablePosition(data?.slug)) {
            return {
                success: false,
                error: "The VP Admin and ICT Coordinator roles cannot be disabled.",
            };
        }

        // Only the display fields are updatable here — slug is immutable, and
        // privileges are changed through setPositionPrivilegesAction.
        const { error } = await db
            .from("leadership_positions")
            .update({
                title: data?.title,
                alias: data?.alias ?? null,
                description: data?.description ?? null,
                is_active: !currentStatus,
            })
            .eq("id", id);
        if (error) return { success: false, error: error.message };

        revalidatePath('/dashboard/tenure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Searches for members by name, email, or phone number
 * Returns formatted results with unit/team memberships
 */
export async function searchMemberAction(query: string) {

    const { data, error } = await db
        .rpc('search_members_detailed', { 
            query_text: query.trim() 
        });

    if (error) {
        console.error("Search RPC Error:", error);
        return [];
    }

    return data.map((user: any) => ({
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone_number: user.phone_number,
        department: user.department,
        level: user.level, // <--- Now available! (e.g. "500 Level")
        avatar_url: user.avatar_url,
        units: user.units?.join(", ") || null,
        teams: user.teams?.join(", ") || null,
        leadership: user.leadership?.map((l:any) => l.title).join(", ") || null
    }));
}
/**
 * Assigns a member to a leadership position
 */
export async function assignLeaderAction(formData: FormData) {
    const ctx = await requireModuleWrite("tenure");

    const tenureId = formData.get("tenureId") as string;
    const profileId = formData.get("profileId") as string;
    const positionId = formData.get("positionId") as string;
    // Sub-leaders (assistants) share the same position with is_lead = false.
    let isLead = formData.get("isLead") !== "false";

    try {
        // THE PRESIDENCY AND THE VICE PRESIDENCIES HAVE NO ASSISTANTS.
        //
        // There is no such thing as an assistant President — the office is one person,
        // and "Assistant VP Administration" is not a thing the fellowship has. So this
        // coerces rather than refuses: a request for an assistant to one of these is a
        // request the form should never have been able to make, and turning it into the
        // only valid reading is kinder than an error about a distinction that does not
        // exist here.
        const { data: targetPosition } = await db
            .from("leadership_positions")
            .select("tier")
            .eq("id", positionId)
            .maybeSingle();
        if (targetPosition?.tier === "PRESIDENT" || targetPosition?.tier === "VP") {
            isLead = true;
        }

        // Scope now lives on the position's privileges, not the assignment — so a
        // President is single & unique: if the target position holds the PRESIDENT
        // privilege, block when any President is already appointed this tenure.
        const { data: presidentPriv } = await db
            .from("position_privileges")
            .select("id")
            .eq("position_id", positionId)
            .eq("privilege", "PRESIDENT")
            .maybeSingle();

        if (presidentPriv) {
            const { data: existingPresident } = await db
                .from("leadership")
                .select("id, position:leadership_positions!inner(position_privileges!inner(privilege))")
                .eq("tenure_id", tenureId)
                .is("ended_at", null)
                .eq("position.position_privileges.privilege", "PRESIDENT")
                .maybeSingle();
            if (existingPresident) {
                return { success: false, error: "A President has already been appointed for this tenure." };
            }
        }

        // A position may have only ONE lead per tenure; assistants are unlimited.
        if (isLead) {
            const { data: existingLead } = await db
                .from("leadership")
                .select("id")
                .eq("tenure_id", tenureId)
                .eq("position_id", positionId)
                .eq("is_lead", true)
                // A predecessor who stepped down does not block their successor.
                .is("ended_at", null)
                .maybeSingle();
            if (existingLead) {
                return { success: false, error: "This role already has a lead. Add them as an assistant instead." };
            }
        }

        const { error } = await db.from("leadership").insert({
            tenure_id: tenureId,
            profile_id: profileId,
            position_id: positionId,
            unit_id: null,
            class_set_id: null,
            is_lead: isLead,
        });
        if (error) {
            if (error.code === '23505') {
                // Two unique constraints land here. `leadership_one_lead_per_position`
                // is the one-lead-per-office rule, which the check above usually
                // catches — reaching it means another appointment landed in between,
                // and the raw index name is not something to show a VP Admin.
                if (error.message?.includes("leadership_one_lead_per_position")) {
                    return {
                        success: false,
                        error: "Somebody else was just made lead of this office. Add this member as an assistant instead.",
                    };
                }
                return { success: false, error: "This member is already assigned to this role context." };
            }
            return { success: false, error: error.message };
        }

        // Appointment grants portal access only where the OFFICE does — leads and
        // assistants alike. Most of the fellowship's offices are in the catalogue as a
        // record of service and carry no login (see leadership_positions.grants_login),
        // so appointing a Transport Secretary must not mint an account for someone with
        // nothing to administer.
        //
        // Where it does grant access, the row is created with no password, so the
        // appointee sets their own on first login; we never invent one for them.
        // Idempotent, and never overwrites an existing password (someone already leading
        // elsewhere keeps theirs).
        let loginCreated = false;
        try {
            if (await positionGrantsLogin(positionId)) {
                ({ created: loginCreated } = await ensureLoginProvisioned(profileId, ctx.profile.id));
            }
        } catch (e: any) {
            // The appointment itself succeeded — surface the login failure without
            // pretending the whole action failed, so the admin knows to retry access.
            return {
                success: true,
                loginCreated: false,
                warning: `Assigned, but their portal login could not be created: ${e.message}`,
            };
        }

        return { success: true, loginCreated };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
/**
 * Assigns a leader to a specific unit (used in ManageUnitModal)
 * Auto-fills tenure ID from active tenure
 */
export async function addUnitLeaderAction(formData: FormData) {
    await requireModuleWrite("tenure");
    
    // Get active tenure
    const { data: tenure } = await db
        .from('tenures')
        .select('id')
        .eq('is_active', true)
        .single();
    
    if (!tenure) {
        return { success: false, error: "No active tenure" };
    }

    // Append tenure ID and call main assign function
    formData.append("tenureId", tenure.id);
    return assignLeaderAction(formData);
}

/**
 * Removes a leadership assignment
 */
/**
 * Remove a leader from an office.
 *
 * @param keepHistory  true (the default) ENDS the appointment and keeps the row, so it
 *                     shows on the member's service record as
 *                     "Welfare Coordinator (2025/2026)". false deletes it outright.
 *
 * The default is to keep, because the record IS the point: a fellowship's memory of who
 * served is asked for at handovers, for references, and years later — and it used to be
 * destroyed by the same click that ended the appointment.
 *
 * The delete is kept for the genuine mistake, appointed-the-wrong-person-two-minutes-ago.
 * A service record that includes appointments which never happened is worse than none,
 * so the admin decides, and the safe option is the one that needs no thought.
 *
 * ENDING REVOKES. `ended_at` is not a display flag: migration 0014 teaches
 * `rcf_profile_context` and every "is this person still serving?" query to ignore ended
 * rows, so an ended appointment carries no privileges and frees the office for a
 * successor. See the migration's header for the six places that had to change together.
 */
export async function removeUnitLeaderAction(id: string, keepHistory: boolean = true) {
    const ctx = await requireModuleWrite("tenure");
    try {
        // Read the occupant BEFORE the write — after a delete there is no row to ask.
        const { data: row } = await db
            .from('leadership')
            .select('profile_id')
            .eq('id', id)
            .maybeSingle();

        if (keepHistory) {
            const { error: endErr } = await db
                .from('leadership')
                .update({
                    ended_at: new Date().toISOString(),
                    ended_by: ctx.profile.id,
                })
                .eq('id', id)
                // Ending an already-ended appointment would rewrite the date it ended,
                // which is the one fact the record exists to hold.
                .is('ended_at', null);
            if (endErr) return { success: false, error: endErr.message };
        } else {
            await db.from('leadership').delete().eq('id', id);
        }

        // Appointment grants portal access (assignLeaderAction), so removal revokes it.
        // Only when this was their LAST position — someone leading two units and
        // stepping down from one still needs to sign in.
        let loginRemoved = false;
        if (row?.profile_id) {
            try {
                ({ removed: loginRemoved } = await deprovisionLoginIfUnappointed(row.profile_id));
            } catch (e: any) {
                // The removal itself succeeded; say so, and flag the access problem
                // rather than pretending the whole action failed.
                revalidatePath('/dashboard/tenure');
                return {
                    success: true,
                    loginRemoved: false,
                    warning: `Removed, but their portal login could not be revoked: ${e.message}`,
                };
            }
        }

        revalidatePath('/dashboard/tenure');
        return { success: true, loginRemoved, keptHistory: keepHistory };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}


// ============================================================================
// LEADERSHIP CATALOGUE
// ============================================================================
//
// The catalogue (src/config/leadership-positions.ts) is the fellowship's org chart:
// President → VPs → Executives → Level Coordinators. It is FROZEN in the sense that
// matters — it stays the same from one tenure to the next, and a handover swaps the
// PEOPLE in `leadership` rather than redefining the positions. It is not immutable:
// when the fellowship genuinely restructures, the VP Admin makes that change.

/**
 * Bring the database in line with the code catalogue: upsert the fixed offices, one
 * Executive per unit/team, one Coordinator per level.
 *
 * Additive only — it never deletes or deactivates a position, because doing so would
 * silently strip authority from whoever currently holds it. Removing a position is a
 * deliberate act performed through togglePositionAction.
 *
 * Called after creating a unit, and available to the VP Admin as an explicit repair.
 */
async function syncCatalogue(): Promise<{ created: number }> {
    const { data: units } = await db
        .from("units")
        .select("slug, name, type");

    const specs = buildCatalogue(
        (units ?? []).map((u: any) => ({ slug: u.slug, name: u.name, type: u.type })),
    );

    const { data: existing } = await db
        .from("leadership_positions")
        .select("id, slug, title");
    const bySlug = new Map((existing ?? []).map((p: any) => [p.slug, p]));
    const byTitle = new Map((existing ?? []).map((p: any) => [p.title, p]));

    let created = 0;

    for (const spec of specs) {
        // `title` carries the UNIQUE constraint, so match on either handle before
        // inserting — a row seeded by the migration under a different slug must not
        // be duplicated.
        if (bySlug.has(spec.slug) || byTitle.has(spec.title)) continue;

        const { data: inserted, error } = await db
            .from("leadership_positions")
            .insert({
                slug: spec.slug,
                title: spec.title,
                alias: spec.alias,
                description: spec.description,
                is_active: true,
                tier: spec.tier,
                is_protected: true,
                // Only the DEFAULT — tags mean there is something to administer. Once
                // the row exists this column belongs to the VP Admin, and the sync is
                // additive, so a later run never overwrites their decision.
                grants_login: defaultGrantsLogin(spec),
            })
            .select("id")
            .single();

        if (error || !inserted) {
            console.error(`Catalogue sync: could not create "${spec.title}":`, error?.message);
            continue;
        }

        const { error: privError } = await db
            .from("position_privileges")
            .insert(
                spec.privileges.map((p) => ({
                    position_id: inserted.id,
                    privilege: p.tag,
                    scope: p.scope,
                })),
            );
        if (privError) {
            console.error(`Catalogue sync: privileges for "${spec.title}":`, privError.message);
        }
        created += 1;
    }

    return { created };
}

/** VP Admin: re-run the catalogue sync by hand (e.g. after editing the code catalogue). */
export async function syncCatalogueAction() {
    try {
        await requireVpAdmin();
        const { created } = await syncCatalogue();
        revalidatePath("/dashboard/tenure");
        return {
            success: true as const,
            created,
            message: created
                ? `Added ${created} missing position${created === 1 ? "" : "s"}.`
                : "The catalogue is already complete.",
        };
    } catch (e: any) {
        return { success: false as const, error: e.message };
    }
}

/**
 * VP Admin: decide whether an office comes with a portal login.
 *
 * HOLDING AN OFFICE AND HAVING ACCESS ARE TWO DIFFERENT THINGS. The catalogue carries
 * every office in the fellowship so that a member's service is on record under their
 * name — the Transport Secretary is a real office and reads as one on the cabinet
 * screen — but most of those offices administer nothing in this portal, and an account
 * nobody needs is an account nobody watches.
 *
 * The change is RETROACTIVE, which is the only way it means anything: switching an
 * office off revokes its current holders' access rather than merely applying to the
 * next appointee. De-provisioning still goes through deprovisionLoginIfUnappointed, so
 * a holder who also leads a unit keeps their login — losing one office is not losing
 * every reason to sign in.
 *
 * SECURITY: this grants and revokes portal authentication, so it is gated on
 * requireVpAdmin (not the tenure module's write config, which excos can hold), and
 * every change is written to admin_audit_log. vp-admin and ict-coord can never be
 * switched off — refused here and again by the enforce_login_granting_offices trigger,
 * because a VP Admin who revokes their own office's access locks the fellowship out of
 * the screen that would restore it.
 */
export async function setPositionLoginAction(positionId: string, grantsLogin: boolean) {
    try {
        const ctx = await requireVpAdmin();

        const { data: position, error } = await db
            .from("leadership_positions")
            .select("id, slug, title, grants_login")
            .eq("id", positionId)
            .maybeSingle();

        if (error || !position) {
            return { success: false as const, error: "That office is not in the catalogue." };
        }

        if (!grantsLogin && isUndisableableLogin(position.slug)) {
            return {
                success: false as const,
                error: `${position.title} must always keep portal access — without it the fellowship cannot administer itself.`,
            };
        }

        if (position.grants_login === grantsLogin) {
            return {
                success: true as const,
                provisioned: 0,
                revoked: 0,
                message: `${position.title} already ${grantsLogin ? "grants" : "grants no"} portal access.`,
            };
        }

        const { error: updateError } = await db
            .from("leadership_positions")
            .update({ grants_login: grantsLogin })
            .eq("id", positionId);
        if (updateError) return { success: false as const, error: updateError.message };

        const { provisioned, revoked } = await applyPositionLoginPolicy(
            positionId,
            grantsLogin,
            ctx.profile.id,
        );

        const actor = actorOf(ctx);
        await db.from("admin_audit_log").insert({
            actor_profile_id: actor.id,
            actor_name: actor.name,
            action: "position.grants_login",
            field: position.slug ?? position.title,
            old_value: String(position.grants_login),
            new_value: String(grantsLogin),
        });

        revalidatePath("/dashboard/tenure");

        const effect = grantsLogin
            ? provisioned
                ? ` ${provisioned} holder${provisioned === 1 ? "" : "s"} can now sign in.`
                : ""
            : revoked
                ? ` ${revoked} holder${revoked === 1 ? "" : "s"} lost portal access.`
                : "";

        return {
            success: true as const,
            provisioned,
            revoked,
            message: `${position.title} ${grantsLogin ? "now grants" : "no longer grants"} portal access.${effect}`,
        };
    } catch (e: any) {
        return { success: false as const, error: e.message };
    }
}

/** The catalogue as stored, grouped by tier, for the read-only hierarchy view. */
export async function getCatalogueAction() {
    try {
        await requireModuleRead("tenure");

        const { data: positions } = await db
            .from("leadership_positions")
            .select("id, slug, title, alias, description, tier, is_active, is_protected, grants_login")
            .order("title");

        const { data: privileges } = await db
            .from("position_privileges")
            .select("position_id, privilege, scope");

        const byPosition = new Map<string, { tag: string; scope: string | null }[]>();
        for (const p of privileges ?? []) {
            byPosition.set(p.position_id, [
                ...(byPosition.get(p.position_id) ?? []),
                { tag: p.privilege, scope: p.scope },
            ]);
        }

        const rows = (positions ?? []).map((p: any) => ({
            ...p,
            tier: (p.tier as PositionTier | null) ?? "EXECUTIVE",
            privileges: byPosition.get(p.id) ?? [],
        }));

        rows.sort((a, b) => {
            const tierDiff = TIER_ORDER[a.tier as PositionTier] - TIER_ORDER[b.tier as PositionTier];
            return tierDiff !== 0 ? tierDiff : a.title.localeCompare(b.title);
        });

        return { success: true as const, positions: rows };
    } catch (e: any) {
        return { success: false as const, error: e.message, positions: [] };
    }
}

// ============================================================================
// UNIT TRANSFERS (VP Admin)
// ============================================================================
//
// A member belongs to exactly one unit per tenure. When a second executive claims
// someone, the app queues a request rather than moving them (see addWorkerAction in
// the units module) and the VP Admin arbitrates. Until then the member does not move.

/** Pending (and recently decided) transfer requests for the active tenure. */
export async function listTransferRequestsAction(includeDecided = false) {
    try {
        await requireModuleRead("tenure");
        const { data: tenure } = await db
            .from("tenures").select("id").eq("is_active", true).maybeSingle();
        if (!tenure) return { success: true as const, data: [] };

        let q = db
            .from("unit_transfer_requests")
            .select(`
                id, status, requested_at, decided_at, decline_reason,
                member:profiles!unit_transfer_requests_profile_id_fkey(id, first_name, last_name, email),
                requester:profiles!unit_transfer_requests_requested_by_fkey(first_name, last_name),
                from_unit:units!unit_transfer_requests_from_unit_id_fkey(id, name),
                to_unit:units!unit_transfer_requests_to_unit_id_fkey(id, name)
            `)
            .eq("tenure_id", tenure.id)
            .order("requested_at", { ascending: false });

        if (!includeDecided) q = q.eq("status", "pending");

        const { data, error } = await q.limit(100);
        if (error) {
            // Migration 0011 not applied yet — an empty queue is a better failure than
            // a broken tab.
            return { success: false as const, error: "Transfer requests unavailable.", data: [] };
        }

        const one = (v: any) => (Array.isArray(v) ? v[0] : v);
        return {
            success: true as const,
            data: (data ?? []).map((r: any) => ({
                id: r.id,
                status: r.status,
                requestedAt: r.requested_at,
                decidedAt: r.decided_at,
                declineReason: r.decline_reason,
                member: one(r.member),
                requesterName: [one(r.requester)?.first_name, one(r.requester)?.last_name]
                    .filter(Boolean).join(" ") || "Unknown",
                fromUnit: one(r.from_unit),
                toUnit: one(r.to_unit),
            })),
        };
    } catch (e: any) {
        return { success: false as const, error: e.message, data: [] };
    }
}

/**
 * Approve a transfer — the member moves.
 *
 * Delegated to `rcf_approve_unit_transfer` so the delete-then-insert is ATOMIC.
 * Doing it as two calls from here would risk a member ending up in two units (or
 * none) if the second call failed, which is exactly what the single-unit rule exists
 * to prevent.
 */
export async function approveTransferAction(requestId: string) {
    try {
        const ctx = await requireVpAdmin();
        // Read before approving: the RPC moves the member, and the log needs to say
        // from where to where.
        const { data: request } = await db
            .from("unit_transfer_requests")
            .select("profile_id, tenure_id, from_unit_id, to_unit_id")
            .eq("id", requestId)
            .maybeSingle();

        const { error } = await db.rpc("rcf_approve_unit_transfer", {
            p_request_id: requestId,
            p_decided_by: ctx.profile.id,
        });
        if (error) return { success: false as const, error: error.message };

        if (request) {
            const base = { profileId: request.profile_id, tenureId: request.tenure_id };
            await logMembershipEvents(
                [
                    ...(request.from_unit_id
                        ? [{ ...base, unitId: request.from_unit_id, action: "transferred_out" as const }]
                        : []),
                    { ...base, unitId: request.to_unit_id, action: "transferred_in" as const },
                ],
                membershipActorOf(ctx),
            );
        }

        revalidatePath("/dashboard/tenure");
        revalidatePath("/dashboard/units");
        return { success: true as const };
    } catch (e: any) {
        return { success: false as const, error: e.message };
    }
}

/** Decline a transfer — the member stays where they are. */
export async function declineTransferAction(requestId: string, reason?: string) {
    try {
        const ctx = await requireVpAdmin();
        const { error } = await db
            .from("unit_transfer_requests")
            .update({
                status: "declined",
                decided_by: ctx.profile.id,
                decided_at: new Date().toISOString(),
                decline_reason: reason?.trim() || null,
            })
            .eq("id", requestId)
            .eq("status", "pending");
        if (error) return { success: false as const, error: error.message };

        revalidatePath("/dashboard/tenure");
        return { success: true as const };
    } catch (e: any) {
        return { success: false as const, error: e.message };
    }
}

// ============================================================================
// HANDOVER INTENTS
// ============================================================================
//
// A handover is long, deliberate and once a year, so it is recorded as an INTENT:
// resumable draft state while it runs, and a permanent record of what was decided once
// it lands. Successors read these to see what their predecessors actually did.
//
// Access is the write-bypass tier only — VP Admin and System Admin (requireVpAdmin).
// A handover is not something the wider tenure-write group should be able to start.

/** Snapshot of the acting person, so the trail survives their profile changing. */
function actorOf(ctx: ProfileContext) {
    return {
        id: ctx.profile.id,
        name: [ctx.profile.firstName, ctx.profile.lastName].filter(Boolean).join(" ") || null,
    };
}

/** Append one line to an intent's proceedings log. Never fails the caller. */
async function logHandoverEvent(
    intentId: string,
    ctx: ProfileContext,
    action: string,
    detail?: string | null,
) {
    const actor = actorOf(ctx);
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
 * Every handover attempt, newest first — the index page's whole content.
 *
 * Deliberately NOT filtered to the active tenure: the point is that an incoming
 * cabinet can read what previous ones did.
 */
export async function listHandoverIntentsAction() {
    try {
        await requireVpAdmin();

        const { data, error } = await db
            .from("handover_intents")
            .select(`
                id, status, step, from_tenure_id, from_tenure_name, from_tenure_session,
                to_tenure_id, initiated_by_name, completed_by_name, completed_at,
                abandoned_reason, created_at, updated_at, payload,
                to_tenure:tenures!handover_intents_to_tenure_id_fkey(session, theme)
            `)
            .order("created_at", { ascending: false })
            .limit(50);

        if (error) {
            // Migration 0012 not applied yet — say so plainly rather than crashing the page.
            return {
                success: false as const,
                error: "Handover history unavailable. Apply db/migrations/0012_handover_intents.sql.",
                data: [],
            };
        }

        const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
        return {
            success: true as const,
            data: (data ?? []).map((r: any) => {
                const to = one(r.to_tenure) as { session: string; theme: string | null } | null;
                return {
                    id: r.id,
                    status: r.status as "draft" | "in_progress" | "completed" | "abandoned",
                    step: r.step,
                    fromTenure: {
                        id: r.from_tenure_id,
                        // A snapshot taken when the handover began — what the closing
                        // tenure was called THEN, which a later coronation must not rewrite.
                        label: r.from_tenure_name as string | null,
                        session: r.from_tenure_session,
                    },
                    toTenure: r.to_tenure_id
                        ? { id: r.to_tenure_id, label: to ? tenureFullLabel(to) : null, session: to?.session ?? null }
                        : null,
                    // Handovers begun before tenures lost their names planned one; newer
                    // ones plan only a session (plannedSession).
                    legacyPlannedName: (r.payload?.name as string) || null,
                    plannedSession: (r.payload?.session as string) || null,
                    initiatedBy: r.initiated_by_name,
                    completedBy: r.completed_by_name,
                    completedAt: r.completed_at,
                    abandonedReason: r.abandoned_reason,
                    createdAt: r.created_at,
                    updatedAt: r.updated_at,
                };
            }),
        };
    } catch (e: any) {
        return { success: false as const, error: e.message, data: [] };
    }
}

/** One intent plus its proceedings, for resuming the wizard and for the detail view. */
export async function getHandoverIntentAction(intentId: string) {
    try {
        await requireVpAdmin();

        const { data: intent, error } = await db
            .from("handover_intents")
            .select("*")
            .eq("id", intentId)
            .maybeSingle();

        if (error || !intent) {
            return { success: false as const, error: "That handover record doesn't exist." };
        }

        const { data: events } = await db
            .from("handover_events")
            .select("id, action, detail, actor_name, created_at")
            .eq("intent_id", intentId)
            .order("created_at", { ascending: true });

        return {
            success: true as const,
            intent: {
                id: intent.id,
                status: intent.status,
                step: intent.step ?? 0,
                payload: (intent.payload ?? {}) as Record<string, unknown>,
                fromTenure: {
                    id: intent.from_tenure_id,
                    label: intent.from_tenure_name as string | null,
                    session: intent.from_tenure_session,
                },
                toTenureId: intent.to_tenure_id,
                initiatedBy: intent.initiated_by_name,
                completedBy: intent.completed_by_name,
                completedAt: intent.completed_at,
                abandonedReason: intent.abandoned_reason,
                createdAt: intent.created_at,
                updatedAt: intent.updated_at,
            },
            events: (events ?? []).map((e: any) => ({
                id: e.id,
                action: e.action,
                detail: e.detail,
                actorName: e.actor_name,
                createdAt: e.created_at,
            })),
        };
    } catch (e: any) {
        return { success: false as const, error: e.message };
    }
}

/**
 * Start a handover, or join the one already open.
 *
 * Returns the EXISTING open intent rather than erroring when someone else has already
 * started one for this tenure: two people running rival handovers of the same tenure is
 * the failure this prevents, and "you're now both on the same one" is far more useful
 * than "somebody else is doing this".
 */
export async function createHandoverIntentAction() {
    try {
        const ctx = await requireVpAdmin();

        const { data: tenure } = await db
            .from("tenures")
            .select("id, session, theme")
            .eq("is_active", true)
            .maybeSingle();

        if (!tenure) {
            return { success: false as const, error: "There is no active tenure to hand over." };
        }

        const { data: open } = await db
            .from("handover_intents")
            .select("id")
            .eq("from_tenure_id", tenure.id)
            .in("status", ["draft", "in_progress"])
            .maybeSingle();

        if (open) {
            return { success: true as const, intentId: open.id, joined: true };
        }

        const actor = actorOf(ctx);
        const { data: created, error } = await db
            .from("handover_intents")
            .insert({
                from_tenure_id: tenure.id,
                // Snapshot of what the tenure is called now; the column keeps its old
                // name, but what it holds is the label.
                from_tenure_name: tenureFullLabel(tenure),
                from_tenure_session: tenure.session,
                status: "draft",
                initiated_by: actor.id,
                initiated_by_name: actor.name,
            })
            .select("id")
            .single();

        if (error || !created) {
            return { success: false as const, error: error?.message || "Could not start the handover." };
        }

        await logHandoverEvent(
            intentIdOf(created),
            ctx,
            "started",
            `Began handing over ${tenureFullLabel(tenure)}.`,
        );

        revalidatePath("/dashboard/tenure/handover");
        return { success: true as const, intentId: created.id, joined: false };
    } catch (e: any) {
        return { success: false as const, error: e.message };
    }
}

function intentIdOf(row: { id: string }): string {
    return row.id;
}

/**
 * Save wizard progress so the handover survives a closed tab.
 *
 * Draft state ONLY — nothing here is trusted when the handover finally commits; that
 * action re-reads and re-validates everything from the database.
 */
export async function saveHandoverProgressAction(
    intentId: string,
    progress: { step: number; payload: Record<string, unknown>; note?: string },
) {
    try {
        const ctx = await requireVpAdmin();

        const { data: intent } = await db
            .from("handover_intents")
            .select("status, step")
            .eq("id", intentId)
            .maybeSingle();

        if (!intent) return { success: false as const, error: "That handover record doesn't exist." };
        if (intent.status === "completed" || intent.status === "abandoned") {
            return { success: false as const, error: `This handover is already ${intent.status}.` };
        }

        const { error } = await db
            .from("handover_intents")
            .update({
                step: Math.max(0, Math.min(progress.step, 10)),
                payload: progress.payload ?? {},
                status: "in_progress",
            })
            .eq("id", intentId);

        if (error) return { success: false as const, error: error.message };

        // Only log a step the wizard actually ADVANCED to. Autosaves on every keystroke
        // would bury the interesting lines in noise.
        if (progress.note && progress.step > (intent.step ?? 0)) {
            await logHandoverEvent(intentId, ctx, "step_completed", progress.note);
        }

        return { success: true as const };
    } catch (e: any) {
        return { success: false as const, error: e.message };
    }
}

/** Walk away from a handover without completing it, on the record. */
export async function abandonHandoverIntentAction(intentId: string, reason?: string) {
    try {
        const ctx = await requireVpAdmin();
        const actor = actorOf(ctx);

        const { error } = await db
            .from("handover_intents")
            .update({
                status: "abandoned",
                abandoned_reason: reason?.trim() || null,
                completed_by: actor.id,
                completed_by_name: actor.name,
            })
            .eq("id", intentId)
            .in("status", ["draft", "in_progress"]);

        if (error) return { success: false as const, error: error.message };

        await logHandoverEvent(
            intentId,
            ctx,
            "abandoned",
            reason?.trim() || "No reason given.",
        );

        revalidatePath("/dashboard/tenure/handover");
        return { success: true as const };
    } catch (e: any) {
        return { success: false as const, error: e.message };
    }
}

/**
 * The members of one generation, for the appointment flow's level step.
 *
 * Gated on `requireModuleWrite("tenure")` -- the same gate as `assignLeaderAction`,
 * because this list exists only to feed it. Deliberately NOT `getLevelMembersAction`
 * from the units module: that one gates on `canManageLevel`, which asks whether the
 * caller COORDINATES the level. A VP Admin appointing a Choir Exco coordinates no level
 * at all, and would be refused the list they need to do their job.
 *
 * Returns the whole generation in one response rather than paging: a level is ~20-30
 * members, so the roster is small enough to filter in the browser, and filtering in the
 * browser is what makes the search feel instant instead of costing a round-trip per
 * keystroke on a phone.
 */
export async function getGenerationRosterAction(classSetId: string) {
    try {
        await requireModuleWrite("tenure");
        if (!classSetId) return { success: false, error: "No generation given.", data: [] };

        const { data, error } = await db
            .from("profiles")
            .select("id, first_name, last_name, middle_name, email, phone_number, gender, department, matric_number, avatar_url")
            .eq("class_set_id", classSetId)
            .order("first_name");
        if (error) throw new Error(error.message);

        // Who in this generation already holds an office this tenure. Shown on the card
        // so an appointer sees they are about to give somebody a second office before
        // they do it, not after.
        const { data: tenure } = await db
            .from("tenures")
            .select("id")
            .eq("is_active", true)
            .maybeSingle();

        const held = new Map<string, string[]>();
        if (tenure?.id && (data ?? []).length > 0) {
            const { data: rows } = await db
                .from("leadership")
                .select("profile_id, is_lead, position:leadership_positions(title, alias)")
                .eq("tenure_id", tenure.id)
                .is("ended_at", null)
                .in("profile_id", (data ?? []).map((p: any) => p.id));

            for (const row of (rows ?? []) as any[]) {
                const position = Array.isArray(row.position) ? row.position[0] : row.position;
                const label = position?.alias || position?.title;
                if (!label) continue;
                const list = held.get(row.profile_id) ?? [];
                list.push(row.is_lead === false ? `${label} (assistant)` : label);
                held.set(row.profile_id, list);
            }
        }

        return {
            success: true,
            data: (data ?? []).map((p: any) => ({ ...p, offices: held.get(p.id) ?? [] })),
        };
    } catch (e: any) {
        return { success: false, error: e.message, data: [] };
    }
}

/**
 * Units and teams that have NO active Exco office yet.
 *
 * This is the only legitimate reason to mint an office at runtime: a unit created after
 * the catalogue was seeded has no Executive, and nothing else can give it one. Every
 * other office in the fellowship is fixed in src/config/leadership-positions.ts and held
 * there by the freeze trigger.
 *
 * Returning the eligible list (rather than letting the page offer every unit and fail
 * on submit) is what lets the page show an honest empty state when there is nothing to
 * create.
 */
export async function getUnitsWithoutExcoAction() {
    try {
        await requireVpAdmin();

        const [unitsRes, positionsRes] = await Promise.all([
            db.from("units").select("id, slug, name, type, description").order("name"),
            db.from("leadership_positions").select("slug, is_active"),
        ]);

        const taken = new Set(
            (positionsRes.data ?? [])
                .filter((p: any) => p.is_active !== false)
                .map((p: any) => p.slug),
        );

        return {
            success: true,
            data: (unitsRes.data ?? []).filter((u: any) => !taken.has(`exco-${u.slug}`)),
        };
    } catch (e: any) {
        return { success: false, error: e.message, data: [] };
    }
}

/**
 * Every office a member has ever held, newest tenure first.
 *
 * "Welfare Coordinator (2025/2026), Director of Commerce (2026/2027)" — a member's
 * service, which before migration 0014 was destroyed by the same click that ended the
 * appointment. Current and ended appointments both appear; `isCurrent` tells them apart,
 * because "she is the Welfare Coordinator" and "she was the Welfare Coordinator" are
 * different statements and a service record that blurs them is not much use.
 *
 * Read gate, not write: `requireModuleRead("tenure")`. Who has served is roster
 * information, not a secret — it is on the cabinet screen for the current tenure
 * already, and the past is no more sensitive than the present.
 */
/**
 * May this session read a member's service record?
 *
 * The Tenure module's readers may read anyone's. So may the people who already see the
 * member's full detail page: their level coordinator, and an Executive of a unit they
 * belong to this session. Without this the record silently vanished from both pages,
 * because neither a level coordinator nor an exco holds Tenure access.
 */
async function mayViewServiceHistory(ctx: ProfileContext, profileId: string): Promise<boolean> {
    if (canReadModule(ctx, "tenure", await getModuleAccessConfig())) return true;

    const { data: prof } = await db
        .from("profiles").select("class_set_id").eq("id", profileId).maybeSingle();
    if (prof?.class_set_id && (await canManageLevel(ctx, prof.class_set_id))) return true;

    const { data: tenure } = await db.from("tenures").select("id").eq("is_active", true).maybeSingle();
    if (!tenure) return false;
    for (const unitId of await unitIdsOfMember(profileId, tenure.id)) {
        if (await canManageUnit(ctx, unitId)) return true;
    }
    return false;
}

export async function getServiceHistoryAction(profileId: string) {
    try {
        const ctx = await requireContext();
        if (!profileId) return { success: false, error: "No member given.", data: [] };
        if (!(await mayViewServiceHistory(ctx, profileId))) {
            return { success: false, error: "You don't have access to this member.", data: [] };
        }

        const { data, error } = await db
            .from("leadership")
            .select(`
                id, is_lead, created_at, ended_at, ended_reason,
                position:leadership_positions(title, alias, slug, tier),
                tenure:tenures(id, session, theme, is_active, start_date),
                unit:units(name),
                class_set:class_sets(family_name, entry_year)
            `)
            .eq("profile_id", profileId);
        if (error) throw new Error(error.message);

        const one = (v: any) => (Array.isArray(v) ? v[0] : v);

        const rows = (data ?? []).map((r: any) => {
            const position = one(r.position);
            const tenure = one(r.tenure);
            return {
                id: r.id,
                title: position?.alias || position?.title || "Unknown office",
                fullTitle: position?.title ?? null,
                slug: position?.slug ?? null,
                tier: position?.tier ?? null,
                session: tenure?.session ?? null,
                tenureTheme: tenure?.theme ?? null,
                tenureStart: tenure?.start_date ?? null,
                isLead: r.is_lead !== false,
                isCurrent: r.ended_at == null && tenure?.is_active === true,
                endedAt: r.ended_at,
                endedReason: r.ended_reason,
                contextName: one(r.unit)?.name || one(r.class_set)?.family_name || null,
            };
        });

        // Newest session first. Sorting on the session string works because it starts
        // with the four-digit start year; falling back to the tenure's start date keeps
        // a malformed session from scrambling the order.
        rows.sort((a, b) => {
            const bySession = String(b.session ?? "").localeCompare(String(a.session ?? ""));
            if (bySession !== 0) return bySession;
            return String(b.tenureStart ?? "").localeCompare(String(a.tenureStart ?? ""));
        });

        return { success: true, data: rows };
    } catch (e: any) {
        return { success: false, error: e.message, data: [] };
    }
}
