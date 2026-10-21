"use server";

import { getLoAccess } from "@/lib/lo-admin";
import { validateSession } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { getProfileContext } from "@/lib/auth/profile-context";
import * as qa from "@/lib/qa";
import type { CreateQuestionInput } from "@/lib/qa";
import {
    forgetLoMemberLink,
    getLoMember,
    verifyAndLinkMember,
    type LoMember,
} from "@/lib/lo-member";

// ─── Events ───

export async function getActiveEvents() {
    try {
        const { data: events, error } = await db
            .from("events")
            .select("id, title, slug, description, date, is_active, created_at, is_recurring, is_exclusive")
            // .or(`date.gte.${new Date().toISOString()},is_recurring.eq.true`)
            // .eq('is_active', true)
            .order('is_recurring', { ascending: true })
            .order('date', { ascending: true });

        if (error) throw new Error(error.message);
        return { success: true, data: events };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ─── Questions ───

const PUBLIC_QUESTION_STATUSES: string[] = ["visible", "answered"];

export async function getQuestions(options?: {
    eventId?: string;
    status?: string[];
    search_term?: string;
}) {
    try {
        // The status list comes from the browser, so it is trimmed here: hidden and
        // flagged questions are for Lo! moderators only, whatever the caller asks for.
        const access = await getLoAccess();
        const allowed = access.canRead ? null : PUBLIC_QUESTION_STATUSES;
        const requested = options?.status ?? (allowed ? [...allowed] : undefined);
        const status = allowed ? requested?.filter((s) => allowed.includes(s)) : requested;
        // Asked only for statuses this viewer may not see: nothing, rather than an
        // empty filter that a lower layer might read as "no filter".
        if (status && status.length === 0) return { success: true, data: [] };
        options = { ...options, status };

        if (options?.eventId) {
            const response = await qa.getEventQuestions(options.eventId, {
                status: options.status as any,
                search_term: options.search_term,
            });
            if (response.error) throw new Error(response.error);
            return { success: true, data: response.data };
        } else {
            const response = await qa.searchQuestions<Record<string, unknown>>({
                search_term: options?.search_term || "",
            });
            if (response.error) throw new Error(response.error);

            let data = response.data;
            if (options?.status) {
                data = data.filter((q: any) => status?.includes(q.status));
            }
            return { success: true, data };
        }
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function askQuestion(data: {
    event_id: string;
    question_text: string;
    scripture_reference?: string;
    asker_name?: string;
    asker_id?: string;
}) {
    try {
        const payload: CreateQuestionInput = {
            event_id: data.event_id,
            question_text: data.question_text,
            scripture_reference: data.scripture_reference,
            asked_by_profile_id: data.asker_id,
            asker_name: data.asker_name

        };

        // Try to auto-link authenticated user's profile
        try {
            const { valid, user } = await validateSession();
            if (valid && user) {
                const fullProfile = await getProfileContext(user.id);
                if (fullProfile) {
                    payload.asked_by_profile_id = fullProfile.profile.id;
                    payload.asker_name = `${fullProfile.profile.firstName} ${fullProfile.profile.lastName}`;
                } else {
                    payload.asker_name = data.asker_name || user.email?.split("@")[0] || "Anonymous";
                }
            } else {
                payload.asker_name = data.asker_name || "Anonymous";
            }
        } catch {
            payload.asker_name = data.asker_name || "Anonymous";
        }

        const response = await qa.createQuestion(payload);

        if (response.error) throw new Error(response.error);
        return { success: true, data: response.data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function answerQuestion(questionId: string, answerText: string) {
    try {
        const access = await getLoAccess();
        if (!access.canModerate || !access.profileId) {
            return { success: false, error: "Only Lo! admins can answer questions." };
        }

        const response = await qa.answerQuestion(
            questionId,
            answerText,
            access.profileId
        );

        if (response.error) throw new Error(response.error);
        return { success: true, data: response.data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function toggleVisibility(
    questionId: string,
    status: "visible" | "hidden" | "answered"
) {
    try {
        const access = await getLoAccess();
        if (!access.canModerate) {
            return { success: false, error: "Only Lo! admins can do that." };
        }

        const response = await qa.toggleQuestionVisibility({
            question_id: questionId,
            new_status: status,
        });

        if (response.error) throw new Error(response.error);
        return { success: true, data: response };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ─── Stars ───

export async function getStarCounts(questionIds: string[]) {
    try {
        if (questionIds.length === 0) return { success: true, data: {} };

        const { data, error } = await db
            .from("question_stars")
            .select("question_id")
            .in("question_id", questionIds);

        if (error) throw new Error(error.message);

        // Count stars per question
        const counts: Record<string, number> = {};
        for (const row of data || []) {
            counts[row.question_id] = (counts[row.question_id] || 0) + 1;
        }
        return { success: true, data: counts };
    } catch (error: any) {
        return { success: false, error: error.message, data: {} };
    }
}

export async function getUserStars(questionIds: string[], profileId: string="") {
    try {
        if (questionIds.length === 0 || !profileId) return { success: true, data: [] };

        const { data, error } = await db
            .from("question_stars")
            .select("question_id")
            .eq("profile_id", profileId)
            .in("question_id", questionIds);

        if (error) throw new Error(error.message);
        return { success: true, data: (data || []).map((r) => r.question_id) };
    } catch (error: any) {
        return { success: false, error: error.message, data: [] };
    }
}

export async function toggleStar(questionId: string, profileId: string) {
    try {
        // const { valid, user } = await validateSession();
        if (!profileId) {
            return { success: false, error: "Sign in to star questions" };
        }

        // Check if already starred
        const { data: existing } = await db
            .from("question_stars")
            .select("id")
            .eq("question_id", questionId)
            .eq("profile_id", profileId)
            .maybeSingle();

        if (existing) {
            // Unstar
            await db
                .from("question_stars")
                .delete()
                .eq("id", existing.id);
            return { success: true, starred: false };
        } else {
            // Star
            const { error } = await db
                .from("question_stars")
                .insert({ question_id: questionId, profile_id: profileId });

            if (error) throw new Error(error.message);
            return { success: true, starred: true };
        }
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ─── Search ───

export async function searchQuestions(eventId: string, searchTerm: string) {
    try {
        const response = await qa.searchQuestions({
            search_term: searchTerm,
            event_id_filter: eventId,
        });
        if (response.error) throw new Error(response.error);
        return { success: true, data: response.data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function clusterQuestions(questionIds: string[]) {
    try {
        const access = await getLoAccess();
        if (!access.canModerate) {
            return { success: false, error: "Only Lo! admins can do that." };
        }

        if (questionIds.length < 2) {
            return { success: false, error: "Select at least 2 questions to cluster." };
        }

        const { data, error } = await db.rpc('cluster_questions', {
            question_ids: questionIds
        });

        if (error) throw new Error(error.message);
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ─── Who is viewing (see src/lib/lo-admin.ts) ───

/**
 * What the Lo! shell may show this viewer: the moderation tab, and whether its buttons
 * act. Decided on the server from the real session — the same rule every moderation
 * action re-checks — so the tab can't disagree with what the actions allow.
 */
export async function getLoViewer() {
    const access = await getLoAccess();
    return { canRead: access.canRead, canModerate: access.canModerate };
}

// ─── Member recognition (see src/lib/lo-member.ts) ───

/**
 * Lo! has no login. These wrap the recognition layer so client components can ask
 * "who is this?" and confirm membership without ever touching the roster directly.
 *
 * Recognition unlocks testimonies only. It is NOT a portal session and grants no
 * admin rights — admin still comes from the real session via `access-control`.
 */
export async function getLoMemberIdentity(): Promise<LoMember | null> {
    return getLoMember();
}

export async function verifyLoMember(identifier: string, surname: string) {
    return verifyAndLinkMember(identifier, surname);
}

export async function forgetLoMember() {
    await forgetLoMemberLink();
    return { success: true };
}
