import type { Metadata } from "next";

/**
 * Title-only layout for the dashboard index.
 *
 * `(overview)` is a ROUTE GROUP — parentheses mean it adds no URL segment, so the page
 * still lives at `/dashboard`. It exists purely so the overview can carry metadata:
 * both `dashboard/layout.tsx` and the page itself are client components, and client
 * components cannot export `metadata`.
 */
export const metadata: Metadata = {
    title: "Dashboard",
    description: "Your RCF FUTA portal overview: services, events and tools.",
};

export default function OverviewLayout({ children }: { children: React.ReactNode }) {
    return children;
}
