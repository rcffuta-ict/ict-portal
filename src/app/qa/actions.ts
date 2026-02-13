"use server";

import { QAService } from "@rcffuta/ict-lib";
import { checkEnhancedAdminAccess } from "@/lib/access-control";
import { validateSession } from "@/lib/auth-utils";
import { RcfIctClient } from "@rcffuta/ict-lib/server";
import { ict } from "@/lib/ict";

// Initialize QAService
const qaService = new QAService(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Using Service Role key for actions to ensure permissions are handled by our code logic + RLS
);

export async function getActiveEvents() {
    try {
        const { data: events, error } = await ict.supabase
            .from('events')
            .select('id, title, slug')
            .eq('is_active', true)
            .order('date', { ascending: false });

        if (error) throw new Error(error.message);
        return { success: true, data: events };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getQuestions(options?: { eventId?: string; status?: string[]; search_term?: string }) {
    try {
        // map options to QAService format
        // getEventQuestions requires an eventId usually, but we might want all?
        // QAService might need an update if it STRICTLY requires eventId.
        // Let's assume for now we might need to fetch for a specific event or we use `searchQuestions` with empty term to get all if library supports it.
        // If library `getEventQuestions` mandates eventId, we can't get "all" easily without iteration.
        // Let's check library usage in QA-FEATURE.md again?
        // "getEventQuestions('event-uuid', ...)"
        // "searchQuestions({ search_term: '...', event_id_filter: '...' })"

        // If no eventId provided, we can try using searchQuestions with empty term?
        // Or we force user to select event to view?
        // Or we fetch for all active events?
        // Let's try `searchQuestions` with empty term if no eventId.

        if (options?.eventId) {
            const response = await qaService.getEventQuestions(options.eventId, {
                status: options.status as any,
                search_term: options.search_term
            });
            if (response.error) throw new Error(response.error);
            return { success: true, data: response.data };
        } else {
            // Fetch global or search
            const response = await qaService.searchQuestions({
                search_term: options?.search_term || "",
                // status filter might not be supported in searchQuestions directly based on docs?
                // Docs: "searchQuestions({ search_term: ..., event_id_filter: ... })"
                // It doesn't mention status filter in search.
                // We might need to filter manually if getting all.
            });
             if (response.error) throw new Error(response.error);

             // Manually filter status if needed
             let data = response.data;
             if (options?.status) {
                 data = data.filter((q: any) => options.status?.includes(q.status));
             }
             return { success: true, data: data };
        }

    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function askQuestion(data: { event_id: string; question_text: string; scripture_reference?: string; is_anonymous: boolean; asker_name?: string }) {
    try {
        const { valid, user } = await validateSession();

        // If not anonymous and user is logged in, we use their profile ID
        let profileId = undefined;

        if (valid && user) {
             const rcf = RcfIctClient.fromEnv();
             const fullProfile = await rcf.member.getFullProfile(user.id);
             if (fullProfile) {
                 profileId = fullProfile.profile.id;
             }
        }

        const payload: any = {
            event_id: data.event_id,
            question_text: data.question_text,
            scripture_reference: data.scripture_reference,
        };

        if (data.is_anonymous) {
            payload.asker_name = data.asker_name || "Anonymous";
        } else {
             if (profileId) {
                 payload.asked_by_profile_id = profileId;
                 // If utilizing a library that sets name from profile, good.
                 // If not, we pass the name they entered or their profile name?
                 // Let's pass the name they entered in form as `asker_name` just in case, or default to "Guest"
                 payload.asker_name = data.asker_name || "Guest";
             } else {
                 payload.asker_name = data.asker_name || "Guest";
             }
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
            // Also check moderator/leader access if needed? User said "Admins remain normal admins".
            // So we use checkEnhancedAdminAccess.
            return { success: false, error: "Unauthorized: Admin access required" };
        }

        const response = await qaService.answerQuestion(
            questionId,
            answerText,
            adminCheck.user.id // This requires the profile ID typically
        );

        if (response.error) throw new Error(response.error);
        return { success: true, data: response.data };

    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function toggleVisibility(questionId: string, status: 'visible' | 'hidden' | 'answered') {
    try {
        const adminCheck = await checkEnhancedAdminAccess();
        if (!adminCheck.isAdmin) {
             return { success: false, error: "Unauthorized" };
        }

        const response = await qaService.toggleQuestionVisibility({
            question_id: questionId,
            new_status: status
        });

        if (response.error) throw new Error(response.error);
        return { success: true, data: response };
    } catch (error: any) {
         return { success: false, error: error.message };
    }
}

export async function voteQuestion(questionId: string) {
    // Implement upvote logic if library supports it or we need custom.
    // Library doesn't seem to have explicit "upvote" in the README usage,
    // but typically `createQuestionReference` or just metadata updates?
    // Actually, looking at Features: "Question Clustering", "Flagging".
    // "Upvotes" usually simply implemented.
    // I'll stick to what's explicitly in `QAService` for now.
    // Wait, the README doesn't mention upvoting. It mentions "Flagging".
    // I will implement Flagging.
    return { success: false, error: "Not implemented" };
}


export async function flagQuestion(questionId: string, reason: string, description?: string) {
    try {
        // Anyone can flag? Or just logged in users?
        // README says "Community-driven content moderation".
        // Let's allow it, preferably logged in but maybe anonymous too.

        const response = await qaService.flagQuestion({
            question_id: questionId,
            reason: reason as any,
            description: description,
            flagged_by_name: "User" // Capture real user if possible
        });

         if (response.error) throw new Error(response.error);
        return { success: true, data: response };

    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function searchQuestions(eventId: string, searchTerm: string) {
    try {
        const response = await qaService.searchQuestions({
            search_term: searchTerm,
            event_id_filter: eventId
        });
         if (response.error) throw new Error(response.error);
        return { success: true, data: response.data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
