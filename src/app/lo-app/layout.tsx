import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: {
        absolute: "Lo! App | RCF FUTA",
        default: "Lo! App | RCF FUTA"
    },
    description: "Behold! Ask questions, discover events, and engage with the RCF FUTA community.",
    openGraph: {
        title: "Lo! App | RCF FUTA",
        description: "Behold! Ask questions, discover events, and engage with the RCF FUTA community.",
        url: "https://ict.rcffuta.com/lo-app",
        siteName: "RCF FUTA Portal",
        locale: "en_US",
        type: "website",
        images: [
            {
                url: "/opengraph-image.jpg", // Assuming a specific image or fallback to default
                width: 1200,
                height: 630,
                alt: "Lo! App - RCF FUTA",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Lo! App | RCF FUTA",
        description: "Ask questions, discover events, and engage with RCF FUTA.",
        images: ["/opengraph-image.jpg"],
    },
};

export default function LoAppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
