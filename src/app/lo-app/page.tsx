"use client";

import { useEffect, useState, useMemo } from "react";
import { LoAppClient } from "@/components/lo-app/LoAppClient";
import { useProfileStore } from "@/lib/stores/profile.store";
import { isProfileAdmin } from "@/config/sidebar-items";
import {
    getActiveEvents,
    getQuestions,
    getStarCounts,
    getUserStars,
} from "./actions";
import { CompactPreloader } from "@/components/ui/preloader";

export default function LoAppPage() {
    const { user } = useProfileStore();
    const [loading, setLoading] = useState(true);

    // Initial data states
    const [events, setEvents] = useState<any[]>([]);
    const [initialQuestions, setInitialQuestions] = useState<any[]>([]);
    const [starCounts, setStarCounts] = useState<Record<string, number>>({});
    const [userStarredIds, setUserStarredIds] = useState<string[]>([]);

    const isAdmin = useMemo(() => {
        return isProfileAdmin(user);
    }, [user]);

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
                // Fetch events
                const eventsResult = await getActiveEvents();
                const events = eventsResult.success ? eventsResult.data || [] : [];
                setEvents(events);

                // Fetch initial questions
                const questionsResult = await getQuestions({
                    status: (isAdmin || isProfileAdmin(user))
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
                        getUserStars(questionIds),
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
    }, [isAdmin, user]);

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
        />
    );
}
