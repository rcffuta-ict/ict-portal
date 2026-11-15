import { LoAppEntry } from "@/components/lo-app/LoAppEntry";
import type { FeedTab } from "@/components/lo-app/LoAppClient";

const FEED_TABS: FeedTab[] = ["testimonies", "questions", "events"];

/**
 * Lo! opens on testimonies. `?tab=questions` or `?tab=events` opens another feed, so
 * an old link to the Q&A still lands somewhere sensible.
 */
export default async function LoAppPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string }>;
}) {
    const { tab } = await searchParams;
    const initialFeedTab = FEED_TABS.includes(tab as FeedTab) ? (tab as FeedTab) : "testimonies";
    return <LoAppEntry initialFeedTab={initialFeedTab} />;
}
