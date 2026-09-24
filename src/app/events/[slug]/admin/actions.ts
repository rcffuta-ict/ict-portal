'use server'

import { db } from "@/lib/db";
import { eventAccessFor, type EventAccess } from "@/lib/event-access";
import * as qa from "@/lib/qa";
import { compareLevels, getRegistrationConfig, levelLabel } from "@/lib/event-utils";
import { tallyGender } from "@/lib/gender";


export interface LevelStat {
    /** Raw stored value, e.g. "200L" / "Alumni". */
    level: string;
    /** Display label, e.g. "200 Level". */
    label: string;
    count: number;
    members: number;
    guests: number;
    /** Share of total registrations, 0-100. */
    percentage: number;
}

export interface EventAdminStats {
    event: Record<string, unknown>;
    totalRegistered: number;
    genderBreakdown: { male: number; female: number; other: number };
    levelStats: LevelStat[];
    /** True when the registration form actually asks for level. */
    collectsLevel: boolean;
    rcfMembers: number;
    guests: number;
    checkedIn: number;
    registrants: Record<string, unknown>[];
    /** What this viewer may do here — the console hides what they can't use. */
    access: EventAccess;
}

interface Registration {
    id: string;
    gender: string | null;
    level: string | null;
    is_rcf_member: boolean | null;
    checked_in_at?: string | null;
    created_at: string;
    [key: string]: unknown;
}

/**
 * Registrant data is personal (emails, phone numbers), so this action decides access
 * itself (eventAccessFor): the System Admin, the VPs, the President and the assigned
 * unit's leadership. Returns null when the event doesn't exist OR the viewer may not
 * see it — the page shows the same "not available" either way, so the response doesn't
 * reveal which events exist.
 */
export async function getEventAdminStats(slug: string): Promise<EventAdminStats | null> {
    const { data: event } = await db
        .from('events')
        .select('*')
        .eq('slug', slug)
        .single();

    if (!event) return null;
    const { read, write, manage } = await eventAccessFor(event.config);
    if (!read) return null;

    const { data: regs, error } = await db
        .from('event_registrations')
        .select('*')
        .eq('event_id', event.id);

    if (error) {
        console.error("Error fetching registrations:", error);
        return null;
    }

    const registrations = (regs || []) as Registration[];
    const total = registrations.length;

    // `event_registrations.gender` has no check constraint, so this column really can
    // hold "M", "Brother" or anything else a form or an import put there. tallyGender
    // applies the same aliases everything else uses, so those land under male/female
    // instead of being swept into "other" and counted as unrecorded.
    const split = tallyGender(registrations, (r) => r.gender);
    const genderBreakdown = {
        male: split.male,
        female: split.female,
        other: split.unspecified,
    };

    // Level breakdown, split by member vs guest so the team can size logistics.
    const buckets = new Map<string, { count: number; members: number; guests: number }>();
    registrations.forEach((r) => {
        const key = r.level?.trim() || "Unspecified";
        const bucket = buckets.get(key) || { count: 0, members: 0, guests: 0 };
        bucket.count += 1;
        if (r.is_rcf_member) bucket.members += 1;
        else bucket.guests += 1;
        buckets.set(key, bucket);
    });

    const levelStats: LevelStat[] = Array.from(buckets.entries())
        .map(([level, bucket]) => ({
            level,
            label: level === "Unspecified" ? "Unspecified" : levelLabel(level),
            count: bucket.count,
            members: bucket.members,
            guests: bucket.guests,
            percentage: total ? Math.round((bucket.count / total) * 100) : 0,
        }))
        .sort((a, b) => compareLevels(a.level, b.level));

    const rcfMembers = registrations.filter((r) => r.is_rcf_member).length;

    return {
        event,
        totalRegistered: total,
        genderBreakdown,
        levelStats,
        collectsLevel: getRegistrationConfig(event.config).fields.includes("level"),
        rcfMembers,
        guests: total - rcfMembers,
        checkedIn: registrations.filter((r) => !!r.checked_in_at).length,
        access: { read, write, manage },
        registrants: registrations.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
    };
}

export async function getEventQuestions(eventId: string) {
    try {
        const { data: event } = await db.from("events").select("config").eq("id", eventId).maybeSingle();
        if (!event || !(await eventAccessFor(event.config)).read) {
            return { success: false, error: "You don't have access to this event." };
        }

        const response = await qa.getEventQuestions(eventId, {
            status: ["visible", "answered", "flagged", "hidden"],
        });
        if (response.error) throw new Error(response.error);
        return { success: true, data: response.data };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load questions";
        return { success: false, error: message };
    }
}

/**
 * Check one registration in — from a scanned ticket (the QR on the registration
 * confirmation holds the registration id) or from the manual list at the door.
 *
 * The ticket must belong to THIS event: a ticket from another event scanned at this
 * door is refused, not quietly checked in elsewhere. A second check-in is refused
 * too — that is what makes a ticket single-use, and the steward needs "already used"
 * to be loud.
 *
 * Write access to THIS event only (eventAccessFor): the System Admin, the VPs and the
 * assigned unit's leadership — never the President, who views.
 */
export async function checkInAttendeeAction(eventId: string, registrationId: string) {
    try {
        const { data: event } = await db.from("events").select("config").eq("id", eventId).maybeSingle();
        if (!event || !(await eventAccessFor(event.config)).write) {
            return { success: false as const, error: "You can't check people in for this event." };
        }
        const id = (registrationId || "").trim();
        if (!/^[0-9a-f-]{36}$/i.test(id)) {
            return { success: false as const, error: "That isn't a ticket from this portal." };
        }
        const { data: reg, error } = await db
            .from("event_registrations")
            .select("id, event_id, first_name, last_name, level, checked_in_at")
            .eq("id", id)
            .maybeSingle();
        if (error) throw new Error(error.message);
        if (!reg) return { success: false as const, error: "Ticket not found." };
        if (reg.event_id !== eventId) {
            return { success: false as const, error: "This ticket is for a different event." };
        }
        const fullName = `${reg.first_name} ${reg.last_name}`.trim();
        if (reg.checked_in_at) {
            return { success: false as const, error: `${fullName} is already checked in.`, alreadyAt: reg.checked_in_at as string };
        }

        const checkedInAt = new Date().toISOString();
        // `.is(checked_in_at, null)` makes the update itself the guard: two stewards
        // scanning the same ticket at once cannot both succeed.
        const { data: updated, error: updateError } = await db
            .from("event_registrations")
            .update({ checked_in_at: checkedInAt })
            .eq("id", id)
            .is("checked_in_at", null)
            .select("id");
        if (updateError) throw new Error(updateError.message);
        if (!updated?.length) return { success: false as const, error: `${fullName} is already checked in.` };

        return {
            success: true as const,
            registrationId: id,
            fullName,
            level: (reg.level as string | null) ?? null,
            checkedInAt,
        };
    } catch (e: unknown) {
        return { success: false as const, error: e instanceof Error ? e.message : "Check-in failed." };
    }
}
