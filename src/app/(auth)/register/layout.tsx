import type { Metadata } from "next";

/**
 * Title-only layout.
 *
 * The page itself is a client component, and client components can't export
 * `metadata` — so the title lives here instead. Renders nothing of its own.
 */
export const metadata: Metadata = {
    title: "Register",
    description: "Join the RCF FUTA fellowship roster.",
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
    return children;
}
