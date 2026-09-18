import type { Metadata } from "next";
import { sectionTitle } from "@/lib/metadata";

/**
 * Title-only layout.
 *
 * The page itself is a client component, and client components can't export
 * `metadata` — so the title lives here instead. Renders nothing of its own.
 */
export const metadata: Metadata = {
    title: sectionTitle("Events"),
    description: "Upcoming and past RCF FUTA events.",
};

export default function EventsLayout({ children }: { children: React.ReactNode }) {
    return children;
}
