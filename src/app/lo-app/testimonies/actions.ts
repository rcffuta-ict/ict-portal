"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getLoAccess } from "@/lib/lo-admin";
import { getLoMember, requireLoMember } from "@/lib/lo-member";
import {
    REVIEW_PAGE_SIZE,
    TESTIMONY_CATEGORIES,
    TESTIMONY_PAGE_SIZE,
    testimonyEditSchema,
    type Testimony,
    type TestimonyCategory,
    type TestimonyEdit,
    type TestimonyStatus,
} from "@/lib/testimonies";

/**
 * Testimonies are moderated BEFORE they go public, so these actions split cleanly:
 * public reads only ever see `approved` rows, the poster additionally sees their own,
 * and anything that changes a status or the text is gated by `getLoAccess()` — the
 * portal's admin write tier or an appointed Lo! admin (see src/lib/lo-admin.ts).
 */

const PUBLIC_COLUMNS =
    "id, title, body, category, scripture_reference, author_profile_id, author_name, is_anonymous, event_id, status, review_note, published_at, share_count, created_at, is_featured, edited_at";

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
    is_featured: boolean;
    edited_at: string | null;
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
        isFeatured: row.is_featured,
        // Only the author and moderators are told a moderator touched the text.
        editedAt: isOwn || isModerator ? row.edited_at : null,
    };
}

async function amenData(
    testimonyIds: string[],
    viewerProfileId: string | null,
): Promise<{ counts: Record<string, number>; mine: Set<string> }> {
    const counts: Record<string, number> = {};
    const mine = new Set<string>();

    if (testimonyIds.length === 0) return { counts, mine };

    const { data, error } = await db
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

/** Rows → client shape, with Amen data, for one viewer. */
async function present(
    rows: TestimonyRow[],
    viewerProfileId: string | null,
    isModerator: boolean,
): Promise<Testimony[]> {
    const { counts, mine } = await amenData(rows.map((r) => r.id), viewerProfileId);
    return rows.map((row) =>
        toPublicTestimony(row, counts[row.id] || 0, mine.has(row.id), viewerProfileId, isModerator),
    );
}

/** A PostgREST `or()` term can't contain its own syntax; keep a search to plain words. */
function cleanSearch(term?: string): string {
    return (term || "").replace(/[%,()*:\\]/g, " ").replace(/\s+/g, " ").trim();
}

function isCategory(value: unknown): value is TestimonyCategory {
    return TESTIMONY_CATEGORIES.some((c) => c.id === value);
}

// ─── Reads ───

/**
 * One page of the public feed: approved testimonies, newest first. When the viewer
 * is a recognised member, their own pending/rejected posts are folded in so they can
 * see what happened to what they submitted.
 *
 * Paged by a `before` cursor (the last card's `createdAt`) rather than an offset, so a
 * testimony approved while someone is reading doesn't shift the next page by one.
 */
export async function getTestimonies(options?: {
    category?: TestimonyCategory | "all";
    search?: string;
    before?: string | null;
}) {
    try {
        const [member, access] = await Promise.all([getLoMember(), getLoAccess()]);
        const viewerProfileId = member?.profileId || null;

        let query = db
            .from("testimonies")
            .select(PUBLIC_COLUMNS)
            // Newest first by posting time, not publish time: a member's own pending
            // post must surface at the top of their feed, not sink below everything
            // already approved.
            .order("created_at", { ascending: false })
            // One extra row tells us whether there is another page.
            .limit(TESTIMONY_PAGE_SIZE + 1);

        if (viewerProfileId) {
            query = query.or(`status.eq.approved,author_profile_id.eq.${viewerProfileId}`);
        } else {
            query = query.eq("status", "approved");
        }

        if (options?.category && options.category !== "all" && isCategory(options.category)) {
            query = query.eq("category", options.category);
        }

        const term = cleanSearch(options?.search);
        if (term) query = query.or(`title.ilike.%${term}%,body.ilike.%${term}%`);

        if (options?.before) query = query.lt("created_at", options.before);

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        const rows = (data || []) as TestimonyRow[];
        const hasMore = rows.length > TESTIMONY_PAGE_SIZE;
        const page = rows.slice(0, TESTIMONY_PAGE_SIZE);

        return {
            success: true,
            data: await present(page, viewerProfileId, access.canRead),
            hasMore,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load testimonies";
        console.error("testimonies: getTestimonies failed", error);
        return { success: false, error: message, data: [] as Testimony[], hasMore: false };
    }
}

/** The pinned testimony, if a moderator has featured one. Approved only, by the DB. */
export async function getFeaturedTestimony() {
    try {
        const [member, access] = await Promise.all([getLoMember(), getLoAccess()]);
        const viewerProfileId = member?.profileId || null;

        const { data, error } = await db
            .from("testimonies")
            .select(PUBLIC_COLUMNS)
            .eq("status", "approved")
            .eq("is_featured", true)
            .order("featured_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) return { success: true, data: null };

        const [testimony] = await present([data as TestimonyRow], viewerProfileId, access.canRead);
        return { success: true, data: testimony };
    } catch (error) {
        console.error("testimonies: getFeaturedTestimony failed", error);
        return { success: false, data: null };
    }
}

/**
 * Published testimonies per category, for the chips. Only `category` is read, so this
 * stays a few bytes per testimony; the partial index covers it.
 */
export async function getTestimonyCategoryCounts() {
    try {
        const { data, error } = await db
            .from("testimonies")
            .select("category")
            .eq("status", "approved");

        if (error) throw new Error(error.message);

        const counts: Record<string, number> = {};
        for (const row of data || []) {
            counts[row.category as string] = (counts[row.category as string] || 0) + 1;
        }
        return { success: true, data: counts, total: (data || []).length };
    } catch (error) {
        console.error("testimonies: category counts failed", error);
        return { success: false, data: {} as Record<string, number>, total: 0 };
    }
}

/** A single testimony for its shareable page. Only approved rows are public. */
export async function getTestimonyById(id: string) {
    try {
        const [member, access] = await Promise.all([getLoMember(), getLoAccess()]);
        const viewerProfileId = member?.profileId || null;

        const { data, error } = await db
            .from("testimonies")
            .select(PUBLIC_COLUMNS)
            .eq("id", id)
            .maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) return { success: false, error: "Testimony not found", data: null };

        const row = data as TestimonyRow;
        const isOwn = !!viewerProfileId && row.author_profile_id === viewerProfileId;

        if (row.status !== "approved" && !isOwn && !access.canRead) {
            return { success: false, error: "Testimony not found", data: null };
        }

        const [testimony] = await present([row], viewerProfileId, access.canRead);
        return { success: true, data: testimony };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load testimony";
        return { success: false, error: message, data: null };
    }
}

/**
 * For the share-card image. Deliberately ignores who is asking: a crawler fetches the
 * image with no cookies, and a card must never show more than the public page would —
 * so anything not approved returns null and gets the generic image.
 */
export async function getPublicTestimonyForCard(id: string) {
    const { data, error } = await db
        .from("testimonies")
        .select("title, body, category, scripture_reference, author_name, is_anonymous, status")
        .eq("id", id)
        .eq("status", "approved")
        .maybeSingle();

    if (error || !data) return null;
    return {
        title: data.title as string,
        body: data.body as string,
        category: data.category as string,
        scriptureReference: (data.scripture_reference as string | null) ?? null,
        authorName: data.is_anonymous ? "Anonymous" : (data.author_name as string),
    };
}

/** Up to three other published testimonies in the same category, newest first. */
export async function getRelatedTestimonies(id: string, category: string) {
    try {
        if (!isCategory(category)) return { success: true, data: [] as Testimony[] };

        const { data, error } = await db
            .from("testimonies")
            .select(PUBLIC_COLUMNS)
            .eq("status", "approved")
            .eq("category", category)
            .neq("id", id)
            .order("published_at", { ascending: false })
            .limit(3);

        if (error) throw new Error(error.message);
        // Related cards show no Amen state and no private fields: viewer-less on purpose.
        return { success: true, data: await present((data || []) as TestimonyRow[], null, false) };
    } catch (error) {
        console.error("testimonies: related failed", error);
        return { success: false, data: [] as Testimony[] };
    }
}

/** How many are waiting for review — the badge on the moderation tab. */
export async function getPendingTestimonyCount() {
    const access = await getLoAccess();
    if (!access.canRead) return { success: false, count: 0 };

    const { count, error } = await db
        .from("testimonies")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

    if (error) {
        console.error("testimonies: pending count failed", error);
        return { success: false, count: 0 };
    }
    return { success: true, count: count ?? 0 };
}

export type ReviewFilter = TestimonyStatus | "featured" | "all";

/**
 * One page of the moderation queue. Filtered on the server now — the old queue loaded
 * up to 200 rows of every status and filtered in the browser, which was both a heavy
 * download on a phone and a silent cap once the fellowship had posted more than that.
 */
export async function getTestimoniesForReview(options?: {
    filter?: ReviewFilter;
    before?: string | null;
}) {
    try {
        const access = await getLoAccess();
        if (!access.canRead) {
            return {
                success: false,
                error: "Unauthorized",
                data: [] as Testimony[],
                hasMore: false,
                canModerate: false,
            };
        }

        let query = db
            .from("testimonies")
            .select(PUBLIC_COLUMNS)
            .order("created_at", { ascending: false })
            .limit(REVIEW_PAGE_SIZE + 1);

        const filter = options?.filter ?? "pending";
        if (filter === "featured") query = query.eq("is_featured", true);
        else if (filter !== "all") query = query.eq("status", filter);

        if (options?.before) query = query.lt("created_at", options.before);

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        const rows = (data || []) as TestimonyRow[];
        return {
            success: true,
            data: await present(rows.slice(0, REVIEW_PAGE_SIZE), null, true),
            hasMore: rows.length > REVIEW_PAGE_SIZE,
            canModerate: access.canModerate,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load queue";
        return { success: false, error: message, data: [] as Testimony[], hasMore: false, canModerate: false };
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

        const category = isCategory(input.category) ? input.category : "other";

        const { data, error } = await db
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

        const { data: existing } = await db
            .from("testimony_amens")
            .select("id")
            .eq("testimony_id", testimonyId)
            .eq("profile_id", member.profileId)
            .maybeSingle();

        if (existing) {
            const { error } = await db
                .from("testimony_amens")
                .delete()
                .eq("id", existing.id);
            if (error) throw new Error(error.message);
            return { success: true, amened: false };
        }

        const { error } = await db
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
        const { error } = await db.rpc("increment_testimony_share", {
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

// ─── Moderation (Lo! admins and the portal's admin write tier) ───

async function requireModerator() {
    const access = await getLoAccess();
    if (!access.canModerate || !access.profileId) {
        throw new Error("Only Lo! admins can do that.");
    }
    return access;
}

function revalidateTestimony(id: string) {
    revalidatePath("/lo-app");
    revalidatePath("/lo-app/testimonies");
    revalidatePath(`/lo-app/testimonies/${id}`);
}

export async function moderateTestimony(
    testimonyId: string,
    action: "approve" | "reject" | "hide" | "restore",
    note?: string,
) {
    try {
        const access = await requireModerator();

        const now = new Date().toISOString();
        const status: TestimonyStatus =
            action === "approve" || action === "restore"
                ? "approved"
                : action === "reject"
                    ? "rejected"
                    : "hidden";

        const update: Record<string, unknown> = {
            status,
            reviewed_by_profile_id: access.profileId,
            reviewed_at: now,
            review_note: note?.trim() || null,
            updated_at: now,
        };

        // Off the feed means off the top of it too (the DB enforces this as well).
        if (status !== "approved") {
            update.is_featured = false;
            update.featured_at = null;
        }

        // published_at is set the first time it goes public and then left alone, so
        // the feed's ordering doesn't jump when a post is hidden and restored.
        if (status === "approved") {
            const { data: current } = await db
                .from("testimonies")
                .select("published_at")
                .eq("id", testimonyId)
                .maybeSingle();

            if (!current?.published_at) update.published_at = now;
        }

        const { error } = await db
            .from("testimonies")
            .update(update)
            .eq("id", testimonyId);

        if (error) throw new Error(error.message);

        revalidateTestimony(testimonyId);
        return { success: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Moderation failed";
        return { success: false, error: message };
    }
}

/**
 * Correct a testimony's text before (or after) it is published — a typo, a missing
 * word, a better category. Validated with the same schema as the edit form, and
 * stamped so the author is told a moderator changed it.
 */
export async function editTestimonyAction(testimonyId: string, input: TestimonyEdit) {
    try {
        const access = await requireModerator();

        const parsed = testimonyEditSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Check the fields." };
        }

        const now = new Date().toISOString();
        const { error } = await db
            .from("testimonies")
            .update({
                title: parsed.data.title,
                body: parsed.data.body,
                category: parsed.data.category,
                scripture_reference: parsed.data.scriptureReference || null,
                edited_at: now,
                edited_by_profile_id: access.profileId,
                updated_at: now,
            })
            .eq("id", testimonyId);

        if (error) throw new Error(error.message);

        revalidateTestimony(testimonyId);
        return { success: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Couldn't save the edit";
        return { success: false, error: message };
    }
}

/**
 * Pin a published testimony to the top of the feed, or unpin it. One at a time:
 * featuring a testimony unfeatures whichever was featured before, so "Featured" always
 * means one clear thing.
 */
export async function setTestimonyFeatured(testimonyId: string, featured: boolean) {
    try {
        await requireModerator();
        const now = new Date().toISOString();

        if (featured) {
            const { data: current, error: readError } = await db
                .from("testimonies")
                .select("status")
                .eq("id", testimonyId)
                .maybeSingle();
            if (readError) throw new Error(readError.message);
            if (current?.status !== "approved") {
                return { success: false, error: "Publish a testimony before featuring it." };
            }

            const { error: clearError } = await db
                .from("testimonies")
                .update({ is_featured: false, featured_at: null })
                .eq("is_featured", true)
                .neq("id", testimonyId);
            if (clearError) throw new Error(clearError.message);
        }

        const { error } = await db
            .from("testimonies")
            .update({ is_featured: featured, featured_at: featured ? now : null, updated_at: now })
            .eq("id", testimonyId);
        if (error) throw new Error(error.message);

        revalidateTestimony(testimonyId);
        return { success: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Couldn't change the feature";
        return { success: false, error: message };
    }
}
