import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Admin Console",
    description:
        "Restricted access. Administrative dashboard for attendance tracking and membership management.",

    // CRITICAL: Prevent Google/Bing from showing this page in search results
    robots: {
        index: false,
        follow: false,
    },

    openGraph: {
        title: "RCF FUTA  Sister's conference Admin Console",
        description: "Restricted Access. Authorized Personnel Only.",
        // You might want a different image here, or just use the default
        siteName: "RCF FUTA ICT",
        locale: "en_US",
        type: "website",
    },
};


export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}