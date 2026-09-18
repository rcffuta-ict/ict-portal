import type { Metadata } from "next";

/**
 * Title-only layout.
 *
 * The page itself is a client component, and client components can't export
 * `metadata` — so the title lives here instead. Renders nothing of its own.
 */
export const metadata: Metadata = {
    title: "Forgot Password",
    description: "Recover access to your portal account.",
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
    return children;
}
