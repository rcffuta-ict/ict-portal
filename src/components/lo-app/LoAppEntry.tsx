"use client";

import { useEffect, useState, useMemo } from "react";
import { LoAppClient, type FeedTab } from "@/components/lo-app/LoAppClient";
import { useProfileStore } from "@/lib/stores/profile.store";
import {
    getActiveEvents,
    getLoViewer,
    getQuestions,
    getStarCounts,
    getUserStars,
} from "@/app/lo-app/actions";
import { CompactPreloader } from "@/components/ui/preloader";

/**
 * The Lo! shell's data loader, shared by /lo-app and /lo-app/testimonies.
 *
 * Whether the moderation tab shows is asked of the SERVER (getLoViewer), not worked
 * out from the profile in the store: Lo! admins are appointed in Settings and aren't
 * visible in the profile, and the tab must agree with what the actions allow anyway.
 */
export function LoAppEntry({ initialFeedTab }: { initialFeedTab?: FeedTab }) {
    const { user } = useProfileStore();
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    // Initial data states
    const [events, setEvents] = useState<any[]>([]);
    const [initialQuestions, setInitialQuestions] = useState<any[]>([]);
    const [starCounts, setStarCounts] = useState<Record<string, number>>({});
    const [userStarredIds, setUserStarredIds] = useState<string[]>([]);

    // Construct authenticatedUser object for LoAppClient
    const authenticatedUser = useMemo(() => {
        if (!user || !user.profile) return null;
        return {
            id: user.profile.id,
            firstName: user.profile.firstName || user.profile.email?.split("@")[0] || "",
            lastName: user.profile.lastName || "",
            email: user.profile.email || "",
            level: user.academics.currentLevel,
        };
    }, [user]);

    useEffect(() => {
        const init = async () => {
            try {
                const [eventsResult, viewer] = await Promise.all([
                    getActiveEvents(),
                    getLoViewer(),
                ]);
                const events = eventsResult.success ? eventsResult.data || [] : [];
                setEvents(events);
                setIsAdmin(viewer.canRead);

                // The server trims these to what the viewer may see.
                const questionsResult = await getQuestions({
                    status: viewer.canRead
                        ? ["visible", "answered", "flagged", "hidden"]
                        : ["visible", "answered"],
                });
                const questions = (
                    questionsResult.success ? questionsResult.data : []
                ) as any[];
                setInitialQuestions(questions);

                // Fetch star counts and user stars
                if (questions.length > 0) {
                    const questionIds = questions.map((q) => q.id);
                    const [starCountsResult, userStarsResult] = await Promise.all([
                        getStarCounts(questionIds),
                        getUserStars(questionIds, user?.profile?.id),
                    ]);

                    setStarCounts(starCountsResult.data || {});
                    setUserStarredIds(userStarsResult.data || []);
                }
            } catch (err) {
                console.error("Failed to load initial data", err);
            } finally {
                setLoading(false);
            }
        };

        // We can fetch data immediately
        init();
    }, [user]);

    if (loading) {
        return <CompactPreloader title="Loading Lo! App..." />;
    }

    return (
        <LoAppClient
            initialQuestions={initialQuestions}
            events={events}
            isAdmin={isAdmin}
            authenticatedUser={authenticatedUser}
            initialStarCounts={starCounts}
            initialUserStars={userStarredIds}
            initialFeedTab={initialFeedTab}
        />
    );
}
