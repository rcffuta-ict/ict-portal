import { Suspense } from "react";
import { getActiveEvents, getQuestions } from "./actions";
import { checkEnhancedAdminAccess } from "@/lib/access-control";
import { validateSession } from "@/lib/auth-utils";
import { RcfIctClient } from "@rcffuta/ict-lib/server";
import { CompactPreloader } from "@/components/ui/preloader";
import { QAPageClient } from "@/components/qa/QAPageClient";

export const metadata = {
    title: "Q&A | RCF FUTA",
    description:
        "Ask questions, get answers, and engage with the RCF FUTA community.",
};

export default async function QAPage() {
    // Check admin status
    const { isAdmin } = await checkEnhancedAdminAccess();

    // Check if user is authenticated and get profile
    let authenticatedUser: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    } | null = null;

    try {
        const { valid, user } = await validateSession();
        if (valid && user) {
            const rcf = RcfIctClient.fromEnv();
            const fullProfile = await rcf.member.getFullProfile(user.id);
            if (fullProfile) {
                authenticatedUser = {
                    id: fullProfile.profile.id,
                    firstName: fullProfile.profile.firstName,
                    lastName: fullProfile.profile.lastName,
                    email: user.email || fullProfile.profile.email || "",
                };
            }
        }
    } catch {
        // User not authenticated
    }

    // Fetch active events
    const eventsResult = await getActiveEvents();
    const activeEvents = eventsResult.success ? eventsResult.data || [] : [];

    // Fetch initial questions (latest public ones)
    const questionsResult = await getQuestions({
        status: isAdmin
            ? ["visible", "answered", "flagged", "hidden"]
            : ["visible", "answered"],
    });

    const initialQuestions = (
        questionsResult.success ? questionsResult.data : []
    ) as any[];

    return (
        <Suspense
            fallback={<CompactPreloader title="Loading Q&A Hub..." />}
        >
            <QAPageClient
                initialQuestions={initialQuestions}
                events={activeEvents}
                isAdmin={isAdmin}
                authenticatedUser={authenticatedUser}
            />
        </Suspense>
    );
}
