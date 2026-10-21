import type { Metadata } from "next";
import { LoAppEntry } from "@/components/lo-app/LoAppEntry";

export const metadata: Metadata = {
    title: "Testimonies | Lo! App",
    description: "What God has done among us at RCF FUTA — testimonies shared by members.",
    openGraph: {
        title: "Testimonies | Lo! App",
        description: "What God has done among us at RCF FUTA — testimonies shared by members.",
        url: "https://ict.rcffuta.com/lo-app/testimonies",
        siteName: "RCF FUTA Portal",
        type: "website",
        images: [{ url: "/opengraph-image.jpg", width: 1200, height: 630, alt: "Lo! Testimonies" }],
    },
};

/** The testimonies feed at its own address — the link to share. */
export default function TestimoniesPage() {
    return <LoAppEntry initialFeedTab="testimonies" />;
}
