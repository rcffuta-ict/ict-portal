import type { Metadata } from "next";

/**
 * Title-only layout.
 *
 * The page itself is a client component, and client components can't export
 * `metadata` — so the title lives here instead. Renders nothing of its own.
 */
export const metadata: Metadata = {
    title: "Events",
    description: "Upcoming and past RCF FUTA events.",
};

export default function EventsLayout({ children }: { children: React.ReactNode }) {
    return children;
}
