import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// @ts-ignore: allow importing global CSS without type declarations
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

// 1. Viewport: Controls how it looks on mobile (Safe areas, colors)
export const viewport: Viewport = {
    themeColor: "#181240", // RCF Navy
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
};

// 2. Global Metadata
export const metadata: Metadata = {
    metadataBase: new URL("https://ict.rcffuta.com"), // Base URL for all relative links

    title: {
        default: "RCF FUTA ICT Portal",
        template: "%s | RCF FUTA ICT",
    },

    description:
        "The official digital ecosystem for the Redeemed Christian Fellowship, FUTA. Manage membership, attendance, academics, and voting in one secure hub.",

    applicationName: "RCF FUTA ICT Portal",

    keywords: [
        "RCF FUTA",
        "FUTA Fellowship",
        "RCF ICT",
        "Christian Fellowship",
        "FUTA Students",
        "Redeemed Christian Fellowship",
    ],

    authors: [{ name: "RCF FUTA ICT Unit", url: "https://ict.rcffuta.com" }],

    openGraph: {
        title: "RCF FUTA Digital Portal",
        description: "One Family. One Faith. One Digital Community.",
        url: "https://ict.rcffuta.com",
        siteName: "RCF FUTA Portal",
        locale: "en_US",
        type: "website",
        images: [
            {
                url: "/opengraph-image.jpg", // Make sure this file exists in /public
                width: 1200,
                height: 630,
                alt: "RCF FUTA Portal Banner",
            },
        ],
    },

    twitter: {
        card: "summary_large_image",
        title: "RCF FUTA Digital Portal",
        description: "The official digital hub for RCF FUTA.",
        images: ["/opengraph-image.jpg"], // Reuses OG image
    },

    icons: {
        icon: "/favicon.ico",
        shortcut: "/favicon.ico",
        apple: "/apple-touch-icon.png", // Add this to /public for iPhone home screen
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
                {children}
            </body>
        </html>
    );
}
