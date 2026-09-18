import type { Metadata } from "next";

/**
 * Title-only layout.
 *
 * The page itself is a client component, and client components can't export
 * `metadata` — so the title lives here instead. Renders nothing of its own.
 */
export const metadata: Metadata = {
    title: "My Identity",
    description: "Your bio-data, academic details and ID card.",
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
    return children;
}
