import type { Metadata } from "next";
import { getEventBySlug } from "../actions";

/**
 * Title-only layout for a dynamic event.
 *
 * The page underneath is a client component and can't export metadata, so the title
 * lives here — and it matters more than usual: an event link pasted into WhatsApp is
 * fetched by a crawler that runs no JavaScript, so the event's real name and
 * description have to be in the server-rendered HTML for the preview card to say
 * anything useful.
 */
export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const res = await getEventBySlug(slug);
    const event = res.success ? res.data : null;

    if (!event) {
        return { title: "Event", description: "An RCF FUTA event." };
    }

    return {
        title: event.title,
        description: event.description || `${event.title} — an RCF FUTA event.`,
        openGraph: {
            title: event.title,
            description: event.description || `${event.title} — an RCF FUTA event.`,
        },
    };
}

export default function EventLayout({ children }: { children: React.ReactNode }) {
    return children;
}
