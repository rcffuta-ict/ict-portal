"use server";

import { QAService } from "@rcffuta/ict-lib";
import { checkEnhancedAdminAccess } from "@/lib/access-control";
import { validateSession } from "@/lib/auth-utils";
import { RcfIctClient } from "@rcffuta/ict-lib/server";
import { ict } from "@/lib/ict";

// Initialize QAService with service role for server actions
const qaService = new QAService(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Events ───

export async function getActiveEvents() {
    try {
        const { data: events, error } = await ict.supabase
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

export async function getQuestions(options?: {
    eventId?: string;
    status?: string[];
    search_term?: string;
}) {
    try {
        if (options?.eventId) {
            const response = await qaService.getEventQuestions(options.eventId, {
                status: options.status as any,
                search_term: options.search_term,
            });
            if (response.error) throw new Error(response.error);
            return { success: true, data: response.data };
        } else {
            const response = await qaService.searchQuestions({
                search_term: options?.search_term || "",
            });
            if (response.error) throw new Error(response.error);

            let data = response.data;
            if (options?.status) {
                data = data.filter((q: any) => options.status?.includes(q.status));
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
}) {
    try {
        const payload: any = {
            event_id: data.event_id,
            question_text: data.question_text,
            scripture_reference: data.scripture_reference,
        };

        // Try to auto-link authenticated user's profile
        try {
            const { valid, user } = await validateSession();
            if (valid && user) {
                const rcf = RcfIctClient.fromEnv();
                const fullProfile = await rcf.member.getFullProfile(user.id);
                if (fullProfile) {
                    payload.asked_by_profile_id = fullProfile.profile.id;
                    payload.asker_name = `${fullProfile.profile.firstName} ${fullProfile.profile.lastName}`;
                } else {
                    payload.asker_name = data.asker_name || user.email?.split("@")[0] || "Member";
                }
            } else {
                // Not authenticated — use provided name or default
                payload.asker_name = data.asker_name || "Guest";
            }
        } catch {
            // Auth check failed — still allow the question
            payload.asker_name = data.asker_name || "Guest";
        }

        const response = await qaService.createQuestion(payload);

        if (response.error) throw new Error(response.error);
        return { success: true, data: response.data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function answerQuestion(questionId: string, answerText: string) {
    try {
        const adminCheck = await checkEnhancedAdminAccess();
        if (!adminCheck.isAdmin || !adminCheck.user) {
            return { success: false, error: "Unauthorized: Admin access required" };
        }

        const response = await qaService.answerQuestion(
            questionId,
            answerText,
            adminCheck.user.id
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
        const adminCheck = await checkEnhancedAdminAccess();
        if (!adminCheck.isAdmin) {
            return { success: false, error: "Unauthorized" };
        }

        const response = await qaService.toggleQuestionVisibility({
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

        const { data, error } = await ict.supabase
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

export async function getUserStars(questionIds: string[]) {
    try {
        if (questionIds.length === 0) return { success: true, data: [] };

        const { valid, user } = await validateSession();
        if (!valid || !user) return { success: true, data: [] };

        const rcf = RcfIctClient.fromEnv();
        const fullProfile = await rcf.member.getFullProfile(user.id);
        if (!fullProfile) return { success: true, data: [] };

        const { data, error } = await ict.supabase
            .from("question_stars")
            .select("question_id")
            .eq("profile_id", fullProfile.profile.id)
            .in("question_id", questionIds);

        if (error) throw new Error(error.message);
        return { success: true, data: (data || []).map((r) => r.question_id) };
    } catch (error: any) {
        return { success: false, error: error.message, data: [] };
    }
}

export async function toggleStar(questionId: string) {
    try {
        const { valid, user } = await validateSession();
        if (!valid || !user) {
            return { success: false, error: "Sign in to star questions" };
        }

        const rcf = RcfIctClient.fromEnv();
        const fullProfile = await rcf.member.getFullProfile(user.id);
        if (!fullProfile) {
            return { success: false, error: "Profile not found" };
        }

        const profileId = fullProfile.profile.id;

        // Check if already starred
        const { data: existing } = await ict.supabase
            .from("question_stars")
            .select("id")
            .eq("question_id", questionId)
            .eq("profile_id", profileId)
            .maybeSingle();

        if (existing) {
            // Unstar
            await ict.supabase
                .from("question_stars")
                .delete()
                .eq("id", existing.id);
            return { success: true, starred: false };
        } else {
            // Star
            const { error } = await ict.supabase
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
        const response = await qaService.searchQuestions({
            search_term: searchTerm,
            event_id_filter: eventId,
        });
        if (response.error) throw new Error(response.error);
        return { success: true, data: response.data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
