import type { Metadata } from "next";
import { sectionTitle } from "@/lib/metadata";

/**
 * Title-only layout.
 *
 * The page itself is a client component, and client components can't export
 * `metadata` — so the title lives here instead. Renders nothing of its own.
 */
export const metadata: Metadata = {
    title: sectionTitle("Tenure Manager"),
    description: "Tenure configuration, structure, cabinet and generations.",
};

export default function TenureLayout({ children }: { children: React.ReactNode }) {
    return children;
}
