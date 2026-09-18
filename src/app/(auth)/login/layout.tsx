import type { Metadata } from "next";

/**
 * Title-only layout.
 *
 * The page itself is a client component, and client components can't export
 * `metadata` — so the title lives here instead. Renders nothing of its own.
 */
export const metadata: Metadata = {
    title: "Sign In",
    description: "Sign in to the RCF FUTA ICT Portal.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return children;
}
