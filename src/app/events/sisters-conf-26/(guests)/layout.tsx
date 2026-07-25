import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Sisters' Conference Registration",
    description:
        "Register for 'The Lord's Handmaid' Conference 2026. Generate your personalized QR gate pass.",
    openGraph: {
        title: "The Lord's Handmaid | Sisters' Conference 2026",
        description:
            "Secure your seat for the RCF FUTA Sisters' Conference. Get your digital ticket now.",
    },
};


export default function PageLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}