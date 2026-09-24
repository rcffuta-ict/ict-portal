import type { Metadata } from "next";

/**
 * Title-only layout.
 *
 * The page itself is a client component, and client components can't export
 * `metadata` — so the title lives here instead. Renders nothing of its own.
 */
export const metadata: Metadata = {
    title: "Your record",
    description: "Get indexed in the RCF FUTA fellowship roster, or update your details, with your level token.",
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
    return children;
}
