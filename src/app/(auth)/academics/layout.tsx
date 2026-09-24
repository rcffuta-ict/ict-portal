import type { Metadata } from "next";

/**
 * Title-only layout: the page is a client component, which can't export `metadata`.
 */
export const metadata: Metadata = {
    title: "Submit your results",
    description: "Submit your semester GPA and CGPA to the RCF FUTA Academic Unit, with the round token.",
};

export default function ResultsLayout({ children }: { children: React.ReactNode }) {
    return children;
}
