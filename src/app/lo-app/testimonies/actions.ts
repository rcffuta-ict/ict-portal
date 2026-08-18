"use server";

import { revalidatePath } from "next/cache";
import { ictAdmin } from "@/lib/ict";
import { checkEnhancedAdminAccess } from "@/lib/access-control";
import { getLoMember, requireLoMember } from "@/lib/lo-member";
import {
    TESTIMONY_CATEGORIES,
    type Testimony,
    type TestimonyCategory,
    type TestimonyStatus,
} from "@/lib/testimonies";

/**
 * Testimonies are moderated BEFORE they go public, so these actions split cleanly:
 * public reads only ever see `approved` rows, the poster additionally sees their own,
 * and anything that changes a status is ADMIN-gated server-side.
 */

const PUBLIC_COLUMNS =
    "id, title, body, category, scripture_reference, author_profile_id, author_name, is_anonymous, event_id, status, review_note, published_at, share_count, created_at";

interface TestimonyRow {
    id: string;
    title: string;
    body: string;
    category: string;
    scripture_reference: string | null;
    author_profile_id: string | null;
    author_name: string;
    is_anonymous: boolean;
    event_id: string | null;
    status: string;
    review_note: string | null;
    published_at: string | null;
    share_count: number;
    created_at: string;
}

/**
 * Strip the poster's identity from anything leaving the server for a public feed.
 * An anonymous testimony must not carry the name OR the profile id — the id alone
 * would de-anonymise it against any other list of members.
 */
function toPublicTestimony(
    row: TestimonyRow,
    amenCount: number,
    viewerHasAmened: boolean,
    viewerProfileId: string | null,
    isModerator: boolean,
): Testimony {
    const isOwn = !!viewerProfileId && row.author_profile_id === viewerProfileId;
    const revealName = !row.is_anonymous || isOwn || isModerator;

    return {
        id: row.id,
        title: row.title,
        body: row.body,
        category: row.category as TestimonyCategory,
        scriptureReference: row.scripture_reference,
        authorName: revealName ? row.author_name : "Anonymous",
        isAnonymous: row.is_anonymous,
        isOwn,
        eventId: row.event_id,
        status: row.status as TestimonyStatus,
        reviewNote: isOwn || isModerator ? row.review_note : null,
        publishedAt: row.published_at,
        createdAt: row.created_at,
        shareCount: row.share_count,
        amenCount,
        viewerHasAmened,
    };
}

async function amenData(
    testimonyIds: string[],
    viewerProfileId: string | null,
): Promise<{ counts: Record<string, number>; mine: Set<string> }> {
    const counts: Record<string, number> = {};
    const mine = new Set<string>();

    if (testimonyIds.length === 0) return { counts, mine };

    const { data, error } = await ictAdmin.supabase
        .from("testimony_amens")
        .select("testimony_id, profile_id")
        .in("testimony_id", testimonyIds);

    if (error) {
        console.error("testimonies: failed to load amens", error);
        return { counts, mine };
    }

    for (const row of data || []) {
        const id = row.testimony_id as string;
        counts[id] = (counts[id] || 0) + 1;
        if (viewerProfileId && row.profile_id === viewerProfileId) mine.add(id);
    }

    return { counts, mine };
}

// ─── Reads ───

/**
 * The public feed: approved testimonies, newest first. When the viewer is a
 * recognised member, their own pending/rejected posts are folded in so they can see
 * what happened to what they submitted.
 */
export async function getTestimonies(options?: {
    category?: TestimonyCategory | "all";
    search?: string;
    limit?: number;
}) {
    try {
        const member = await getLoMember();
        const admin = await checkEnhancedAdminAccess();
        const viewerProfileId = member?.profileId || null;

        let query = ictAdmin.supabase
            .from("testimonies")
            .select(PUBLIC_COLUMNS)
            // Newest first by posting time, not publish time: a member's own pending
            // post must surface at the top of their feed, not sink below everything
            // already approved.
            .order("created_at", { ascending: false })
            .limit(options?.limit ?? 60);

        if (viewerProfileId) {
            // Approved for everyone, plus this member's own posts in any state.
            query = query.or(
                `status.eq.approved,author_profile_id.eq.${viewerProfileId}`,
            );
        } else {
            query = query.eq("status", "approved");
        }

        if (options?.category && options.category !== "all") {
            query = query.eq("category", options.category);
        }

        if (options?.search?.trim()) {
            const term = options.search.trim().replace(/[%,]/g, " ");
            query = query.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        const rows = (data || []) as TestimonyRow[];
        const { counts, mine } = await amenData(
            rows.map((r) => r.id),
            viewerProfileId,
        );

        return {
            success: true,
            data: rows.map((row) =>
                toPublicTestimony(
                    row,
                    counts[row.id] || 0,
                    mine.has(row.id),
                    viewerProfileId,
                    admin.isAdmin,
                ),
            ),
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load testimonies";
        console.error("testimonies: getTestimonies failed", error);
        return { success: false, error: message, data: [] as Testimony[] };
    }
}

/** A single testimony for its shareable page. Only approved rows are public. */
export async function getTestimonyById(id: string) {
    try {
        const member = await getLoMember();
        const admin = await checkEnhancedAdminAccess();
        const viewerProfileId = member?.profileId || null;

        const { data, error } = await ictAdmin.supabase
            .from("testimonies")
            .select(PUBLIC_COLUMNS)
            .eq("id", id)
            .maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) return { success: false, error: "Testimony not found", data: null };

        const row = data as TestimonyRow;
        const isOwn = !!viewerProfileId && row.author_profile_id === viewerProfileId;

        if (row.status !== "approved" && !isOwn && !admin.isAdmin) {
            return { success: false, error: "Testimony not found", data: null };
        }

        const { counts, mine } = await amenData([row.id], viewerProfileId);

        return {
            success: true,
            data: toPublicTestimony(
                row,
                counts[row.id] || 0,
                mine.has(row.id),
                viewerProfileId,
                admin.isAdmin,
            ),
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load testimony";
        return { success: false, error: message, data: null };
    }
}

/** The moderation queue — every testimony, any status. ADMIN only. */
export async function getTestimoniesForReview() {
    try {
        const admin = await checkEnhancedAdminAccess();
        if (!admin.isAdmin) {
            return { success: false, error: "Unauthorized", data: [] as Testimony[] };
        }

        const { data, error } = await ictAdmin.supabase
            .from("testimonies")
            .select(PUBLIC_COLUMNS)
            // Newest first; the queue defaults to the "pending" filter on top of this.
            .order("created_at", { ascending: false })
            .limit(200);

        if (error) throw new Error(error.message);

        const rows = (data || []) as TestimonyRow[];
        const { counts, mine } = await amenData(rows.map((r) => r.id), null);

        return {
            success: true,
            data: rows.map((row) =>
                toPublicTestimony(row, counts[row.id] || 0, mine.has(row.id), null, true),
            ),
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load queue";
        return { success: false, error: message, data: [] as Testimony[] };
    }
}

// ─── Writes ───

export async function submitTestimony(input: {
    title: string;
    body: string;
    category: string;
    scriptureReference?: string;
    eventId?: string | null;
    isAnonymous?: boolean;
}) {
    try {
        // Members only — enforced here, not just by hiding the composer.
        const member = await requireLoMember();

        const title = input.title.trim();
        const body = input.body.trim();

        if (title.length < 3 || title.length > 120) {
            return { success: false, error: "Give your testimony a short title (3-120 characters)." };
        }
        if (body.length < 20 || body.length > 5000) {
            return { success: false, error: "Tell us a little more — at least 20 characters." };
        }

        const category = TESTIMONY_CATEGORIES.some((c) => c.id === input.category)
            ? input.category
            : "other";

        const { data, error } = await ictAdmin.supabase
            .from("testimonies")
            .insert({
                title,
                body,
                category,
                scripture_reference: input.scriptureReference?.trim() || null,
                author_profile_id: member.profileId,
                author_name: member.fullName,
                is_anonymous: !!input.isAnonymous,
                event_id: input.eventId || null,
                status: "pending",
            })
            .select("id")
            .single();

        if (error) throw new Error(error.message);

        return { success: true, data: { id: data.id as string } };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to post testimony";
        return { success: false, error: message };
    }
}

/** Say (or take back) Amen. Members only, one per member per testimony. */
export async function toggleAmen(testimonyId: string) {
    try {
        const member = await requireLoMember();

        const { data: existing } = await ictAdmin.supabase
            .from("testimony_amens")
            .select("id")
            .eq("testimony_id", testimonyId)
            .eq("profile_id", member.profileId)
            .maybeSingle();

        if (existing) {
            const { error } = await ictAdmin.supabase
                .from("testimony_amens")
                .delete()
                .eq("id", existing.id);
            if (error) throw new Error(error.message);
            return { success: true, amened: false };
        }

        const { error } = await ictAdmin.supabase
            .from("testimony_amens")
            .insert({ testimony_id: testimonyId, profile_id: member.profileId });

        if (error) throw new Error(error.message);
        return { success: true, amened: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to record Amen";
        return { success: false, error: message };
    }
}

/**
 * Count a share. Open to anyone — the whole point is that a testimony travels
 * beyond the fellowship — and the DB function only counts approved rows.
 */
export async function recordTestimonyShare(testimonyId: string) {
    try {
        const { error } = await ictAdmin.supabase.rpc("increment_testimony_share", {
            p_testimony_id: testimonyId,
        });
        if (error) throw new Error(error.message);
        return { success: true };
    } catch (error) {
        // A missed share count is not worth showing the user an error for.
        console.error("testimonies: failed to record share", error);
        return { success: false };
    }
}

// ─── Moderation (ADMIN only) ───

export async function moderateTestimony(
    testimonyId: string,
    action: "approve" | "reject" | "hide" | "restore",
    note?: string,
) {
    try {
        const admin = await checkEnhancedAdminAccess();
        if (!admin.isAdmin || !admin.user) {
            return { success: false, error: "Unauthorized: Admin access required" };
        }

        const now = new Date().toISOString();
        const status: TestimonyStatus =
            action === "approve"
                ? "approved"
                : action === "reject"
                    ? "rejected"
                    : action === "hide"
                        ? "hidden"
                        : "approved";

        const update: Record<string, unknown> = {
            status,
            reviewed_by_profile_id: admin.user.id,
            reviewed_at: now,
            review_note: note?.trim() || null,
        };

        // published_at is set the first time it goes public and then left alone, so
        // the feed's ordering doesn't jump when a post is hidden and restored.
        if (status === "approved") {
            const { data: current } = await ictAdmin.supabase
                .from("testimonies")
                .select("published_at")
                .eq("id", testimonyId)
                .maybeSingle();

            if (!current?.published_at) update.published_at = now;
        }

        const { error } = await ictAdmin.supabase
            .from("testimonies")
            .update(update)
            .eq("id", testimonyId);

        if (error) throw new Error(error.message);

        revalidatePath("/lo-app");
        revalidatePath(`/lo-app/testimonies/${testimonyId}`);

        return { success: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Moderation failed";
        return { success: false, error: message };
    }
}
