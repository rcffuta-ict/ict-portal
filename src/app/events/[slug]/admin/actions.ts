'use server'

import { db } from "@/lib/db";
import { requireAccess } from "@/lib/access-control";
import * as qa from "@/lib/qa";
import { compareLevels, getRegistrationConfig, levelLabel } from "@/lib/event-utils";


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
    registrants: Record<string, unknown>[];
}

interface Registration {
    id: string;
    gender: string | null;
    level: string | null;
    is_rcf_member: boolean | null;
    created_at: string;
    [key: string]: unknown;
}

/**
 * Registrant data is personal (emails, phone numbers), so this action enforces
 * ADMIN itself — the client-side `isProfileAdmin` check in the page only decides
 * what to render and is not an authorization boundary.
 */
export async function getEventAdminStats(slug: string): Promise<EventAdminStats | null> {
    await requireAccess("ADMIN");

    const { data: event } = await db
        .from('events')
        .select('*')
        .eq('slug', slug)
        .single();

    if (!event) return null;

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

    const genderOf = (r: Registration) => (r.gender || "").toLowerCase();
    const genderBreakdown = {
        male: registrations.filter((r) => genderOf(r) === 'male').length,
        female: registrations.filter((r) => genderOf(r) === 'female').length,
        other: registrations.filter(
            (r) => genderOf(r) !== 'male' && genderOf(r) !== 'female'
        ).length,
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
        registrants: registrations.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
    };
}

export async function getEventQuestions(eventId: string) {
    try {
        await requireAccess("ADMIN");

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
